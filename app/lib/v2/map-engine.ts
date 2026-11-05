import { V2_FLIGHT_MS } from "./motion";

/** Coarse tiles first, then the sharper error the current home already uses. */
export const INITIAL_SCREEN_SPACE_ERROR = 32;
export const REFINED_SCREEN_SPACE_ERROR = 12;
export const MAX_ZOOM_DISTANCE_M = 6500;
export const PHOTO_TILE_TIMEOUT_MS = 12_000;

/** Oxford Road campus. The first camera stays inside central Manchester. */
export const MANCHESTER_CAMERA = { lng: -2.2349, lat: 53.4668, height: 1600, pitchDeg: -52 };

export const GOOGLE_MAP_RESOURCES = [
  {
    id: "cesium-ion-2275207",
    name: "Google Photorealistic 3D Tiles",
    via: "CesiumJS Cesium3DTileset.fromIonAssetId(2275207)",
    dependsOnGoogle: true,
    note: "Requested only when the repo already has VITE_CESIUM_ION_ACCESS_TOKEN. This change does not add a key or enable billing.",
  },
  {
    id: "google-map-tiles",
    name: "Google Map Tiles API photorealistic tileset",
    via: "CesiumJS createGooglePhotorealistic3DTileset",
    dependsOnGoogle: true,
    note: "Used only if VITE_MAP_PROVIDER=google-maps and an existing browser key is already set.",
  },
] as const;

export const KEY_FREE_MAP_RESOURCES = [
  {
    id: "osm-massing",
    name: "OpenStreetMap building footprints",
    via: "/v2/manchester-massing.geojson",
    dependsOnGoogle: false,
    note: "Vendored Overpass extract for central Manchester, October 2026. No runtime call to Google.",
  },
  {
    id: "cesium-massing",
    name: "CesiumJS extruded buildings",
    via: "local GeoJSON on an untextured globe",
    dependsOnGoogle: false,
    note: "The Cesium engine already in the repo. Ion and Google tiles are not contacted in this mode.",
  },
  {
    id: "maplibre-massing",
    name: "MapLibre fill-extrusion",
    via: "the same local GeoJSON, no tile CDN",
    dependsOnGoogle: false,
    note: "Automatic fallback when Google tiles fail or WebGL cannot carry the photorealistic tileset.",
  },
] as const;

export type WebglTier = "none" | "weak" | "ok";
export type GoogleTileState = "skipped" | "loading" | "ready" | "failed";
export type MapEngineId = "cesium-photo" | "cesium-massing" | "maplibre" | "silhouette";

export function probeWebgl(): WebglTier {
  if (typeof document === "undefined") return "none";
  try {
    const canvas = document.createElement("canvas");
    const cautious = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true })
      || canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true });
    const gl = cautious || canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return "none";
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : "";
    const software = /swiftshader|llvmpipe|softpipe|software/i.test(renderer);
    const maxTexture = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0);
    if (!cautious || software || (maxTexture > 0 && maxTexture < 4096)) return "weak";
    return "ok";
  } catch {
    return "none";
  }
}

export function selectMapEngine(input: {
  webgl: WebglTier;
  googleConfigured: boolean;
  googleTiles: GoogleTileState;
}): MapEngineId {
  if (input.webgl === "none") return "silhouette";
  if (input.webgl === "weak" || input.googleTiles === "failed") return "maplibre";
  if (input.googleConfigured && (input.googleTiles === "loading" || input.googleTiles === "ready")) return "cesium-photo";
  return "cesium-massing";
}

export function flightDurationMs(reduced: boolean) {
  const ms = reduced ? 0 : V2_FLIGHT_MS;
  if (ms !== 0 && (ms < 600 || ms > 900)) throw new Error("camera flight must stay within 600–900ms");
  return ms;
}

export type ResourceTimingLike = { name: string; transferSize?: number };

const MAP_RESOURCE = /cesium|ion\.cesium|googleapis|gstatic\.com|kh\.google|manchester-massing|maplibre/i;

export function mapTransferBytes(entries: ResourceTimingLike[]) {
  return entries.reduce((sum, entry) => {
    if (!MAP_RESOURCE.test(entry.name)) return sum;
    return sum + (entry.transferSize ?? 0);
  }, 0);
}

export type V2MapPerf = {
  usableMs: number | null;
  frameMs: number | null;
  engine: MapEngineId;
  webgl: WebglTier | "unknown";
  googleTiles: GoogleTileState;
  bytes: number;
  initialScreenSpaceError: number;
  refinedScreenSpaceError: number | null;
};

export function emptyMapPerf(): V2MapPerf {
  return {
    usableMs: null,
    frameMs: null,
    engine: "silhouette",
    webgl: "unknown",
    googleTiles: "skipped",
    bytes: 0,
    initialScreenSpaceError: INITIAL_SCREEN_SPACE_ERROR,
    refinedScreenSpaceError: null,
  };
}

