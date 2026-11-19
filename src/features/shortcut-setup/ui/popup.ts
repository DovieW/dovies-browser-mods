import { createAudioView } from "../../media/public-ui";
import { backupView } from "./backups";
import { commandList } from "./command-list";
import { popupBrowser } from "../adapters/browser";
import { onPageClose } from "../../../ui/dom";
const port = popupBrowser();
import { listen } from "../../../ui/dom";
import { element } from "../../../ui/dom";
import type { Command } from "../../../contracts/shortcuts";
import {
  commandError,
  commandErrorCode,
  commandErrorMessage,
} from "../../../core/actions/errors";
import { shortCommandLabel } from "../../../ui/shortcut-labels";
import { setupTabSettings } from "../../tabs/public-ui";

const state: { commands: Command[] } = { commands: [] };
const renderCommands = commandList(state, () => backups.currentSnapshot());
const backups = backupView(
  state,
  port,
  readCommands,
  renderCommands,
  showStatus,
);
const { setupShortcutMemory } = backups;
let audio: ReturnType<typeof createAudioView>;
async function readCommands() {
  const current = (await port.commands()).filter(
    (command) => !command.name?.startsWith("_"),
  );
  const normalized = current.map((c) => ({
    name: c.name ?? "",
    description: c.description ?? "",
    shortcut: c.shortcut ?? "",
  }));
  normalized.sort(
    (a, b) =>
      Number(!!b.shortcut) - Number(!!a.shortcut) ||
      a.description.localeCompare(b.description),
  );
  return normalized;
}

let statusTimer: ReturnType<typeof setTimeout> | undefined;
function showStatus(text: string, temporary = false) {
  clearTimeout(statusTimer);
  const status = element("status");
  status.textContent = text;
  status.hidden = !text;
  if (temporary && text)
    statusTimer = setTimeout(() => {
      status.hidden = true;
    }, 2500);
}

async function sendAction(message: Record<string, unknown>) {
  const result: unknown = await port.send(message);
  if (
    !result ||
    typeof result !== "object" ||
    !("ok" in result) ||
    result.ok !== true
  )
    throw commandError(
      result && typeof result === "object" && "code" in result
        ? result.code
        : "action_failed",
    );
}

async function run(command: string, button: HTMLButtonElement) {
  button.disabled = true;
  try {
    if (command === "pause-all-tabs") {
      // Called directly from the click handler, preserving the user gesture.
      const granted = await audio.requestMedia();
      if (!granted) {
        showStatus("Site access declined.");
        return;
      }
    }
    await sendAction({ type: "run-command", command });
    showStatus("Media paused.", true);
    await audio.loadAudioTabs();
  } catch (error) {
    showStatus(commandErrorMessage(commandErrorCode(error)));
  } finally {
    button.disabled = false;
  }
}

export async function initialize() {
  audio = createAudioView(showStatus, sendAction);
  onPageClose(() => {
    clearTimeout(statusTimer);
    port.dispose();
  });

  setupTabSettings();
  setupShortcutMemory();
  listen(element("moreTools"), "click", (event) => {
    const panel = element("backupTools");
    panel.hidden = !panel.hidden;
    (event.currentTarget as HTMLButtonElement).setAttribute(
      "aria-expanded",
      String(!panel.hidden),
    );
  });
  listen(element<HTMLInputElement>("search"), "input", renderCommands);
  listen(element("manageShortcuts"), "click", async () => {
    try {
      await port.editKeys();
      window.close();
    } catch {
      showStatus("Could not open Chrome shortcut settings.");
    }
  });
  listen(element("pauseAll"), "click", (event) =>
    run("pause-all-tabs", event.currentTarget as HTMLButtonElement),
  );
  listen(element("revokeMedia"), "click", async () => {
    try {
      await audio.revokeMedia();
      await audio.loadAudioTabs();
      showStatus("Site access removed.", true);
    } catch {
      showStatus("Could not remove site access.");
    }
  });
  try {
    state.commands = await readCommands();
    renderCommands();
    const platform = await port.platform();
    try {
      await backups.initialize(platform.os);
    } catch {
      element("memorySummary").textContent = "Backup unavailable";
    }
    const { lastError } = await port.lastError();
    if (lastError) {
      const command = state.commands.find(
        (command) => command.name === lastError.command,
      );
      const label = command ? shortCommandLabel(command) : "Recent action";
      showStatus(`${label}: ${commandErrorMessage(lastError.code)}`);
    }
    await audio.loadAudioTabs();
  } catch {
    showStatus(
      "Some extension information could not load. Reopen the popup to try again.",
    );
  }
}
