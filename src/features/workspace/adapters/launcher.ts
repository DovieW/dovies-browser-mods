import type { BrowserPort } from "../../../platform/chrome/browser";
import { readPreferences } from "./preferences";
export async function openPalette(api: BrowserPort) {
  const p = await readPreferences();
  if (p.placement === "centered") {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (tab && /^https?:/.test(tab.url)) {
      try {
        const token = crypto.randomUUID();
        await api.storage.session.set({
          [`mods.launcher.${tab.id}`]: { token, expires: Date.now() + 3600000 },
        });
        await api.scripting.executeScript({
          target: { tabId: tab.id },
          func: (url: string) => {
            const existing = document.getElementById("browser-mods-launcher");
            if (existing) {
              existing.dispatchEvent(new Event("mods-close"));
              return;
            }
            const previous = document.activeElement;
            const channel = new MessageChannel();
            const host = document.createElement("div");
            host.id = "browser-mods-launcher";
            const shadow = host.attachShadow({ mode: "closed" });
            const dialog = document.createElement("dialog");
            dialog.style.cssText =
              "padding:0;border:1px solid #30363d;border-radius:12px;background:#0d1117;width:640px;max-width:94vw;height:520px;max-height:85vh;color:#e6edf3;";
            dialog.setAttribute("aria-label", "Browser Mods command palette");
            const frame = document.createElement("iframe");
            frame.src = url;
            frame.title = "Browser Mods command palette";
            frame.style.cssText = "border:0;width:100%;height:100%;";
            const close = () => {
              window.removeEventListener("message", connect);
              channel.port1.close();
              channel.port2.close();
              host.remove();
              if (previous instanceof HTMLElement) previous.focus();
            };
            host.addEventListener("mods-close", close, { once: true });
            dialog.addEventListener("cancel", close);
            dialog.addEventListener("click", (e) => {
              if (e.target === dialog) close();
            });
            channel.port1.onmessage = (e) => {
              if (e.data === "close") {
                channel.port1.close();
                close();
              }
            };
            const connect = (event: MessageEvent) => {
              if (
                event.source !== frame.contentWindow ||
                event.data !== "mods.launcher.ready"
              )
                return;
              window.removeEventListener("message", connect);
              frame.contentWindow?.postMessage(
                "mods.launcher.connect",
                `chrome-extension://${new URL(url).host}`,
                [channel.port2],
              );
            };
            window.addEventListener("message", connect);
            host.addEventListener(
              "mods-close",
              () => {
                window.removeEventListener("message", connect);
              },
              { once: true },
            );
            dialog.addEventListener(
              "cancel",
              () => {
                window.removeEventListener("message", connect);
              },
              { once: true },
            );
            dialog.append(frame);
            shadow.append(dialog);
            document.documentElement.append(host);
            dialog.showModal();
            frame.focus();
          },
          args: [api.runtime.getURL(`launcher.html?token=${token}`)],
        });
        return;
      } catch {
        /* Restricted pages use the toolbar surface. */
      }
    }
  }
  await api.storage.session.set({ "mods.palette.open": true });
  await api.action.openPopup();
}
