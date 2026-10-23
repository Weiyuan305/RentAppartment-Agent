/** Live overseas calls hang in mainland China more often than they fail. */
export const OVERSEAS_FAILFAST_MS = 6_000;

/** Switch away if the first photorealistic tile has not arrived in 8s. */
export const GOOGLE_FIRST_TILE_MS = 8_000;

export function failFastSignal(parent?: AbortSignal, ms = OVERSEAS_FAILFAST_MS) {
  const timeout = AbortSignal.timeout(ms);
  return parent ? AbortSignal.any([parent, timeout]) : timeout;
}

/**
 * Domains a provider may contact. The self-hosted massing provider is
 * same-origin only: no Cesium ion, no Google tiles, no Overpass at runtime.
 */
export const providerExternalDomains = {
  "google-photorealistic": [
    { host: "tile.googleapis.com", blocksInChina: true, billedPerRequest: true, note: "Photorealistic 3D tiles. QA cold cache: about 466 requests and 27.5MB." },
    { host: "api.cesium.com", blocksInChina: true, billedPerRequest: false, note: "Ion token exchange for asset 2275207. Only after this provider is explicitly started." },
    { host: "assets.ion.cesium.com", blocksInChina: true, billedPerRequest: false, note: "Ion credit logo. The viewer does not wait on it." },
  ],
  "osm-buildings": [] as { host: string; blocksInChina: boolean; billedPerRequest: boolean; note: string }[],
  aerial: [] as { host: string; blocksInChina: boolean; billedPerRequest: boolean; note: string }[],
} as const;

/** Not map providers. Runtime reads local files; these hosts are the live fallbacks. */
export const otherOverseasEndpoints = [
  { host: "valhalla1.openstreetmap.de", usedAtRuntime: false, note: "Walking-route collection scripts only. /v2 and the campus signposts read precomputed /routes, /campus-routes, and campus-commutes.json." },
  { host: "routing.openstreetmap.de", usedAtRuntime: true, note: "Live amenity walk when no saved route exists. Aborts at 6s. Saved commute numbers stay on screen." },
  { host: "overpass-api.de", usedAtRuntime: false, note: "Amenity collection only. The browser reads /amenities/{city}.json and gives up after 6s if that file stalls." },
  { host: "overpass.private.coffee", usedAtRuntime: false, note: "Alternate Overpass mirror used by the collection script, not by the page." },
  { host: "maps.mail.ru", usedAtRuntime: false, note: "Alternate Overpass mirror used by the collection script, not by the page." },
] as const;
