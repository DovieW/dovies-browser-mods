import { createBrowserPort } from "../../platform/chrome/browser";
import { createWorker } from "../../composition/worker";
import { registerShortcutHistory } from "../../composition/shortcuts";
createWorker(createBrowserPort(chrome)).register();
registerShortcutHistory();
