import type { TabSettings } from "../../../contracts/browser";
export const TAB_SETTINGS_PREFIX = "tabSwitchingV1-";
export const TAB_SETTINGS_DEFAULTS = Object.freeze({
  resetAfterPause: true,
  pauseMs: 1500,
  includeOtherWindows: true,
  wrap: false,
  rememberPreviews: false,
});

export function normalizeTabSettings(
  value: Record<string, unknown> = {},
): TabSettings {
  return {
    resetAfterPause:
      typeof value.resetAfterPause === "boolean" ? value.resetAfterPause : true,
    pauseMs:
      typeof value.pauseMs === "number" &&
      Number.isInteger(value.pauseMs) &&
      value.pauseMs >= 250 &&
      value.pauseMs <= 10000
        ? value.pauseMs
        : 1500,
    includeOtherWindows:
      typeof value.includeOtherWindows === "boolean"
        ? value.includeOtherWindows
        : true,
    wrap: typeof value.wrap === "boolean" ? value.wrap : false,
    rememberPreviews:
      typeof value.rememberPreviews === "boolean"
        ? value.rememberPreviews
        : false,
  };
}
