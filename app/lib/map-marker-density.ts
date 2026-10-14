export type MarkerBounds = { left: number; top: number; right: number; bottom: number };
export type MarkerCandidate = MarkerBounds & { id: string; priority: number; pinned?: boolean };
export function markerOverlaps(a: MarkerBounds, b: MarkerBounds, gap = 8) {
  return a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
}
/** Pinned selection/focus always survives. Others use stable priority and screen-space spacing. */
export function chooseMapMarkers(candidates: MarkerCandidate[], limit: number, gap = 8): Set<string> {
  const kept: MarkerCandidate[] = [];
  for (const item of [...candidates].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.priority - a.priority || a.id.localeCompare(b.id))) {
    if (item.pinned || (kept.length < limit && !kept.some(other => markerOverlaps(item, other, gap)))) kept.push(item);
  }
  return new Set(kept.map(item => item.id));
}
/** Read current occluders when projecting or fitting, without triggering React frame updates. */
export function mapOccluders(canvas: HTMLCanvasElement): MarkerBounds[] {
  const bounds = canvas.getBoundingClientRect(), root = canvas.closest(".concept-lab");
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(".listing-panel,.assistant-panel,.workspace-tools,.workspace-restore,.concept-amenity-disclosure,.map-journey-shell,.map-selected,.map-controls,.map-attribution,.concept-map-title,.map-bottom"))
    .filter(node => node.offsetWidth > 0 && getComputedStyle(node).visibility !== "hidden" && !node.closest("[inert]"))
    .map(node => { const r = node.getBoundingClientRect(); return { left:r.left-bounds.left, top:r.top-bounds.top, right:r.right-bounds.left, bottom:r.bottom-bounds.top }; });
}
export function visibleSidePanel(root: Element | null, selector: string) {
  const node = root?.querySelector<HTMLElement>(selector);
  return node && node.offsetWidth > 0 && !node.inert && getComputedStyle(node).visibility !== "hidden" ? node.getBoundingClientRect() : undefined;
}
