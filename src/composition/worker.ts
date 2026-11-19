import {
  authorizeLauncher,
  openPalette,
  readPreferences,
  actionSection,
} from "../features/workspace/public";
import { actionRegistry } from "../core/actions/registry";
import { listenerScope } from "../platform/chrome/listeners";
import { MEDIA_ORIGINS } from "../contracts/media";
import { parseWorkerMessage } from "../contracts/action-messages";
import type { BrowserPort } from "../platform/chrome/browser";
import type { CommandHandler } from "../contracts/browser";
import { createContextService } from "../platform/chrome/context";
import { commandError, commandErrorCode } from "../core/actions/errors";
import { createTabs } from "../features/tabs/public";
import { createClipboard } from "../features/clipboard/public";
import { createMedia } from "../features/media/public";
import type { CommandId } from "../core/actions/catalog";
export function createWorker(chrome: BrowserPort) {
  const scope = listenerScope();
  const NONE = -1;
  const { commandContext, resolveWindow } = createContextService(chrome);
  const tabs = createTabs(chrome);
  const {
    enqueueHistory,
    finishTabWalk,
    duplicateTabs,
    discardTabs,
    setPinned,
    createNewTab,
    moveSide,
    moveEdge,
    cycleWindows,
    switchToLastTab,
    walkRecentTabs,
    moveAllGroups,
    cycleGroups,
  } = tabs;
  const { copyUrls, copyScreenshot } = createClipboard(chrome);
  const { pauseAllTabs } = createMedia(chrome);
  let commandQueue: Promise<unknown> = Promise.resolve();
  function enqueueCommand<T>(task: () => Promise<T>): Promise<T> {
    const result = commandQueue.then(task);
    commandQueue = result.catch(() => undefined);
    return result;
  }
  async function reportError(command: string, error: unknown) {
    // Store no URLs, tab titles, or raw browser errors.
    console.error(`Simple Shortcuts: ${command} failed`);
    await chrome.storage.session.set({
      lastError: { command, code: commandErrorCode(error), at: Date.now() },
    });
    await chrome.action.setBadgeText({ text: "!" });
    await chrome.action.setBadgeBackgroundColor({ color: "#b42318" });
  }

  async function clearError() {
    await chrome.storage.session.remove("lastError");
    await chrome.action.setBadgeText({ text: "" });
  }
  const handlers: Record<CommandId, CommandHandler> = {
    "open-palette": () => openPalette(chrome),
    "duplicate-tab": duplicateTabs,
    "discard-tabs": discardTabs,
    "pin-tab": (context) =>
      setPinned(context.selected, !context.selected.every((tab) => tab.pinned)),
    "go-incognito": async (context) => {
      const urls = context.selected
        .map((tab) => tab.url)
        .filter((url) => /^https?:/.test(url || ""));
      if (!urls.length) throw commandError("no_web_url");
      await chrome.windows.create({
        url: urls,
        incognito: true,
        focused: true,
        state: "maximized",
      });
    },
    "open-tab-near": (context) => createNewTab(context, "near"),
    "add-tab-to-current-group": (context) => createNewTab(context, "group"),
    "open-tab-at-end": (context) => createNewTab(context, "end"),
    "move-tabs-left": (context) => moveSide(context, -1),
    "move-tabs-right": (context) => moveSide(context, 1),
    "move-tabs-to-front": (context) => moveEdge(context, false),
    "move-tabs-to-back": (context) => moveEdge(context, true),
    "switch-windows": (context) => cycleWindows(context, false),
    "move-tabs-to-window": (context) => cycleWindows(context, true),
    "toggle-collapse-groups": async (context) => {
      const groups = await chrome.tabGroups.query({
        windowId: context.window.id,
      });
      if (!groups.length) throw commandError("no_group");
      const collapsed = !groups.every((group) => group.collapsed);
      for (const group of groups)
        await chrome.tabGroups.update(group.id, { collapsed });
    },
    "switch-to-last-tab": switchToLastTab,
    "walk-recent-tabs": (context) => walkRecentTabs(context, 1),
    "walk-recent-tabs-forward": (context) => walkRecentTabs(context, -1),
    "copy-url": copyUrls,
    "copy-screenshot": copyScreenshot,
    "move-all-groups": moveAllGroups,
    "go-home": async (context) => {
      if (!context.active?.url || !/^https?:/.test(context.active.url))
        throw commandError("no_web_url");
      await chrome.tabs.update(context.active.id, {
        url: new URL(context.active.url).origin + "/",
      });
    },
    "cycle-tab-groups": cycleGroups,
    "pause-all-tabs": pauseAllTabs,
  };

  const registry = actionRegistry(handlers);
  async function runCommand(
    command: string,
    granted?: boolean,
    invokedTab?: chrome.tabs.Tab,
  ) {
    if (!Object.hasOwn(handlers, command))
      throw commandError("unknown_command");
    if (
      command !== "open-palette" &&
      (await readPreferences()).disabled.includes(actionSection(command))
    )
      throw commandError("action_failed");
    const context = await commandContext();
    // Copying, pinning, and other commands that leave the selected tab alone do
    // not reset a walk. Last-active switching deliberately starts a fresh switch.
    if (command === "switch-to-last-tab")
      await enqueueHistory(() => finishTabWalk());
    if (!["move-tabs-to-front", "move-tabs-to-back"].includes(command))
      await chrome.storage.session.remove("lastAction");
    await registry.execute(command, context, granted, invokedTab);
    await clearError();
  }
  function register() {
    tabs.register();
    scope.listen(chrome.tabs.onRemoved, (id) => {
      void chrome.storage.session.remove(`mods.launcher.${id}`).catch(() => {});
    });
    scope.listen(chrome.commands.onCommand, (command, tab) => {
      // Request in the user gesture, before awaiting context or the command queue.
      const permission =
        command === "pause-all-tabs"
          ? chrome.permissions
              .request({ origins: MEDIA_ORIGINS })
              .catch(() => false)
          : Promise.resolve(undefined);
      enqueueCommand(async () =>
        runCommand(command, await permission, tab),
      ).catch((error: unknown) => reportError(command, error).catch(() => {}));
    });

    scope.listen(chrome.runtime.onMessage, (raw: unknown, sender, respond) => {
      if (
        raw &&
        typeof raw === "object" &&
        "type" in raw &&
        raw.type === "mods.launcher.authorize"
      ) {
        if (sender.id !== chrome.runtime.id) return false;
        void authorizeLauncher(sender).then((ok) => {
          respond({ ok });
        });
        return true;
      }
      const message = parseWorkerMessage(raw);
      if (!message) return false;
      if (
        sender.id !== chrome.runtime.id ||
        !sender.url?.startsWith(chrome.runtime.getURL(""))
      )
        return;
      enqueueCommand(async () => {
        if (!(await authorizeLauncher(sender)))
          throw commandError("invalid_target");
        if (
          sender.tab &&
          sender.url?.startsWith(chrome.runtime.getURL("launcher.html"))
        ) {
          const context = await commandContext();
          if (context.active?.id !== sender.tab.id)
            throw commandError("invalid_target");
        }
        if (message.type === "run-command") {
          const granted =
            message.command === "pause-all-tabs"
              ? await chrome.permissions.contains({ origins: MEDIA_ORIGINS })
              : undefined;
          await runCommand(message.command, granted);
        } else {
          const context = await commandContext();
          const tab = await chrome.tabs.get(message.tabId);
          const window = await chrome.windows.get(tab.windowId);
          if (
            window.type !== "normal" ||
            window.incognito !== context.window.incognito
          )
            throw commandError("invalid_target");
          if (message.type === "focus-tab") {
            if (tab.groupId !== NONE)
              await chrome.tabGroups.update(tab.groupId, { collapsed: false });
            await chrome.windows.update(tab.windowId, { focused: true });
            await chrome.tabs.update(tab.id, { active: true });
          } else
            await chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted });
          await clearError();
        }
        respond({ ok: true });
      }).catch(async (error: unknown) => {
        await reportError(
          message.type === "run-command" ? message.command : message.type,
          error,
        ).catch(() => {});
        respond({ ok: false, code: commandErrorCode(error) });
      });
      return true;
    });
  }
  return {
    ...tabs,
    dispose: () => {
      scope.dispose();
      tabs.dispose();
    },
    register,
    resolveWindow,
    handlers,
    enqueueCommand,
    runCommand,
    reportError,
    getCommandQueue: () => commandQueue,
  };
}
