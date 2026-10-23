import { CAMPUS_VIEW } from "@/lib/v2/map-provider";
import type { MapHost, MapSession } from "./types";

/**
 * Prerendered stills. A home clip at /v2/aerial/{id}.mp4 is used when it exists;
 * otherwise the listing photos already shipped with the app. No tile requests.
 */
export async function probeAerial(listingId: string) {
  const video = `/v2/aerial/${encodeURIComponent(listingId)}.mp4`;
  const response = await fetch(video, { method: "HEAD" }).catch(() => null);
  return response?.ok ? video : null;
}

export function startAerial(host: MapHost): MapSession {
  host.canvas.replaceChildren();
  host.credits.textContent = "预渲染画面 · 不请求实景瓦片";
  host.onProgress({ loaded: 1, pending: 0, approxBytes: 0, label: "使用已有城市照片" });
  const frame = document.createElement("div");
  frame.className = "v2-aerial-frame";
  host.canvas.appendChild(frame);
  return {
    id: "aerial",
    flyTo() { /* The stage crossfades the selected home's still. */ },
    setRoute() {},
    project(lng, lat) {
      const width = host.canvas.clientWidth || 1;
      const height = host.canvas.clientHeight || 1;
      return projectStill(lng, lat, width, height);
    },
    highlightBuilding() {},
    nearestBuildingId() { return null; },
    destroy() { frame.remove(); },
  };
}

export function projectStill(lng: number, lat: number, width: number, height: number) {
  const scale = Math.min(width, height) * 16;
  return {
    x: width / 2 + (lng - CAMPUS_VIEW.lng) * scale,
    y: height / 2 - (lat - CAMPUS_VIEW.lat) * scale * 1.55,
  };
}
