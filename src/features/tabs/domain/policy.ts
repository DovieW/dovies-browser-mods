import type { Tab, Walk } from "../../../contracts/browser";
const NONE = -1;
export function walkExpired(walk: Walk, now: number) {
  return (
    !walk.settings ||
    !Number.isFinite(walk.lastStepAt) ||
    (walk.settings.resetAfterPause &&
      (now - (walk.lastStepAt ?? 0) >= walk.settings.pauseMs ||
        now < (walk.lastStepAt ?? 0)))
  );
}
export function isBlankTab(tab: Tab | null | undefined): tab is Tab {
  return (
    !!tab &&
    !tab.pinned &&
    tab.status === "complete" &&
    !tab.pendingUrl &&
    [
      "chrome://newtab/",
      "chrome://newtab",
      "chrome://new-tab-page/",
      "chrome://new-tab-page",
    ].includes(tab.url)
  );
}
export function sections(tabs: Tab[], allTabs: Tab[]) {
  const result = new Map<string, Tab[]>();
  for (const tab of tabs) {
    const boundary =
      !tab.pinned && tab.groupId === NONE
        ? (allTabs.slice(0, tab.index).findLast((item) => item.groupId !== NONE)
            ?.id ?? NONE)
        : NONE;
    const key = `${tab.pinned}:${tab.groupId}:${boundary}`;
    if (!result.has(key)) result.set(key, []);
    result.get(key)?.push(tab);
  }
  return [...result.values()];
}
