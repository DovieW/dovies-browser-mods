import { listenerScope } from "../../../platform/chrome/listeners";
export function popupBrowser() {
  const scope = listenerScope();
  return {
    commands: () => chrome.commands.getAll(),
    send: async (message: Record<string, unknown>): Promise<unknown> =>
      chrome.runtime.sendMessage({ target: "background", ...message }),
    editKeys: () =>
      chrome.tabs.create({ url: "chrome://extensions/shortcuts" }),
    platform: () => chrome.runtime.getPlatformInfo(),
    lastError: () =>
      chrome.storage.session.get<{
        lastError?: { command: string; code: string };
      }>("lastError"),
    watchSync: (
      callback: (
        changes: Record<string, chrome.storage.StorageChange>,
        area: string,
      ) => void,
    ) => {
      scope.listen(chrome.storage.onChanged, callback);
    },
    dispose: () => {
      scope.dispose();
    },
  };
}
