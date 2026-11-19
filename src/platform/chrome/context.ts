import { present } from "../../core/present";
import type { BrowserPort } from "./browser";
import { commandError } from "../../core/actions/errors";
export function createContextService(
  chrome: Pick<BrowserPort, "tabs" | "windows">,
) {
  async function normalWindows() {
    return (await chrome.windows.getAll({ windowTypes: ["normal"] })).filter(
      (window) => window.type === "normal",
    );
  }

  async function resolveWindow() {
    const windows = await normalWindows();
    if (!windows.length) throw commandError("no_window");
    const focused = windows.filter((window) => window.focused);
    if (focused.length === 1) return present(focused[0]);
    // Chrome maintains focus order, including across worker restarts.
    // During a cross-window transition snapshots can mark both windows focused.
    const lastFocused = await chrome.windows.getLastFocused({
      windowTypes: ["normal"],
    });
    const window =
      windows.find((window) => window.id === lastFocused.id) || windows[0];
    if (!window) throw commandError("no_window");
    return window;
  }

  async function commandContext() {
    const window = await resolveWindow();
    await chrome.windows.update(window.id, { focused: true });
    const tabs = await chrome.tabs.query({ windowId: window.id });
    tabs.sort((a, b) => a.index - b.index);
    return {
      window,
      tabs,
      active: tabs.find((tab) => tab.active),
      selected: tabs.filter((tab) => tab.highlighted),
    };
  }

  async function safeGetTab(id: number) {
    try {
      return await chrome.tabs.get(id);
    } catch {
      return null;
    }
  }
  return { normalWindows, resolveWindow, commandContext, safeGetTab };
}
