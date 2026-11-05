import { Map as MapLibreMap, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { campusFrame, pilotFrame } from "@/lib/guided/map-provider";
import type { SceneHandle, ScenePadding } from "./scene-types";

/** Same-origin worker. A Vite-transformed worker pulls in the client runtime, which has no `window` inside a worker. */
const localWorkerUrl = "/guided/maplibre-gl-worker.mjs";
setWorkerUrl(localWorkerUrl);

const emptyRoute = { type: "Feature" as const, geometry: { type: "LineString" as const, coordinates: [] as Array<[number, number]> }, properties: {} };

function style(url: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      buildings: { type: "geojson", data: url },
      route: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
    },
    layers: [
      { id: "paper", type: "background", paint: { "background-color": "#E7E4DA" } },
      {
        id: "buildings",
        type: "fill-extrusion",
        source: "buildings",
        paint: {
          "fill-extrusion-color": "#B7AA96",
          "fill-extrusion-height": ["to-number", ["get", "height"], 12],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 1,
        },
      },
      { id: "route-paper", type: "line", source: "route", paint: { "line-color": "#F6F5F0", "line-width": 8 } },
      { id: "route-ink", type: "line", source: "route", paint: { "line-color": "#15181A", "line-width": 3 } },
    ],
  };
}

/** Local extrusions only. External tile hosts are refused so this path cannot wander onto ion or Google. */
export function mountOsmScene(container: HTMLElement, options: { url: string; onReady: () => void; onFailed: () => void }): SceneHandle {
  let destroyed = false;
  let frame = 0;
  const map = new MapLibreMap({
    container,
    style: style(options.url),
    center: [campusFrame.lng, campusFrame.lat],
    zoom: 14.7,
    pitch: 55,
    bearing: -16,
    minZoom: 13.2,
    maxZoom: 17.4,
    maxPitch: 67,
    maxBounds: [[pilotFrame.west, pilotFrame.south], [pilotFrame.east, pilotFrame.north]],
    attributionControl: { compact: true, customAttribution: "© OpenStreetMap contributors, ODbL" },
    fadeDuration: 0,
    transformRequest(url) {
      const sameOrigin = url.startsWith("/") || url.startsWith(window.location.origin) || url.startsWith("blob:");
      if (!sameOrigin) throw new Error("blocked external map resource");
      return { url };
    },
  });
  const fail = () => { if (!destroyed) options.onFailed(); };
  map.on("error", event => {
    const sourceId = "sourceId" in event ? String(event.sourceId ?? "") : "";
    const message = String(event.error?.message ?? "");
    if (sourceId === "buildings" || /geojson|ajax|network|worker failed/i.test(message)) fail();
  });
  map.once("idle", () => { if (!destroyed) options.onReady(); });
  map.once("load", () => { if (!destroyed) map.resize(); });

  const routeSource = () => map.getSource("route") as GeoJSONSource | undefined;
  const draw = (coordinates: Array<[number, number]>) => {
    const feature = coordinates.length >= 2
      ? { type: "Feature" as const, geometry: { type: "LineString" as const, coordinates }, properties: {} }
      : emptyRoute;
    routeSource()?.setData(feature);
  };

  return {
    flyTo(target, durationMs) {
      // Nearby homes share the campus frame so the extrusions stay large enough to read.
      // Farther homes share the view with the campus instead of zooming into empty ground.
      const nearCampus = Math.abs(target.lng - campusFrame.lng) < 0.008 && Math.abs(target.lat - campusFrame.lat) < 0.008;
      if (nearCampus) {
        map.flyTo({ center: [campusFrame.lng, campusFrame.lat], zoom: 16.05, pitch: 54, bearing: -18, duration: durationMs, essential: true });
        return;
      }
      const west = Math.min(target.lng, campusFrame.west + 0.012);
      const east = Math.max(target.lng, campusFrame.east - 0.012);
      const south = Math.min(target.lat, campusFrame.south + 0.006);
      const north = Math.max(target.lat, campusFrame.north - 0.006);
      map.fitBounds([[west, south], [east, north]], { pitch: 48, bearing: -16, duration: durationMs, maxZoom: 15.2, essential: true });
    },
    project(target) {
      const point = map.project([target.lng, target.lat]);
      return { x: point.x, y: point.y };
    },
    setRoute(coordinates, durationMs) {
      cancelAnimationFrame(frame);
      if (coordinates.length < 2 || durationMs <= 0) { draw(coordinates); return; }
      const start = performance.now();
      const tick = (now: number) => {
        if (destroyed) return;
        const t = Math.min(1, (now - start) / durationMs);
        const count = Math.max(2, Math.ceil(coordinates.length * t));
        draw(coordinates.slice(0, count));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    },
    setPadding(padding: ScenePadding) { map.setPadding(padding); },
    resize() { map.resize(); },
    onMove(listener) {
      map.on("move", listener);
      map.on("resize", listener);
      return () => { map.off("move", listener); map.off("resize", listener); };
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      map.remove();
    },
  };
}
