import type { HistoryEntry, Walk } from "../../../contracts/browser";
import { normalizeTabSettings } from "../domain/settings";
export interface TabState {
  tabHistory?: HistoryEntry[];
  tabHistoryWalk?: Walk | null;
  lastAction?: { command: string; windowId: number; at: number; ids: number[] };
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function ids(value: unknown, limit: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length <= limit &&
    value.every(
      (id: unknown) =>
        typeof id === "number" && Number.isSafeInteger(id) && id >= 0,
    )
  );
}
export async function readSession(
  storage: typeof chrome.storage.session,
  keys: string | string[],
): Promise<TabState> {
  const raw = await storage.get(keys);
  const state: TabState = {};
  const history: unknown = raw.tabHistory;
  if (Array.isArray(history))
    state.tabHistory = history
      .filter(
        (entry: unknown): entry is HistoryEntry =>
          object(entry) &&
          typeof entry.tabId === "number" &&
          Number.isSafeInteger(entry.tabId) &&
          entry.tabId >= 0,
      )
      .slice(0, 32);
  const walk: unknown = raw.tabHistoryWalk;
  if (
    object(walk) &&
    ids(walk.ids, 32) &&
    typeof walk.currentTabId === "number" &&
    Number.isSafeInteger(walk.currentTabId)
  ) {
    const parsed: Walk = {
      ids: [...walk.ids],
      currentTabId: walk.currentTabId,
      index:
        typeof walk.index === "number" && Number.isInteger(walk.index)
          ? walk.index
          : 0,
      windowId: typeof walk.windowId === "number" ? walk.windowId : 0,
      incognito: walk.incognito === true,
    };
    if (object(walk.settings))
      parsed.settings = normalizeTabSettings(walk.settings);
    if (typeof walk.lastStepAt === "number" && Number.isFinite(walk.lastStepAt))
      parsed.lastStepAt = walk.lastStepAt;
    state.tabHistoryWalk = parsed;
  }
  const action: unknown = raw.lastAction;
  if (
    object(action) &&
    typeof action.command === "string" &&
    ids(action.ids, 10000) &&
    typeof action.windowId === "number" &&
    Number.isInteger(action.windowId) &&
    typeof action.at === "number" &&
    Number.isFinite(action.at)
  )
    state.lastAction = {
      command: action.command,
      windowId: action.windowId,
      at: action.at,
      ids: [...action.ids],
    };
  return state;
}
