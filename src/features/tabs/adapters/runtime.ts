import type { BrowserPort } from "../../../platform/chrome/browser";
import { createTabHistory } from "./history";
import { createTabOperations } from "./operations";
export function createTabs(
  chrome: Pick<BrowserPort, "tabs" | "windows" | "tabGroups" | "storage">,
) {
  return { ...createTabHistory(chrome), ...createTabOperations(chrome) };
}
