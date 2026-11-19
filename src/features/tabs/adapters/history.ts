import { listenerScope } from "../../../platform/chrome/listeners";
import { walkExpired } from "../domain/policy";
import { present } from "../../../core/present";
import { readSession, type TabState } from "./session";
import type { BrowserPort } from "../../../platform/chrome/browser";
import type {
  Tab,
  CommandContext,
  Walk,
  TabSettings,
} from "../../../contracts/browser";
import { commandError } from "../../../core/actions/errors";
import { createContextService } from "../../../platform/chrome/context";
import { createTabSettings } from "./settings";

export function createTabHistory(
  chrome: Pick<BrowserPort, "tabs" | "windows" | "tabGroups" | "storage">,
) {
  const scope = listenerScope();
  const NONE = -1,
    HISTORY_KEY = "tabHistory",
    HISTORY_WALK_KEY = "tabHistoryWalk",
    MAX_HISTORY = 32;
  const { normalWindows, safeGetTab } = createContextService(chrome);
  const { readTabSettings, saveTabSettings } = createTabSettings(
    chrome.storage,
  );
  let historyQueue: Promise<unknown> = Promise.resolve();
  function enqueueHistory<T>(task: () => Promise<T>): Promise<T> {
    const result = historyQueue.then(task);
    historyQueue = result.catch(() => undefined);
    return result;
  }

  async function promoteTab(tab: Tab | null | undefined) {
    if (!tab) return;
    const window = await chrome.windows.get(tab.windowId);
    if (window.type !== "normal") return;
    const { [HISTORY_KEY]: stored = [] } = await readSession(
      chrome.storage.session,
      HISTORY_KEY,
    );
    const history = stored.filter((entry) => entry.tabId !== tab.id);
    history.unshift({
      tabId: tab.id,
      windowId: tab.windowId,
      incognito: tab.incognito,
    });
    await chrome.storage.session.set({
      [HISTORY_KEY]: history.slice(0, MAX_HISTORY),
    });
  }

  async function finishTabWalk(walk?: Walk | null) {
    if (!walk)
      ({ [HISTORY_WALK_KEY]: walk } = await readSession(
        chrome.storage.session,
        HISTORY_WALK_KEY,
      ));
    if (!walk) return;
    await promoteTab(await safeGetTab(walk.currentTabId));
    await chrome.storage.session.remove(HISTORY_WALK_KEY);
  }

  async function recordTab(tab: Tab | null | undefined) {
    if (!tab || (await chrome.windows.get(tab.windowId)).type !== "normal")
      return;
    const { [HISTORY_WALK_KEY]: walk } = await readSession(
      chrome.storage.session,
      HISTORY_WALK_KEY,
    );
    if (walk) {
      // Our activation events arrive after the cursor has been saved. A manual
      // selection or an expired session commits only the final preview by default.
      if (walk.currentTabId !== tab.id || walkExpired(walk, Date.now()))
        await finishTabWalk(walk);
      else if (!walk.settings?.rememberPreviews) return;
    }
    await promoteTab(tab);
  }

  async function switchToLastTab(context: CommandContext) {
    if (!context.active) throw commandError("no_tab");
    // Synchronously enqueue the entire read/modify/switch to prevent lost activation writes.
    await enqueueHistory(async () => {
      const { [HISTORY_KEY]: history = [] } = await readSession(
        chrome.storage.session,
        HISTORY_KEY,
      );
      const valid = [];
      const windows = await normalWindows();
      for (const entry of history) {
        const tab = await safeGetTab(entry.tabId);
        if (
          tab &&
          tab.incognito === context.window.incognito &&
          windows.some((window) => window.id === tab.windowId)
        )
          valid.push(tab);
      }
      const target = valid.find((tab) => tab.id !== present(context.active).id);
      await recordTab(context.active);
      if (!target) throw commandError("no_previous_tab");
      if (target.groupId !== NONE)
        await chrome.tabGroups.update(target.groupId, { collapsed: false });
      await chrome.windows.update(target.windowId, { focused: true });
      await chrome.tabs.update(target.id, { active: true });
      await recordTab(target);
    });
  }

  async function walkRecentTabs(context: CommandContext, direction = 1) {
    if (!context.active) throw commandError("no_tab");
    await enqueueHistory(async () => {
      const settings = await readTabSettings();
      const stored = await readSession(chrome.storage.session, [
        HISTORY_KEY,
        HISTORY_WALK_KEY,
      ]);
      let walk = stored[HISTORY_WALK_KEY];
      if (
        walk &&
        (walk.currentTabId !== present(context.active).id ||
          walk.incognito !== context.window.incognito ||
          walkExpired(walk, Date.now()) ||
          Object.keys(settings).some(
            (name) =>
              walk?.settings?.[name as keyof TabSettings] !==
              settings[name as keyof TabSettings],
          ))
      ) {
        await finishTabWalk(walk);
        walk = null;
      }
      if (!walk) {
        await promoteTab(context.active);
        const { [HISTORY_KEY]: history = [] } = await readSession(
          chrome.storage.session,
          HISTORY_KEY,
        );
        const ids = [
          ...new Set([
            present(context.active).id,
            ...history.map((entry) => entry.tabId),
          ]),
        ].slice(0, MAX_HISTORY);
        walk = {
          ids,
          index: 0,
          currentTabId: present(context.active).id,
          incognito: context.window.incognito,
          windowId: context.window.id,
          settings,
        };
      }
      // Normalize restored cursors. Reversing direction must immediately leave
      // the current tab, including immediately after a boundary message.
      walk.index = walk.ids.indexOf(present(context.active).id);
      const windows = await normalWindows();
      for (let step = 1; step < walk.ids.length; step++) {
        let index = walk.index + direction * step;
        if (!settings.wrap && (index < 0 || index >= walk.ids.length)) break;
        index = (index + walk.ids.length) % walk.ids.length;
        const tab = await safeGetTab(present(walk.ids[index]));
        if (
          !tab ||
          tab.incognito !== walk.incognito ||
          !windows.some((window) => window.id === tab.windowId) ||
          (!settings.includeOtherWindows && tab.windowId !== walk.windowId)
        )
          continue;
        try {
          if (tab.groupId !== NONE)
            await chrome.tabGroups.update(tab.groupId, { collapsed: false });
          await chrome.windows.update(tab.windowId, { focused: true });
          await chrome.tabs.update(tab.id, { active: true });
        } catch (error) {
          // A tab can close while its group/window is being focused.
          if (!(await safeGetTab(tab.id))) continue;
          await finishTabWalk(walk);
          throw error;
        }
        await chrome.storage.session.set({
          [HISTORY_WALK_KEY]: {
            ...walk,
            index,
            currentTabId: tab.id,
            lastStepAt: Date.now(),
          },
        });
        await recordTab(tab);
        return;
      }
      await chrome.storage.session.set({
        [HISTORY_WALK_KEY]: { ...walk, lastStepAt: Date.now() },
      });
      throw commandError(direction > 0 ? "history_end" : "history_start");
    });
  }

  function register() {
    scope.listen(chrome.tabs.onActivated, ({ tabId, windowId }) => {
      enqueueHistory(async () => {
        const window = await chrome.windows.get(windowId);
        // A background window can have an active tab without being the user's last tab.
        const focused = await chrome.windows.getLastFocused({
          windowTypes: ["normal"],
        });
        if (
          window.type === "normal" &&
          window.focused &&
          focused.id === windowId
        )
          await recordTab(await safeGetTab(tabId));
      }).catch(() => {}); // Closed tabs/windows are expected during activation events.
    });

    scope.listen(chrome.windows.onFocusChanged, (windowId) => {
      if (windowId === chrome.windows.WINDOW_ID_NONE) return;
      enqueueHistory(async () => {
        const window = await chrome.windows.get(windowId);
        if (window.type !== "normal") return;
        const focused = await chrome.windows.getLastFocused({
          windowTypes: ["normal"],
        });
        if (focused.id !== windowId) return; // Ignore a delayed event from a prior window.
        const [tab] = await chrome.tabs.query({ windowId, active: true });
        await recordTab(tab);
      }).catch(() => {});
    });

    scope.listen(chrome.tabs.onRemoved, (tabId) => {
      enqueueHistory(async () => {
        const { [HISTORY_KEY]: history = [] } = await readSession(
          chrome.storage.session,
          HISTORY_KEY,
        );
        await chrome.storage.session.set({
          [HISTORY_KEY]: history.filter((entry) => entry.tabId !== tabId),
        });
      }).catch(() => {});
    });

    scope.listen(chrome.tabs.onReplaced, (addedTabId, removedTabId) => {
      // Discarding can replace WebContents and assign a new tab ID. Preserve the
      // position in recent-tab history so unloaded tabs can still be revisited.
      enqueueHistory(async () => {
        const { [HISTORY_KEY]: history = [], [HISTORY_WALK_KEY]: walk } =
          await readSession(chrome.storage.session, [
            HISTORY_KEY,
            HISTORY_WALK_KEY,
          ]);
        const changes: TabState = {
          [HISTORY_KEY]: history.map((entry) =>
            entry.tabId === removedTabId
              ? { ...entry, tabId: addedTabId }
              : entry,
          ),
        };
        if (walk)
          changes[HISTORY_WALK_KEY] = {
            ...walk,
            ids: walk.ids.map((id) => (id === removedTabId ? addedTabId : id)),
            currentTabId:
              walk.currentTabId === removedTabId
                ? addedTabId
                : walk.currentTabId,
          };
        await chrome.storage.session.set(changes);
      }).catch(() => {});
    });

    // Seed the current browser session once, so the first switch after loading the
    // extension can return to a tab that was already active before listeners existed.
    enqueueHistory(async () => {
      const { [HISTORY_KEY]: stored } = await readSession(
        chrome.storage.session,
        HISTORY_KEY,
      );
      if (Array.isArray(stored)) return;
      const windows = await normalWindows();
      const normalIds = new Set(windows.map((window) => window.id));
      const focusedId = windows.find((window) => window.focused)?.id;
      const tabs = (await chrome.tabs.query({})).filter((tab) =>
        normalIds.has(tab.windowId),
      );
      tabs.sort(
        (a, b) =>
          Number(b.active && b.windowId === focusedId) -
            Number(a.active && a.windowId === focusedId) ||
          (b.lastAccessed || 0) - (a.lastAccessed || 0),
      );
      await chrome.storage.session.set({
        [HISTORY_KEY]: tabs.slice(0, MAX_HISTORY).map((tab) => ({
          tabId: tab.id,
          windowId: tab.windowId,
          incognito: tab.incognito,
        })),
      });
    }).catch(() => {});
  }
  return {
    dispose: () => {
      scope.dispose();
    },
    register,
    getHistoryQueue: () => historyQueue,
    enqueueHistory,
    recordTab,
    finishTabWalk,
    readTabSettings,
    saveTabSettings,
    switchToLastTab,
    walkRecentTabs,
  };
}
