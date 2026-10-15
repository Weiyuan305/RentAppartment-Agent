export type MarkerBounds = { left: number; top: number; right: number; bottom: number };
export type MarkerCandidate = MarkerBounds & { id: string; priority: number; pinned?: boolean };
export function markerOverlaps(a: MarkerBounds, b: MarkerBounds, gap = 8) {
  return a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
}
export type LabelOffset = {x: number; y: number};
/** Place a selected label using the same screen-space bounds as collision checks. */
export function placeMapLabel(box: MarkerBounds, frame: MarkerBounds, obstacles: MarkerBounds[], previous?: LabelOffset): LabelOffset | null {
  const width=box.right-box.left, height=box.bottom-box.top, gap=10;
  if(width>frame.right-frame.left || height>frame.bottom-frame.top)return null;
  const clamp=(left:number,top:number)=>({x:Math.max(frame.left,Math.min(left,frame.right-width))-box.left,y:Math.max(frame.top,Math.min(top,frame.bottom-height))-box.top});
  const candidates:LabelOffset[]=[{x:0,y:0},...(previous?[previous]:[]),clamp(box.left,box.top)];
  for(const block of obstacles) {
    candidates.push(clamp(box.left,block.top-height-gap),clamp(box.left,block.bottom+gap),clamp(block.left-width-gap,box.top),clamp(block.right+gap,box.top));
  }
  // Corners provide a deterministic fallback when several controls meet.
  for(const x of [frame.left,frame.right-width])for(const y of [frame.top,frame.bottom-height])candidates.push(clamp(x,y));
  return candidates.find(({x,y})=>{
    const moved={left:box.left+x,right:box.right+x,top:box.top+y,bottom:box.bottom+y};
    return moved.left>=frame.left && moved.right<=frame.right && moved.top>=frame.top && moved.bottom<=frame.bottom && !obstacles.some(other=>markerOverlaps(moved,other,6));
  })??null;
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
  return Array.from(root.querySelectorAll<HTMLElement>(".listing-panel,.assistant-panel,.workspace-tools,.workspace-restore,.concept-amenity-disclosure,.map-journey-shell,.map-selected,.map-controls,.map-area-search,.map-attribution,.concept-map-title,.map-bottom"))
    .filter(node => node.offsetWidth > 0 && getComputedStyle(node).visibility !== "hidden" && !node.closest("[inert]"))
    .map(node => { const r = node.getBoundingClientRect(); return { left:r.left-bounds.left, top:r.top-bounds.top, right:r.right-bounds.left, bottom:r.bottom-bounds.top }; });
}
export function visibleSidePanel(root: Element | null, selector: string) {
  const node = root?.querySelector<HTMLElement>(selector);
  return node && node.offsetWidth > 0 && !node.inert && getComputedStyle(node).visibility !== "hidden" ? node.getBoundingClientRect() : undefined;
}
