"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { defaultWorkspaceLayout, panelWidths, serializeWorkspaceLayout, readWorkspaceLayout, visibleWorkspacePanels, workspaceTransition, WORKSPACE_STORAGE_KEY, type WorkspaceAction } from "@/lib/workspace-layout";
function subscribe(callback: () => void) {
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}
export function useWorkspaceLayout() {
  const viewport = useSyncExternalStore(subscribe, () => window.innerWidth, () => 1280);
  const desktop = viewport > 1100;
  const [layout, setLayout] = useState(defaultWorkspaceLayout);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // Hydrate browser-only preferences after SSR. No rental or chat state is stored here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setLayout(readWorkspaceLayout(localStorage.getItem(WORKSPACE_STORAGE_KEY))); } catch {}
    setHydrated(true);
  }, []);
  function dispatch(action: WorkspaceAction) {
    setLayout(previous => {
      const next = workspaceTransition(previous, action);
      try { localStorage.setItem(WORKSPACE_STORAGE_KEY, serializeWorkspaceLayout(next)); } catch {}
      return next;
    });
  }
  const panels = visibleWorkspacePanels(layout);
  return { layout, dispatch, desktop, hydrated, widths: panelWidths(viewport, layout), listHidden: desktop && !panels.list, chatHidden: desktop && !panels.chat };
}
