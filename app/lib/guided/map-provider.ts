import { resolveMapConfig, type MapProvider } from "../map-config";

/** Swappable guided-map sources. Auto-detect picks one; a config value pins one. */
export const guidedMapProviders = ["google-photorealistic", "osm-buildings", "prerendered-video"] as const;
export type GuidedMapProvider = (typeof guidedMapProviders)[number];
export type GuidedMapPreference = GuidedMapProvider | "auto";

/** First camera and first tile requests stay inside the Oxford Road campus. */
export const campusFrame = { west: -2.255, south: 53.458, east: -2.215, north: 53.476, lng: -2.2349, lat: 53.4668 };
/** Homes in the Manchester pilot, still far inside Greater Manchester. */
export const pilotFrame = { west: -2.27, south: 53.435, east: -2.195, north: 53.495 };

/** QA on the current photorealistic view: mobile ~10–11MB, desktop ~26–28MB and ~450 requests. */
export const photorealisticBytes = { mobile: 11 * 1024 * 1024, desktop: 27 * 1024 * 1024 };

export const googleMapResources = [
  { id: "photorealistic-3d-tiles", name: "Google Photorealistic 3D Tiles", via: "Cesium ion asset 2275207", hosts: ["assets.ion.cesium.com"] },
  { id: "google-map-tiles", name: "Google Map Tiles API", via: "VITE_MAP_PROVIDER=google-maps", hosts: ["tile.googleapis.com"] },
  { id: "google-maps-js", name: "Google Maps host", via: "reachability check, and tiles when that provider is configured", hosts: ["maps.googleapis.com"] },
  { id: "cesium-ion", name: "Cesium ion", via: "only the sign-in and delivery path for the Google tileset", hosts: ["api.cesium.com", "assets.ion.cesium.com"] },
] as const;

/** Same-origin building footprints. The fallback never calls Cesium ion or a tile CDN. */
export const localBuildingDataset = "/guided/uom-buildings.geojson";
/**
 * One config entry for the self-hosted fallback.
 * Empty uses the placeholder OSM extrusions. A same-origin tileset.json swaps in a future generated model.
 */
export const fallbackDatasetEnv = "VITE_GUIDED_FALLBACK";
/** Google or Cesium hosts that have not answered in this window are treated as unreachable. Key-less: no token is sent. */
export const probeTimeoutMs = 3000;
/** First photorealistic tile. One deadline covers the script, tileset metadata, and the first tile. */
export const firstTileTimeoutMs = 8000;
/** Precomputed files only. Live Valhalla and Overpass are not used on this route. */
export const localDataTimeoutMs = 4000;
/** Last settled choice. A missing GPU is not stored, so a later laptop can still try 3D. */
export const guidedMapStorageKey = "atlas-guided-map-provider";

/** Hosts probed with a bare GET. No API key and no ion token is attached. */
export const googleProbeHosts = ["tile.googleapis.com", "maps.googleapis.com", "api.cesium.com", "assets.ion.cesium.com"] as const;

export const openMapResources = [
  { id: "maplibre", name: "MapLibre GL", note: "bundled in this app" },
  { id: "uom-buildings", name: "University of Manchester building footprints", path: localBuildingDataset },
  { id: "local-photo", name: "Manchester overview photo", path: "/photos/manchester.jpg" },
  { id: "saved-routes", name: "Precomputed walking routes", path: "/campus-routes" },
  { id: "cached-amenities", name: "Cached amenity snapshot", path: "/amenities/manchester.json" },
] as const;

export type FallbackDataset =
  | { kind: "osm-extrusion"; url: string }
  | { kind: "3d-tiles"; url: string };

export function readProviderPreference(value: string | null | undefined): GuidedMapPreference {
  const name = value?.trim();
  if (name === "google-photorealistic" || name === "osm-buildings" || name === "prerendered-video") return name;
  return "auto";
}

/** Cloudflare sends XX when the country is unknown and T1 for Tor. Those are not China. */
export function visitorCountry(header: string | null | undefined): string | null {
  const value = header?.trim().toUpperCase() ?? "";
  if (!value || value === "XX" || value === "T1") return null;
  return value;
}

export function countrySkipsGoogle(country: string | null | undefined): boolean {
  return country?.trim().toUpperCase() === "CN";
}

export function photorealisticConfigured(env: { VITE_MAP_PROVIDER?: string; VITE_CESIUM_ION_ACCESS_TOKEN?: string; VITE_GOOGLE_MAPS_API_KEY?: string }) {
  return resolveMapConfig(env).configured;
}

export function configuredMapProvider(env: { VITE_MAP_PROVIDER?: string; VITE_CESIUM_ION_ACCESS_TOKEN?: string; VITE_GOOGLE_MAPS_API_KEY?: string }): MapProvider {
  return resolveMapConfig(env).provider;
}

export type ProviderReason = "config" | "auto" | "no-webgl" | "no-credential" | "google-unreachable" | "country" | "remembered";

type StorageLike = { getItem(key: string): string | null; setItem?(key: string, value: string): void };

export function readRememberedProvider(storage: StorageLike | null | undefined): GuidedMapProvider | null {
  try {
    const value = storage?.getItem(guidedMapStorageKey);
    if (value === "google-photorealistic" || value === "osm-buildings" || value === "prerendered-video") return value;
  } catch { /* Storage is optional. */ }
  return null;
}

export function rememberGuidedProvider(storage: StorageLike | null | undefined, provider: GuidedMapProvider) {
  if (provider === "prerendered-video" || !storage?.setItem) return;
  try { storage.setItem(guidedMapStorageKey, provider); } catch { /* Keep the in-memory choice. */ }
}

/** Same-origin only. An absolute ion or Google URL cannot become the fallback. */
export function resolveFallbackDataset(value: string | null | undefined): FallbackDataset {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return { kind: "osm-extrusion", url: localBuildingDataset };
  const url = trimmed.startsWith("/") ? trimmed : `/${trimmed.replace(/^\/+/, "")}`;
  if (/\.geojson(?:$|\?)/i.test(url)) return { kind: "osm-extrusion", url };
  return { kind: "3d-tiles", url };
}

export function chooseGuidedMapProvider(input: {
  preference: GuidedMapPreference;
  webgl: boolean;
  googleReachable: boolean;
  photorealisticConfigured: boolean;
  country?: string | null;
  remembered?: GuidedMapProvider | null;
}): { provider: GuidedMapProvider; reason: ProviderReason } {
  const pinned = input.preference;
  if (pinned === "prerendered-video") return { provider: "prerendered-video", reason: "config" };
  if (!input.webgl) return { provider: "prerendered-video", reason: "no-webgl" };
  if (pinned === "osm-buildings") return { provider: "osm-buildings", reason: "config" };
  const googleReady = input.photorealisticConfigured && input.googleReachable;
  if (pinned === "google-photorealistic") {
    return googleReady
      ? { provider: "google-photorealistic", reason: "config" }
      : { provider: "osm-buildings", reason: input.photorealisticConfigured ? "google-unreachable" : "no-credential" };
  }
  if (countrySkipsGoogle(input.country)) return { provider: "osm-buildings", reason: "country" };
  if (input.remembered === "osm-buildings") return { provider: "osm-buildings", reason: "remembered" };
  if (input.remembered === "prerendered-video") return { provider: "prerendered-video", reason: "remembered" };
  return googleReady
    ? { provider: "google-photorealistic", reason: input.remembered === "google-photorealistic" ? "remembered" : "auto" }
    : { provider: "osm-buildings", reason: input.photorealisticConfigured ? "google-unreachable" : "no-credential" };
}

export function needsGoogleProbe(input: {
  preference: GuidedMapPreference;
  webgl: boolean;
  photorealisticConfigured: boolean;
  country?: string | null;
  remembered?: GuidedMapProvider | null;
}): boolean {
  if (!input.webgl || !input.photorealisticConfigured) return false;
  if (input.preference === "prerendered-video" || input.preference === "osm-buildings") return false;
  if (input.preference === "auto" && countrySkipsGoogle(input.country)) return false;
  if (input.preference === "auto" && (input.remembered === "osm-buildings" || input.remembered === "prerendered-video")) return false;
  if (input.preference === "auto" && input.remembered === "google-photorealistic" && input.country && !countrySkipsGoogle(input.country)) return false;
  return true;
}

export function probeUrl(host: string) {
  return `https://${host}/`;
}

/** Any HTTP answer, including 401 or 404, means the host is up. A hang or a network error does not. */
export async function probeGoogleHosts(options?: {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  hosts?: readonly string[];
}): Promise<boolean> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? probeTimeoutMs;
  const hosts = options?.hosts ?? googleProbeHosts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await Promise.any(hosts.map(async host => {
      const response = await fetchImpl(probeUrl(host), {
        method: "GET",
        mode: "no-cors",
        credentials: "omit",
        cache: "no-store",
        redirect: "manual",
        signal: controller.signal,
      });
      if (response.type === "opaque" || response.status > 0) return true;
      throw new Error("no-response");
    }));
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

export async function resolveGuidedProvider(input: {
  preference: GuidedMapPreference;
  webgl: boolean;
  photorealisticConfigured: boolean;
  country?: string | null;
  remembered?: GuidedMapProvider | null;
}, probe: () => Promise<boolean> = () => probeGoogleHosts()): Promise<{ provider: GuidedMapProvider; reason: ProviderReason; probed: boolean }> {
  const probed = needsGoogleProbe(input);
  const rememberedAbroad = input.preference === "auto"
    && input.remembered === "google-photorealistic"
    && Boolean(input.country)
    && !countrySkipsGoogle(input.country)
    && input.photorealisticConfigured
    && input.webgl;
  const googleReachable = probed ? await probe() : rememberedAbroad;
  return { ...chooseGuidedMapProvider({ ...input, googleReachable }), probed };
}

export type ConnectionInfo = { type?: string; saveData?: boolean } | null | undefined;

/** Unknown, missing, cellular, or data-saver is treated as metered. */
export function unmeteredConnection(info: ConnectionInfo): boolean {
  if (!info || info.saveData) return false;
  return info.type === "wifi" || info.type === "ethernet";
}

/**
 * Desktop may preload during the questions.
 * Mobile preloads during the questions only after the first answer, and only on known Wi-Fi or ethernet.
 * A metered or unknown phone waits for an explicit tap after the questions.
 */
export function shouldLoad3D(input: { mobile: boolean; unmetered: boolean; answeredOnce: boolean; asking: boolean; accepted: boolean }) {
  if (!input.mobile) return true;
  if (input.unmetered) return input.answeredOnce || !input.asking;
  return input.accepted && !input.asking;
}

export function downloadConsent(provider: GuidedMapProvider, mobile: boolean) {
  if (provider === "google-photorealistic") {
    const size = mobile ? "大约 10MB" : "大约 27MB";
    return {
      title: `实景三维${size}`,
      action: `查看三维校园 · ${size}`,
      detail: "Google 瓦片按请求计费。画面先停在曼彻斯特的照片上，你点了才下载校园这一片。",
    };
  }
  if (provider === "osm-buildings") {
    return {
      title: "OpenStreetMap 建筑",
      action: "查看三维校园",
      detail: "这一路不经过 Google。用流量时，等你点了再下载校园附近的建筑。",
    };
  }
  return {
    title: "预渲染画面",
    action: "播放校园画面",
    detail: "不请求地图瓦片。没有配置视频时，继续用城市概览照片。",
  };
}

export function mapSourceNotes(active: GuidedMapProvider) {
  const activeLabel = active === "google-photorealistic" ? "Google 实景三维" : active === "osm-buildings" ? "OpenStreetMap 建筑挤出" : "预渲染画面";
  return {
    active: activeLabel,
    google: googleMapResources.map(resource => `${resource.name}（${resource.via}，${resource.hosts.join("、")}）`),
  };
}

export type SchematicBlock = { lng: number; lat: number; size: number; height: number; schematic: true };

/** Low blocks inside the campus frame. Heights are not surveyed. */
export function schematicCampusBlocks(): SchematicBlock[] {
  const seeds: Array<[number, number, number, number]> = [
    [-2.2334, 53.4654, 28, 18],
    [-2.2339, 53.4676, 32, 24],
    [-2.2333, 53.4648, 36, 16],
    [-2.2314, 53.4681, 30, 22],
    [-2.2362, 53.4662, 22, 14],
    [-2.2374, 53.4644, 24, 12],
    [-2.2348, 53.4669, 20, 20],
    [-2.2322, 53.4694, 26, 15],
  ];
  return seeds.map(([lng, lat, size, height]) => ({ lng, lat, size, height, schematic: true as const }));
}
