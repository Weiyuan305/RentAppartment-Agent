"use client";

import { useEffect } from "react";
import { inputRevealDelta, inputViewportFrame } from "@/lib/input-viewport";

function revealField(field: HTMLElement, top: number, height: number) {
  const bounds = field.getBoundingClientRect();
  for (let parent = field.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    if (!/auto|scroll/.test(getComputedStyle(parent).overflowY) || parent.scrollHeight <= parent.clientHeight) continue;
    const pane = parent.getBoundingClientRect();
    parent.scrollTop += inputRevealDelta(bounds.top, bounds.bottom, Math.max(top, pane.top) + 8, Math.min(top + height, pane.bottom) - 8);
    return;
  }
  const delta = inputRevealDelta(bounds.top, bounds.bottom, top + 12, top + height - 12);
  if (delta) window.scrollBy({ top: delta, behavior: "instant" });
}

/** Keep app chrome and portaled dialogs inside the area above the mobile keyboard. */
export function InputViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const mobile = window.matchMedia("(max-width: 1100px)");
    const viewport = window.visualViewport;
    let frame = 0;
    let revealFrame = 0;
    let lastHeight = 0;
    let lastField: Element | null = null;
    const clear = () => {
      root.style.removeProperty("--input-viewport-height");
      root.style.removeProperty("--input-viewport-top");
      root.removeAttribute("data-compact-input");
    };
    const update = () => {
      if (!mobile.matches) { clear(); lastHeight = 0; lastField = null; return; }
      const active = document.activeElement;
      const editing = active instanceof HTMLElement && active.matches('textarea:not(:disabled):not([readonly]),input:not(:disabled):not([readonly]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]),[contenteditable="true"]');
      const next = inputViewportFrame(viewport ?? { height: window.innerHeight, offsetTop: 0, scale: 1 }, editing);
      // Do not reflow the page under a pinch-to-zoom gesture.
      if (!next) return;
      root.style.setProperty("--input-viewport-height", `${next.height}px`);
      root.style.setProperty("--input-viewport-top", `${next.top}px`);
      root.toggleAttribute("data-compact-input", next.compact);
      // Recheck after layout only on focus or a shrinking viewport. Ordinary user
      // scrolling must never snap back to the focused field.
      if (editing && (active !== lastField || next.height < lastHeight - 1)) {
        cancelAnimationFrame(revealFrame);
        revealFrame = requestAnimationFrame(() => {
          if (document.activeElement === active) revealField(active, next.top, next.height);
        });
      }
      lastHeight = next.height;
      lastField = editing ? active : null;
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(revealFrame);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      clear();
    };
  }, []);
  return null;
}
