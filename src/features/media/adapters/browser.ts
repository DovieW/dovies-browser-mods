import { listenerScope } from "../../../platform/chrome/listeners";
import { MEDIA_ORIGINS } from "../../../contracts/media";
export function mediaBrowser() {
  const scope = listenerScope();
  return {
    requestMedia: () => chrome.permissions.request({ origins: MEDIA_ORIGINS }),
    hasMedia: () => chrome.permissions.contains({ origins: MEDIA_ORIGINS }),
    revokeMedia: () => chrome.permissions.remove({ origins: MEDIA_ORIGINS }),
    audioTabs: async () => {
      const current = await chrome.windows.getLastFocused({
        windowTypes: ["normal"],
      });
      const windows = await chrome.windows.getAll({ windowTypes: ["normal"] });
      const ids = new Set(
        windows
          .filter(
            (w) => w.type === "normal" && w.incognito === current.incognito,
          )
          .map((w) => w.id),
      );
      return (await chrome.tabs.query({})).filter(
        (t) => ids.has(t.windowId) && (t.audible || t.mutedInfo?.muted),
      );
    },
    watchAudio: (callback: () => void) => {
      scope.listen(chrome.tabs.onUpdated, (_id, change) => {
        if ("audible" in change || "mutedInfo" in change || "title" in change)
          callback();
      });
      scope.listen(chrome.tabs.onCreated, callback);
      scope.listen(chrome.tabs.onRemoved, callback);
    },
    dispose: () => {
      scope.dispose();
    },
  };
}
