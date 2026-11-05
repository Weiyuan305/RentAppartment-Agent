import { NextResponse, type NextRequest } from "next/server";

/**
 * Copy `request.cf.country` onto `cf-ipcountry` when Cloudflare attached the
 * cf object but the header is absent. Does not invent a country, and does not
 * replace a header Cloudflare already set.
 */
export function middleware(request: NextRequest) {
  const cf = Reflect.get(request, "cf") as { country?: unknown } | undefined;
  const fromCf = typeof cf?.country === "string" ? cf.country : null;
  if (!fromCf || request.headers.get("cf-ipcountry")) return NextResponse.next();
  const nextHeaders = new Headers(request.headers);
  nextHeaders.set("cf-ipcountry", fromCf);
  return NextResponse.next({ request: { headers: nextHeaders } });
}

export const config = { matcher: ["/v2", "/v2/:path*"] };
