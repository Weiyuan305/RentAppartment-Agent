// HTML and its content-hashed modules must follow the same live Worker release.
// Pages may still have the previous release while the Worker is being updated.
function usableAsset(response, pathname) {
  if (response.status === 304) return true;
  if (!response.ok) return false;
  const type = response.headers.get("Content-Type") || "";
  if (/\.m?js$/.test(pathname)) return /^(application|text)\/(javascript|ecmascript)\b/i.test(type);
  if (/\.css$/.test(pathname)) return /^text\/css\b/i.test(type);
  return !/^text\/html\b/i.test(type);
}

const pagesEntry = {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (!pathname.startsWith("/_next/static/") || !["GET", "HEAD"].includes(request.method)) {
      // Never retry a chat/auth mutation or buffer streaming API responses.
      return env.ATLAS_APP.fetch(request);
    }

    let allMissing = true;
    for (const [source, binding] of [["worker", env.ATLAS_APP], ["pages-fallback", env.ASSETS]]) {
      try {
        const response = await binding.fetch(request);
        if (usableAsset(response, pathname)) {
          const headers = new Headers(response.headers);
          headers.set("X-Atlas-Asset-Source", source);
          headers.set("X-Content-Type-Options", "nosniff");
          return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
        }
        allMissing &&= response.status === 404;
        await response.body?.cancel();
      } catch {
        allMissing = false;
      }
    }
    console.warn("atlas_asset_unavailable", pathname);
    // Do not let an HTML fallback or transient failure poison the immutable
    // module cache. Both origins must have failed before returning an error.
    return new Response(request.method === "HEAD" ? null : "Asset unavailable", {
      status: allMissing ? 404 : 503,
      headers: {"Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff"},
    });
  },
};

export default pagesEntry;
