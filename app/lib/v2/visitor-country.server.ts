import { headers } from "next/headers";
import { GEO_OVERRIDE_ENV, geoQueryAllowed, resolveVisitorCountry, type VisitorCountry } from "./visitor-country";

/** Server read of Cloudflare country. Safe to call from a server component. */
export async function readVisitorCountry(geoQuery?: string | null): Promise<VisitorCountry> {
  const requestHeaders = await headers();
  return resolveVisitorCountry({
    cfCountry: await countryFromWorkersRequest(),
    cfIpCountry: requestHeaders.get("cf-ipcountry"),
    geoQuery,
    allowGeoQuery: geoQueryAllowed({
      nodeEnv: process.env.NODE_ENV,
      overrideFlag: process.env[GEO_OVERRIDE_ENV] ?? process.env.V2_GEO_OVERRIDE ?? null,
    }),
  });
}

/**
 * `request.cf.country` on the Workers request, when this render can see it.
 * vinext keeps `cf` on the request object. The header remains the fallback.
 */
async function countryFromWorkersRequest(): Promise<string | null> {
  try {
    const { getRequestContext, isInsideUnifiedScope } = await import("vinext/shims/unified-request-context");
    if (!isInsideUnifiedScope()) return null;
    const context = getRequestContext() as unknown as Record<string, unknown>;
    const request = context.request;
    if (!request || typeof request !== "object") return null;
    const cf = Reflect.get(request, "cf") as { country?: unknown } | undefined;
    return typeof cf?.country === "string" ? cf.country : null;
  } catch {
    return null;
  }
}
