import type { MapProviderId } from "@/lib/v2/map-provider";
import type { MapHost, MapSession } from "./types";

export type { MapSession } from "./types";

/** Isolated entry. A Google failure never leaves the caller without a provider. */
export async function startMapProvider(id: MapProviderId, host: MapHost): Promise<MapSession> {
  if (id === "aerial") {
    const { startAerial } = await import("./aerial");
    return startAerial(host);
  }
  if (id === "google-photorealistic") {
    const { probeWebgl } = await import("@/lib/v2/map-engine");
    if (probeWebgl() !== "ok") return (await import("./osm-buildings")).startOsmBuildings(host);
    try {
      return await (await import("./google-photorealistic")).startGooglePhotorealistic(host);
    } catch {
      return (await import("./osm-buildings")).startOsmBuildings(host);
    }
  }
  return (await import("./osm-buildings")).startOsmBuildings(host);
}
