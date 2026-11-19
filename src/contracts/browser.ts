export interface Tab extends chrome.tabs.Tab {
  id: number;
  url: string;
}
export interface BrowserWindow extends chrome.windows.Window {
  id: number;
}
export interface CommandContext {
  window: BrowserWindow;
  tabs: Tab[];
  active?: Tab | undefined;
  selected: Tab[];
}
export type CommandHandler = (
  context: CommandContext,
  granted?: boolean,
  invokedTab?: chrome.tabs.Tab,
) => Promise<unknown>;
export interface HistoryEntry {
  tabId: number;
  windowId?: number;
  incognito?: boolean;
}
export interface TabSettings {
  resetAfterPause: boolean;
  pauseMs: number;
  includeOtherWindows: boolean;
  wrap: boolean;
  rememberPreviews: boolean;
}
export interface Walk {
  ids: number[];
  index: number;
  currentTabId: number;
  incognito: boolean;
  windowId: number;
  settings?: TabSettings;
  lastStepAt?: number;
}
