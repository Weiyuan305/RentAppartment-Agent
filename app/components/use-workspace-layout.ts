"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { defaultWorkspaceLayout, readWorkspaceLayout, visibleWorkspacePanels, workspaceTransition, WORKSPACE_STORAGE_KEY, type WorkspaceAction } from "@/lib/workspace-layout";
function subscribe(callback: () => void) {
  const media = window.matchMedia("(min-width: 1101px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
export function useWorkspaceLayout() {
  const desktop = useSyncExternalStore(subscribe, () => window.matchMedia("(min-width: 1101px)").matches, () => false);
  const [layout, setLayout] = useState(defaultWorkspaceLayout);
  useEffect(() => {
    // Hydrate browser-only preferences after SSR. No rental or chat state is stored here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setLayout(readWorkspaceLayout(localStorage.getItem(WORKSPACE_STORAGE_KEY))); } catch {}
  }, []);
  function dispatch(action: WorkspaceAction) {
    setLayout(previous => {
      const next = workspaceTransition(previous, action);
      try { localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ version: 1, list: next.list, chat: next.chat })); } catch {}
      return next;
    });
  }
  const panels = visibleWorkspacePanels(layout);
  return { layout, dispatch, desktop, listHidden: desktop && !panels.list, chatHidden: desktop && !panels.chat };
}
