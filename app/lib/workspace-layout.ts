export const WORKSPACE_STORAGE_KEY = "campus-atlas-workspace-v1";
export type WorkspaceLayout = { list: boolean; chat: boolean; focus: boolean; listWidth: number | null; chatWidth: number | null; preferencesCollapsed: boolean };
export type WorkspaceAction = "list" | "chat" | "focus" | "reset" | "preferences" | { panel: "list" | "chat"; width: number | null };
export const defaultWorkspaceLayout: WorkspaceLayout = { list: true, chat: true, focus: false, listWidth: null, chatWidth: null, preferencesCollapsed: false };
export const MIN_PANEL_WIDTH = 280;
export const MAX_PANEL_WIDTH = 480;
function validWidth(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, value))) : null;
}
export function panelWidths(viewport: number, layout: Pick<WorkspaceLayout, "listWidth" | "chatWidth">) {
  const wide = viewport >= 1500;
  let list = validWidth(layout.listWidth) ?? (wide ? 330 : 306);
  let chat = validWidth(layout.chatWidth) ?? (wide ? 330 : 310);
  // Keep at least 320 px of map between the two panels on the smallest desktop.
  const budget = Math.max(MIN_PANEL_WIDTH * 2, viewport - (wide ? 48 : 40) - 40 - 320);
  const excess = Math.max(0, list + chat - budget);
  list -= Math.min(list - MIN_PANEL_WIDTH, Math.ceil(excess / 2));
  chat = Math.max(MIN_PANEL_WIDTH, Math.min(chat, budget - list));
  list = Math.min(list, budget - chat);
  return { list, chat, budget };
}
export function serializeWorkspaceLayout(layout: WorkspaceLayout) {
  return JSON.stringify({ version: 2, list:layout.list, chat:layout.chat, listWidth:layout.listWidth, chatWidth:layout.chatWidth, preferencesCollapsed:layout.preferencesCollapsed });
}
export function readWorkspaceLayout(raw: string | null): WorkspaceLayout {
  try {
    const value = JSON.parse(raw ?? "null");
    if ([1, 2].includes(value?.version) && typeof value.list === "boolean" && typeof value.chat === "boolean")
      return { ...defaultWorkspaceLayout, list: value.list, chat: value.chat,
        ...(value.version === 2 ? { listWidth: validWidth(value.listWidth), chatWidth: validWidth(value.chatWidth), preferencesCollapsed: value.preferencesCollapsed === true } : {}) };
  } catch {}
  return { ...defaultWorkspaceLayout };
}
export function workspaceTransition(state: WorkspaceLayout, action: WorkspaceAction): WorkspaceLayout {
  if (action === "reset") return { ...defaultWorkspaceLayout };
  if (typeof action === "object") return { ...state, [`${action.panel}Width`]: validWidth(action.width) };
  if (action === "preferences") return { ...state, preferencesCollapsed: !state.preferencesCollapsed };
  if (action === "focus") return { ...state, focus: !state.focus };
  return { ...state, focus: false, [action]: state.focus || !state[action] };
}
export function visibleWorkspacePanels(state: WorkspaceLayout) {
  return { list: state.list && !state.focus, chat: state.chat && !state.focus };
}
