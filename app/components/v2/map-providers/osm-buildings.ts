import maplibregl, { type GeoJSONSource, type Map as MlMap } from "maplibre-gl";
import { CAMPUS_VIEW, FALLBACK_CITY_MODEL } from "@/lib/v2/map-provider";
import { flightDurationMs } from "@/lib/v2/map-engine";
import { v2Ease } from "@/lib/v2/motion";
import type { CameraTarget, MapHost, MapSession } from "./types";

type MassingFeature = {
  type: "Feature";
  id?: string;
  properties?: { id?: string; height?: number };
  geometry?: { type?: string; coordinates?: number[][][] };
};
type FeatureCollection = { type: "FeatureCollection"; features: MassingFeature[] };

/** Oxford Road building extrusions from FALLBACK_CITY_MODEL.url on this origin. */
export async function startOsmBuildings(host: MapHost): Promise<MapSession> {
  await import("maplibre-gl/dist/maplibre-gl.css");
  const response = await fetch(FALLBACK_CITY_MODEL.url);
  if (!response.ok) throw new Error("massing-missing");
  const data = await response.json() as FeatureCollection;
  const centroids = new Map<string, [number, number]>();
  for (const feature of data.features) {
    const id = String(feature.id ?? feature.properties?.[FALLBACK_CITY_MODEL.idProperty] ?? "");
    if (!id) continue;
    feature.id = id;
    const point = centroid(feature);
    if (point) centroids.set(id, point);
  }
  host.onProgress({ loaded: 0, pending: 1, approxBytes: 318_154, label: "建筑体块 · 约 0.3MB" });
  const map = new maplibregl.Map({
    container: host.canvas,
    attributionControl: false,
    style: {
      version: 8,
      sources: { massing: { type: "geojson", data: data as never } },
      layers: [
        { id: "ground", type: "background", paint: { "background-color": "#E7E2D6" } },
        { id: "buildings", type: "fill-extrusion", source: "massing", paint: {
          "fill-extrusion-color": ["case", ["boolean", ["feature-state", "highlight"], false], "#15181A", "#D4CFC2"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-opacity": 0.96,
        } },
      ],
    },
    center: [CAMPUS_VIEW.lng, CAMPUS_VIEW.lat],
    zoom: 15.1,
    pitch: 52,
    bearing: -18,
    maxPitch: 68,
    fadeDuration: 0,
  });
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("osm-timeout")), 6_000);
    map.once("error", () => { window.clearTimeout(timer); reject(new Error("osm-error")); });
    map.once("idle", () => { window.clearTimeout(timer); resolve(); });
  });
  host.credits.textContent = "建筑体块 © OpenStreetMap";
  let routeTimer = 0;
  let highlighted: string | null = null;
  return {
    id: "osm-buildings",
    flyTo(target) { ease(map, target, host.reducedMotion); },
    setRoute(coordinates) {
      window.clearInterval(routeTimer);
      revealRoute(map, coordinates, host.reducedMotion, (timer) => { routeTimer = timer; });
    },
    project(lng, lat) {
      const point = map.project([lng, lat]);
      return { x: point.x, y: point.y };
    },
    highlightBuilding(id) {
      if (highlighted) map.setFeatureState({ source: "massing", id: highlighted }, { highlight: false });
      highlighted = id;
      if (id) map.setFeatureState({ source: "massing", id }, { highlight: true });
    },
    nearestBuildingId(lng, lat) {
      let best: string | null = null;
      let bestDistance = Infinity;
      for (const [id, point] of centroids) {
        const distance = (point[0] - lng) ** 2 + (point[1] - lat) ** 2;
        if (distance < bestDistance) { bestDistance = distance; best = id; }
      }
      return best;
    },
    destroy() {
      window.clearInterval(routeTimer);
      map.remove();
    },
  };
}

function centroid(feature: MassingFeature): [number, number] | null {
  const ring = feature.geometry?.coordinates?.[0];
  if (!ring?.length) return null;
  let lng = 0;
  let lat = 0;
  let count = 0;
  for (const pair of ring) {
    if (!pair || pair.length < 2) continue;
    lng += pair[0];
    lat += pair[1];
    count += 1;
  }
  return count ? [lng / count, lat / count] : null;
}

function ease(map: MlMap, target: CameraTarget, reduced: boolean) {
  const zoom = target.altitude === "home" ? 16.6 : target.altitude === "overview" ? 13.6 : 15.1;
  map.easeTo({
    center: [target.lng, target.lat],
    zoom,
    pitch: target.altitude === "home" ? 58 : 52,
    duration: flightDurationMs(reduced),
    essential: true,
    easing: v2Ease,
  });
}

function revealRoute(map: MlMap, coordinates: [number, number][] | null, reduced: boolean, keep: (timer: number) => void) {
  const sourceId = "v2-route";
  const line = (count: number) => ({ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: coordinates && count ? coordinates.slice(0, count) : [] } });
  const existing = map.getSource(sourceId) as GeoJSONSource | undefined;
  if (!coordinates || coordinates.length < 2) {
    existing?.setData(line(0));
    return;
  }
  const apply = (count: number) => {
    const data = line(count);
    const source = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      map.addSource(sourceId, { type: "geojson", data });
      map.addLayer({ id: sourceId, type: "line", source: sourceId, paint: { "line-color": "#15181A", "line-width": 3 } });
    }
  };
  if (reduced) { apply(coordinates.length); return; }
  const started = performance.now();
  const timer = window.setInterval(() => {
    const t = Math.min(1, (performance.now() - started) / 700);
    apply(Math.max(2, Math.ceil(coordinates.length * v2Ease(t))));
    if (t >= 1) window.clearInterval(timer);
  }, 32);
  keep(timer);
}
