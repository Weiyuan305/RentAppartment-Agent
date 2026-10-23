/** Cloudflare country codes that mean "unknown", not a country. */
const UNKNOWN_COUNTRY = new Set(["XX", "T1"]);

/**
 * `?geo=CN` is a QA stand-in for the Cloudflare country check.
 * Dev servers allow it. Production ignores it unless VITE_V2_GEO_OVERRIDE=1
 * (or V2_GEO_OVERRIDE=1) is set on the server. The flag is not a secret and
 * is unset in this repo.
 */
export const GEO_OVERRIDE_ENV = "VITE_V2_GEO_OVERRIDE";

export type CountrySource = "query" | "cf" | "header" | "unknown";

export type VisitorCountry = { country: string | null; source: CountrySource };

export function geoQueryAllowed(env: { nodeEnv?: string | null; overrideFlag?: string | null }) {
  if (env.overrideFlag === "1") return true;
  return env.nodeEnv !== "production";
}

export function normalizeCountry(value: string | null | undefined): string | null {
  const code = value?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{2}$/.test(code) || UNKNOWN_COUNTRY.has(code)) return null;
  return code;
}

/**
 * Mainland China wins before any photorealistic host is contacted.
 * `request.cf.country` is preferred over the header when both are present.
 * The geo query is only consulted when `allowGeoQuery` is true.
 */
export function resolveVisitorCountry(input: {
  cfCountry?: string | null;
  cfIpCountry?: string | null;
  geoQuery?: string | null;
  allowGeoQuery: boolean;
}): VisitorCountry {
  if (input.allowGeoQuery) {
    const override = normalizeCountry(input.geoQuery);
    if (override) return { country: override, source: "query" };
  }
  const cf = normalizeCountry(input.cfCountry);
  if (cf) return { country: cf, source: "cf" };
  const header = normalizeCountry(input.cfIpCountry);
  if (header) return { country: header, source: "header" };
  return { country: null, source: "unknown" };
}

export function countryBlocksPhotorealistic(country: string | null | undefined) {
  return normalizeCountry(country) === "CN";
}
