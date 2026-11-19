import { authorizeLauncher } from "../features/workspace/public";
import { commands } from "../core/actions/catalog";
import { listenerScope } from "../platform/chrome/listeners";
import { createShortcutService } from "../core/shortcuts/application";
import { shortcutHistoryPort } from "../platform/storage/shortcut-history";
export function registerShortcutHistory() {
  const scope = listenerScope();
  const { reconcileShortcuts, adoptAssignment } = createShortcutService(
    shortcutHistoryPort(chrome),
  );
  function refresh(): void {
    void reconcileShortcuts().catch(() => undefined);
  }
  scope.listen(chrome.runtime.onStartup, refresh);
  scope.listen(chrome.runtime.onInstalled, refresh);
  scope.listen(chrome.commands.onCommand, refresh);
  scope.listen(
    chrome.runtime.onMessage,
    (message: unknown, sender, respond: (value: unknown) => void) => {
      if (
        !message ||
        typeof message !== "object" ||
        !("type" in message) ||
        !["mods.shortcuts.reconcile", "mods.shortcuts.adopt"].includes(
          String(message.type),
        )
      )
        return false;
      if (
        sender.id !== chrome.runtime.id ||
        !sender.url?.startsWith(chrome.runtime.getURL(""))
      )
        return false;
      void (async () => {
        if (!(await authorizeLauncher(sender))) throw Error("Invalid launcher");
        if (message.type === "mods.shortcuts.adopt") {
          if (
            !("command" in message) ||
            typeof message.command !== "string" ||
            !Object.hasOwn(commands, message.command)
          )
            throw Error("Invalid command");
          await adoptAssignment(message.command);
        }
        return reconcileShortcuts();
      })()
        .then((value) => {
          respond({ ok: true, value });
        })
        .catch(() => {
          respond({
            ok: false,
            error:
              "Could not save shortcut history. Your local records are retained; check storage access and sync quota.",
          });
        });
      return true;
    },
  );
  return scope.dispose;
}
