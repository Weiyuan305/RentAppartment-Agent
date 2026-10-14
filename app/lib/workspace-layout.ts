export const WORKSPACE_STORAGE_KEY = "campus-atlas-workspace-v1";
export type WorkspaceLayout = { list: boolean; chat: boolean; focus: boolean };
export type WorkspaceAction = "list" | "chat" | "focus" | "reset";
export const defaultWorkspaceLayout: WorkspaceLayout = { list: true, chat: true, focus: false };
export function readWorkspaceLayout(raw: string | null): WorkspaceLayout {
  try {
    const value = JSON.parse(raw ?? "null");
    if (value?.version === 1 && typeof value.list === "boolean" && typeof value.chat === "boolean")
      return { list: value.list, chat: value.chat, focus: false };
  } catch {}
  return { ...defaultWorkspaceLayout };
}
export function workspaceTransition(state: WorkspaceLayout, action: WorkspaceAction): WorkspaceLayout {
  if (action === "reset") return { ...defaultWorkspaceLayout };
  if (action === "focus") return { ...state, focus: !state.focus };
  return { ...state, focus: false, [action]: state.focus || !state[action] };
}
export function visibleWorkspacePanels(state: WorkspaceLayout) {
  return { list: state.list && !state.focus, chat: state.chat && !state.focus };
}
