import type { BrowserPort } from "../../../platform/chrome/browser";
import type { CommandContext } from "../../../contracts/browser";
import { commandError } from "../../../core/actions/errors";
import { createContextService } from "../../../platform/chrome/context";

export function createMedia(
  chrome: Pick<BrowserPort, "tabs" | "windows" | "scripting" | "storage">,
) {
  const { normalWindows } = createContextService(chrome);
  function pauseMedia() {
    let paused = 0;
    function visit(root: Document | ShadowRoot) {
      for (const media of root.querySelectorAll<HTMLMediaElement>(
        "audio, video",
      )) {
        if (!media.paused) {
          media.pause();
          paused++;
        }
      }
      for (const element of root.querySelectorAll("*"))
        if (element.shadowRoot) visit(element.shadowRoot);
    }
    visit(document);
    return paused;
  }

  async function pauseAllTabs(context: CommandContext, granted?: boolean) {
    if (!granted) throw commandError("permission_denied");
    const windows = (await normalWindows()).filter(
      (window) => window.incognito === context.window.incognito,
    );
    const ids = new Set(windows.map((window) => window.id));
    const tabs = (await chrome.tabs.query({})).filter(
      (tab) =>
        ids.has(tab.windowId) &&
        /^https?:/.test(tab.url || "") &&
        !tab.discarded,
    );
    const results = await Promise.allSettled(
      tabs.map((tab) =>
        chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          func: pauseMedia,
        }),
      ),
    );
    const failed = results.filter(
      (result) => result.status === "rejected",
    ).length;
    await chrome.storage.session.set({
      mediaResult: { tabs: tabs.length - failed, failed, at: Date.now() },
    });
    if (failed) throw commandError("media_partial");
  }
  return { pauseAllTabs };
}
