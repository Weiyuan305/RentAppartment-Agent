export type LngLat = { lng: number; lat: number };
export type ScenePadding = { top: number; right: number; bottom: number; left: number };

export type SceneHandle = {
  flyTo(target: LngLat, durationMs: number): void;
  project(target: LngLat): { x: number; y: number } | null;
  setRoute(coordinates: Array<[number, number]>, durationMs: number): void;
  setPadding(padding: ScenePadding): void;
  resize(): void;
  onMove(listener: () => void): () => void;
  destroy(): void;
};
