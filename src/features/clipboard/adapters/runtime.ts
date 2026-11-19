import type { BrowserPort } from "../../../platform/chrome/browser";
import type { CommandContext, Tab } from "../../../contracts/browser";
import { commandError, commandErrorCode } from "../../../core/actions/errors";
import { succeeded } from "../../../contracts/action-messages";
export function createClipboard(
  chrome: Pick<BrowserPort, "tabs" | "runtime" | "offscreen">,
) {
  let creatingOffscreen: Promise<void> | undefined;
  async function writeClipboard(type: string, payload: Record<string, string>) {
    try {
      const url = chrome.runtime.getURL("offscreen.html");
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
        documentUrls: [url],
      });
      if (!contexts.length) {
        if (!creatingOffscreen)
          creatingOffscreen = chrome.offscreen
            .createDocument({
              url: "offscreen.html",
              reasons: ["CLIPBOARD", "BLOBS", "IFRAME_SCRIPTING"],
              justification:
                "Copy selected tab links or a captured PNG image to the clipboard.",
            })
            .finally(() => {
              creatingOffscreen = undefined;
            });
        await creatingOffscreen;
      }
      const response: unknown = await chrome.runtime.sendMessage({
        target: "offscreen",
        type,
        ...payload,
      });
      if (!succeeded(response)) throw commandError("clipboard_failed");
    } catch {
      throw commandError("clipboard_failed");
    }
  }

  async function copyUrls(context: CommandContext) {
    const selected = context.selected.length
      ? context.selected
      : context.active
        ? [context.active]
        : [];
    if (!selected.length) throw commandError("no_tab");
    if (selected.some((tab) => !tab.url)) throw commandError("no_url");
    await writeClipboard("copy-url", {
      text: selected.map((tab) => tab.url).join("\n"),
    });
  }

  async function assertScreenshotTarget(tab: Tab) {
    const [active] = await chrome.tabs.query({
      windowId: tab.windowId,
      active: true,
    });
    if (
      !active ||
      active.id !== tab.id ||
      active.url !== tab.url ||
      active.pendingUrl
    )
      throw commandError("screenshot_changed");
  }

  async function copyScreenshot(
    context: CommandContext,
    _granted?: boolean,
    invokedTab?: chrome.tabs.Tab,
  ) {
    const tab = context.active;
    if (!tab) throw commandError("no_tab");
    if (invokedTab && (invokedTab.id !== tab.id || invokedTab.url !== tab.url))
      throw commandError("screenshot_changed");
    await assertScreenshotTarget(tab);
    let dataUrl;
    try {
      dataUrl = await chrome.tabs.captureVisibleTab(context.window.id, {
        format: "png",
      });
    } catch (error) {
      if (
        /activeTab|<all_urls>|permission|Cannot access/i.test(
          error &&
            typeof error === "object" &&
            "message" in error &&
            typeof error.message === "string"
            ? error.message
            : "",
        )
      )
        throw commandError("screenshot_permission");
      if (
        /MAX_CAPTURE_VISIBLE_TAB|too many|quota|exceeded/i.test(
          error &&
            typeof error === "object" &&
            "message" in error &&
            typeof error.message === "string"
            ? error.message
            : "",
        )
      )
        throw commandError("screenshot_busy");
      if (commandErrorCode(error) === "no_tab") throw commandError("no_tab");
      throw commandError("screenshot_failed");
    }
    // Never put a capture of a newly activated/navigated tab on the clipboard.
    await assertScreenshotTarget(tab);
    if (!dataUrl.startsWith("data:image/png;base64,"))
      throw commandError("screenshot_failed");
    await writeClipboard("copy-image", { dataUrl });
  }
  return { copyUrls, copyScreenshot };
}
