type ViewportMetrics = { height: number; offsetTop: number; scale: number };

/** Keyboard resize and pinch zoom both change VisualViewport; only follow the former. */
export function inputViewportFrame(viewport: ViewportMetrics, editing: boolean) {
  if (!Number.isFinite(viewport.scale) || Math.abs(viewport.scale - 1) > 0.05 || !Number.isFinite(viewport.height) || viewport.height <= 0 || !Number.isFinite(viewport.offsetTop)) return null;
  return {
    height: Math.round(viewport.height),
    top: Math.max(0, Math.round(viewport.offsetTop)),
    compact: editing && viewport.height < 560,
  };
}

/** Reveal a field using the smallest scroll, aligning tall textareas at the top. */
export function inputRevealDelta(top: number, bottom: number, visibleTop: number, visibleBottom: number) {
  if (visibleBottom <= visibleTop) return 0;
  if (top < visibleTop) return top - visibleTop;
  if (bottom > visibleBottom) return Math.min(bottom - visibleBottom, top - visibleTop);
  return 0;
}
