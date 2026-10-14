"use client";
import { useEffect, useRef, type RefObject } from "react";
import { MIN_PANEL_WIDTH, MAX_PANEL_WIDTH } from "@/lib/workspace-layout";
import { useLocale } from "./locale-provider";

export function WorkspaceResizeHandle({panel, width, limit, root, onCommit}: {
  panel: "list" | "chat"; width: number; limit: number;
  root: RefObject<HTMLElement | null>; onCommit: (width: number | null) => void;
}) {
  const {locale} = useLocale();
  const drag = useRef<{x: number; start: number; value: number} | null>(null);
  const frame = useRef(0);
  const max = Math.min(MAX_PANEL_WIDTH, limit);
  const clamp = (value: number) => Math.round(Math.max(MIN_PANEL_WIDTH, Math.min(max, value)));
  const label = locale === "zh" ? (panel === "list" ? "调整房源列表宽度" : "调整助手宽度") : (panel === "list" ? "Resize home list" : "Resize assistant");
  function paint(value: number) {
    root.current?.style.setProperty(`--panel-${panel}-width`, `${value}px`);
    window.dispatchEvent(new Event("atlas-workspace-layout"));
  }
  function finish(commit: boolean) {
    if (!drag.current) return;
    cancelAnimationFrame(frame.current);
    const value = commit ? drag.current.value : drag.current.start;
    drag.current = null;
    root.current?.classList.remove("is-resizing-panels");
    paint(value);
    if (commit) onCommit(value);
  }
  useEffect(() => {
    const element = root.current;
    return () => { cancelAnimationFrame(frame.current); element?.classList.remove("is-resizing-panels"); };
  }, [root]);
  return <div className={`workspace-resizer resizer-${panel}`} role="separator" aria-orientation="vertical"
    aria-label={label} aria-controls={panel === "list" ? "workspace-list" : "workspace-chat"}
    aria-valuemin={MIN_PANEL_WIDTH} aria-valuemax={max} aria-valuenow={width}
    title={locale === "zh" ? `${label} · 方向键微调，双击复原` : `${label} · Arrow keys to adjust, double-click to reset`}
    tabIndex={0} onDoubleClick={() => onCommit(null)}
    onKeyDown={event => {
      if (event.key === "Escape") { finish(false); return; }
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const delta = (event.key === "ArrowRight" ? 1 : -1) * (panel === "list" ? 1 : -1) * (event.shiftKey ? 32 : 8);
      onCommit(event.key === "Home" ? MIN_PANEL_WIDTH : event.key === "End" ? max : clamp(width + delta));
    }}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = {x: event.clientX, start: width, value: width};
      root.current?.classList.add("is-resizing-panels");
    }}
    onPointerMove={event => {
      const current = drag.current; if (!current) return;
      current.value = clamp(current.start + (event.clientX - current.x) * (panel === "list" ? 1 : -1));
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => paint(current.value));
    }} onPointerUp={() => finish(true)} onPointerCancel={() => finish(false)} onLostPointerCapture={() => finish(false)}><span/></div>;
}
