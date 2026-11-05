import type { MapProviderId, ViewportKind } from "@/lib/v2/map-provider";

export type MapProgress = { loaded: number; pending: number; approxBytes: number; label: string };

export type MapHost = {
  canvas: HTMLElement;
  credits: HTMLElement;
  viewport: ViewportKind;
  reducedMotion: boolean;
  onProgress: (progress: MapProgress) => void;
};

export type CameraTarget = { lng: number; lat: number; altitude: "overview" | "campus" | "home" };

export type MapSession = {
  id: MapProviderId;
  flyTo: (target: CameraTarget) => void;
  setRoute: (coordinates: [number, number][] | null) => void;
  project: (lng: number, lat: number) => { x: number; y: number } | null;
  /** Whole-building highlight. `id` matches FALLBACK_CITY_MODEL.idProperty. Null clears it. */
  highlightBuilding: (id: string | null) => void;
  nearestBuildingId: (lng: number, lat: number) => string | null;
  destroy: () => void;
};
