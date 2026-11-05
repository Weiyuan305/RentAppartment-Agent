/** Keyless liveness check. A hang is a failure. No tile and no ion token is requested. */
export const REACHABILITY_PROBE_MS = 3_000;

export const PHOTOREALISTIC_PROBE_URLS = [
  "https://tile.googleapis.com/",
  "https://api.cesium.com/",
] as const;

/**
 * HEAD both hosts with no API key. `no-cors` still resolves when the connection
 * completes (including a 4xx) and rejects when the host never answers.
 * Either host aborting means photorealistic tiles must not start.
 */
export async function probePhotorealisticHosts(fetchImpl: typeof fetch = fetch, ms = REACHABILITY_PROBE_MS): Promise<boolean> {
  const checks = PHOTOREALISTIC_PROBE_URLS.map(async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      await fetchImpl(url, { method: "HEAD", mode: "no-cors", cache: "no-store", signal: controller.signal });
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  });
  const results = await Promise.all(checks);
  return results.every(Boolean);
}
