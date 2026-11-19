import { element, listen, onPageClose } from "../../../ui/dom";
import {
  commandErrorCode,
  commandErrorMessage,
} from "../../../core/actions/errors";
import { mediaBrowser } from "../adapters/browser";
export function createAudioView(
  showStatus: (text: string, temporary?: boolean) => void,
  sendAction: (message: Record<string, unknown>) => Promise<void>,
) {
  const port = mediaBrowser();
  let audioRefreshTimer: ReturnType<typeof setTimeout> | undefined;
  async function loadAudioTabs() {
    const container = element("audioTabs");
    const tabs = await port.audioTabs();
    container.replaceChildren();
    for (const tab of tabs) {
      const row = document.createElement("div");
      row.className = "audio-tab";
      const focus = document.createElement("button");
      focus.type = "button";
      focus.className = "audio-title";
      focus.textContent = tab.title || "Untitled tab";
      focus.title = focus.textContent;
      listen(focus, "click", async () => {
        try {
          await sendAction({ type: "focus-tab", tabId: tab.id });
          windowClose();
        } catch (error) {
          showStatus(commandErrorMessage(commandErrorCode(error)));
        }
      });
      const mute = document.createElement("button");
      mute.type = "button";
      mute.className = "icon-button";
      const action = tab.mutedInfo?.muted ? "Unmute" : "Mute";
      mute.title = action;
      mute.setAttribute("aria-label", `${action} ${tab.title || "tab"}`);
      const icon = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute(
        "href",
        tab.mutedInfo?.muted ? "#icon-muted" : "#icon-volume",
      );
      icon.setAttribute("aria-hidden", "true");
      icon.append(use);
      const label = document.createElement("span");
      label.className = "button-label";
      label.textContent = action;
      mute.append(icon, label);
      listen(mute, "click", async () => {
        try {
          await sendAction({ type: "mute-tab", tabId: tab.id });
          await loadAudioTabs();
        } catch (error) {
          showStatus(commandErrorMessage(commandErrorCode(error)));
        }
      });
      row.append(focus, mute);
      container.append(row);
    }
    element("audioSection").hidden = !tabs.length;
    element("revokeMedia").hidden = !(await port.hasMedia());
  }
  function scheduleAudioRefresh() {
    clearTimeout(audioRefreshTimer);
    audioRefreshTimer = setTimeout(
      () =>
        loadAudioTabs().catch(() => {
          showStatus(
            "Audio tabs could not refresh. Reopen the popup to try again.",
          );
        }),
      150,
    );
  }
  function windowClose() {
    window.close();
  }
  port.watchAudio(scheduleAudioRefresh);
  onPageClose(() => {
    clearTimeout(audioRefreshTimer);
    port.dispose();
  });
  return {
    loadAudioTabs,
    requestMedia: port.requestMedia,
    revokeMedia: port.revokeMedia,
  };
}
