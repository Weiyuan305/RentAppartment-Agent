import { cityPhoto } from "../rental-data";

/** Swappable 3D sources. Google tiles are opt-in because each request is billed. */
export const MAP_PROVIDER_IDS = ["google-photorealistic", "osm-buildings", "aerial"] as const;
export type MapProviderId = (typeof MAP_PROVIDER_IDS)[number];

/** Coarse on purpose. The current home uses 12 and pulls hundreds of tiles. */
export const GOOGLE_TILE_BYTES = 180 * 1024;
export const PHOTO_TILE_TIMEOUT_MS = 8_000;

/**
 * Self-hosted city model. One URL. Today it is OSM extrusions for the
 * Oxford Road area. A later 3D Tiles model (OSM footprints + EA LiDAR via
 * pg2b3dm) replaces `url` only. `idProperty` is the per-building highlight key.
 */
export const FALLBACK_CITY_MODEL = {
  url: "/v2/manchester-massing.geojson",
  idProperty: "id",
} as const;

export const MAP_PROVIDER_STORAGE_KEY = "atlas-v2-map-provider";

export const CAMPUS_VIEW = { lng: -2.2349, lat: 53.4668, height: 900, pitchDeg: -48 };

export type ViewportKind = "desktop" | "mobile";

export function googleTileBudget(viewport: ViewportKind) {
  if (viewport === "mobile") {
    return {
      maxRequests: 40,
      maxBytes: 40 * GOOGLE_TILE_BYTES,
      screenSpaceError: 32,
      cacheBytes: 16 * 1024 * 1024,
      overflowBytes: 4 * 1024 * 1024,
    };
  }
  return {
    maxRequests: 80,
    maxBytes: 80 * GOOGLE_TILE_BYTES,
    screenSpaceError: 24,
    cacheBytes: 24 * 1024 * 1024,
    overflowBytes: 8 * 1024 * 1024,
  };
}

export const GOOGLE_MAP_RESOURCES = [
  {
    id: "cesium-ion-2275207",
    name: "Google Photorealistic 3D Tiles",
    via: "CesiumJS Cesium3DTileset.fromIonAssetId(2275207)",
    dependsOnGoogle: true,
  },
  {
    id: "google-map-tiles",
    name: "Google Map Tiles API",
    via: "CesiumJS createGooglePhotorealistic3DTileset",
    dependsOnGoogle: true,
  },
] as const;

export const KEY_FREE_MAP_RESOURCES = [
  { id: "overview-image", name: "City overview photo", via: cityPhoto("manchester"), dependsOnGoogle: false },
  { id: "osm-massing", name: "OpenStreetMap building footprints", via: FALLBACK_CITY_MODEL.url, dependsOnGoogle: false },
  { id: "maplibre", name: "MapLibre fill-extrusion", via: "local GeoJSON, no tile CDN", dependsOnGoogle: false },
  { id: "aerial", name: "Prerendered listing photos", via: "/photos and /v2/aerial if present", dependsOnGoogle: false },
] as const;

export type ConnectionSnapshot = { saveData: boolean; unmetered: boolean; type: string };

export function connectionFromNavigator(nav: { connection?: { saveData?: boolean; type?: string } } | null | undefined): ConnectionSnapshot {
  const connection = nav?.connection;
  if (!connection) return { saveData: false, unmetered: false, type: "unknown" };
  const type = connection.type || "unknown";
  const saveData = Boolean(connection.saveData);
  const unmetered = !saveData && (type === "wifi" || type === "ethernet");
  return { saveData, unmetered, type };
}

export function resolveMapProviderId(input: { configured?: string | null; query?: string | null; googleFailed?: boolean }): MapProviderId {
  const query = input.query?.trim();
  const configured = input.configured?.trim();
  const requested = (MAP_PROVIDER_IDS as readonly string[]).includes(query ?? "") ? query : configured || "auto";
  if (input.googleFailed && (requested === "auto" || requested === "google-photorealistic")) return "osm-buildings";
  if (requested === "google-photorealistic" || requested === "osm-buildings" || requested === "aerial") return requested;
  // `auto` must not bill every visitor for Google tiles. Massing is the default city.
  return "osm-buildings";
}

export type ProviderChoice = {
  provider: MapProviderId;
  probeGoogle: boolean;
  reason: "country-cn" | "query" | "stored" | "configured" | "default";
};

function knownProvider(value: string | null | undefined): MapProviderId | null {
  const trimmed = value?.trim() ?? "";
  return (MAP_PROVIDER_IDS as readonly string[]).includes(trimmed) ? trimmed as MapProviderId : null;
}

/**
 * CN never auto-starts Google or ion, even if a previous visit stored that
 * choice or `?map=google-photorealistic` is present. A manual switch is a
 * separate call and may still probe. Outside CN, a stored or configured
 * photorealistic choice probes for 3s before any tile request.
 */
export function selectMapProvider(input: {
  country?: string | null;
  query?: string | null;
  stored?: string | null;
  configured?: string | null;
}): ProviderChoice {
  const cn = input.country?.trim().toUpperCase() === "CN";
  const query = knownProvider(input.query);
  const stored = knownProvider(input.stored);
  const configured = knownProvider(input.configured);
  if (cn && query === "google-photorealistic") return { provider: "osm-buildings", probeGoogle: false, reason: "country-cn" };
  if (query) return { provider: query, probeGoogle: query === "google-photorealistic", reason: "query" };
  if (cn) {
    const provider = stored && stored !== "google-photorealistic" ? stored : "osm-buildings";
    return { provider, probeGoogle: false, reason: "country-cn" };
  }
  if (stored) return { provider: stored, probeGoogle: stored === "google-photorealistic", reason: "stored" };
  if (configured) return { provider: configured, probeGoogle: configured === "google-photorealistic", reason: "configured" };
  return { provider: "osm-buildings", probeGoogle: false, reason: "default" };
}

export function readStoredProvider(storage: { getItem(key: string): string | null } | null): MapProviderId | null {
  try {
    return knownProvider(storage?.getItem(MAP_PROVIDER_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredProvider(storage: { setItem(key: string, value: string): void } | null, id: MapProviderId) {
  try { storage?.setItem(MAP_PROVIDER_STORAGE_KEY, id); } catch { /* private mode */ }
}

export type LoadDecision = {
  start: boolean;
  provider: MapProviderId;
  reason: "user-requested" | "desktop-after-interactive" | "mobile-unmetered" | "wait-until-interactive" | "mobile-needs-tap" | "save-data";
  approximateMegabytes: number;
};

export function approximateMegabytes(provider: MapProviderId, viewport: ViewportKind) {
  if (provider === "google-photorealistic") return viewport === "mobile" ? 10 : 14;
  if (provider === "osm-buildings") return 0.3;
  return 0;
}

/**
 * Overview image is always the first frame.
 * Desktop may start 3D only after the page is interactive.
 * Mobile starts 3D on its own only on Wi-Fi/unmetered links; otherwise a tap.
 * Google tiles follow the same gate and are never the default provider.
 */
export function decide3DLoad(input: {
  provider: MapProviderId;
  viewport: ViewportKind;
  interactive: boolean;
  connection: ConnectionSnapshot;
  userRequested: boolean;
}): LoadDecision {
  const approximate = approximateMegabytes(input.provider, input.viewport);
  if (input.userRequested) return { start: true, provider: input.provider, reason: "user-requested", approximateMegabytes: approximate };
  if (input.connection.saveData) return { start: false, provider: input.provider, reason: "save-data", approximateMegabytes: approximate };
  if (!input.interactive) return { start: false, provider: input.provider, reason: "wait-until-interactive", approximateMegabytes: approximate };
  if (input.viewport === "desktop") return { start: true, provider: input.provider, reason: "desktop-after-interactive", approximateMegabytes: approximate };
  if (input.connection.unmetered) return { start: true, provider: input.provider, reason: "mobile-unmetered", approximateMegabytes: approximate };
  return { start: false, provider: input.provider, reason: "mobile-needs-tap", approximateMegabytes: approximate };
}

export function overviewStillVisible(phase: "photo" | "loading" | "ready") {
  return phase !== "ready";
}

export type V2MapPerf = {
  overviewMs: number | null;
  readyMs: number | null;
  provider: MapProviderId | "photo";
  reason: string;
  googleRequests: number;
  bytes: number;
  requests: number;
};

declare global {
  interface Window {
    __v2MapPerf?: V2MapPerf;
  }
}
