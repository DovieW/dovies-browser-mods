import { present } from "../../../core/present";

let releaseCopiedImage: (() => void) | undefined;
let imageCleanupTimer: ReturnType<typeof setTimeout> | undefined;

function clearCopiedImage() {
  clearTimeout(imageCleanupTimer);
  releaseCopiedImage?.();
  releaseCopiedImage = undefined;
}

export function registerOffscreen() {
  chrome.runtime.onMessage.addListener((raw: unknown, sender, respond) => {
    if (!raw || typeof raw !== "object" || sender.tab) return false;
    const message = raw as {
      target?: unknown;
      type?: unknown;
      dataUrl?: unknown;
      text?: unknown;
    };
    if (message.target !== "offscreen" || sender.id !== chrome.runtime.id)
      return;
    if (message.type === "copy-image") {
      if (
        typeof message.dataUrl !== "string" ||
        !message.dataUrl.startsWith("data:image/png;base64,")
      ) {
        respond({ ok: false });
        return;
      }
      void copyImage(message.dataUrl).then(
        (ok) => {
          respond({ ok });
        },
        () => {
          respond({ ok: false });
        },
      );
      return true;
    }
    if (message.type !== "copy-url" || typeof message.text !== "string") return;
    clearCopiedImage();
    // Offscreen documents cannot be focused. Chrome's documented clipboard pattern
    // uses execCommand here because navigator.clipboard requires document focus.
    const field = document.getElementById("clipboard") as HTMLTextAreaElement;
    let ok = false;
    try {
      field.value = message.text;
      field.select();
      // Offscreen clipboard copying requires Chrome's unfocused-document fallback.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      ok = document.execCommand("copy");
    } catch {
      /* The caller surfaces clipboard failures. */
    } finally {
      field.value = "";
      field.blur();
    }
    respond({ ok });
  });
}

async function copyImage(dataUrl: string) {
  clearCopiedImage();
  let frame: HTMLIFrameElement | undefined;
  let objectUrl: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let copied = false;
  const release = () => {
    frame?.remove();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  };
  try {
    const blob = await (await fetch(dataUrl)).blob();
    objectUrl = URL.createObjectURL(blob);
    frame = document.createElement("iframe");
    const loaded = new Promise((resolve, reject) => {
      present(frame).onload = resolve;
      present(frame).onerror = () => {
        reject(new Error("Image load failed"));
      };
      timer = setTimeout(() => {
        reject(new Error("Image load timed out"));
      }, 5000);
    });
    frame.src = objectUrl;
    document.body.append(frame);
    await loaded;
    const imageDocument = frame.contentDocument;
    if (
      imageDocument?.contentType !== "image/png" ||
      !imageDocument.querySelector("img")?.naturalWidth
    )
      return false;
    frame.contentWindow?.focus();
    imageDocument.getSelection()?.removeAllRanges();
    // Chromium's Copy command on an image document writes the actual bitmap.
    // A same-origin blob iframe lets it run here without stealing page focus.
    // Chromium bitmap copy needs the image-document clipboard path.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    copied = imageDocument.execCommand("copy");
    if (copied) {
      // The browser commits bitmap writes asynchronously. Retain the source
      // frame until the next copy or idle cleanup, rather than racing its IPC.
      releaseCopiedImage = release;
      imageCleanupTimer = setTimeout(clearCopiedImage, 30000);
    }
    return copied;
  } finally {
    clearTimeout(timer);
    if (!copied) release();
  }
}
