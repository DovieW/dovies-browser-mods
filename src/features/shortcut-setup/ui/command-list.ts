import { element } from "../../../ui/dom";
import type { Command, Snapshot } from "../../../contracts/shortcuts";
import {
  formatShortcut,
  commandCategory,
  matchesCommand,
  shortCommandLabel,
} from "../../../ui/shortcut-labels";
import { shortcutDifference } from "../adapters/snapshots";
export function commandList(
  state: { commands: Command[] },
  currentSnapshot: () => Snapshot | undefined,
) {
  function renderCommands() {
    const container = element("shortcutsContainer");
    container.replaceChildren();
    const snapshot = currentSnapshot();
    const onlyDifferences =
      element<HTMLInputElement>("onlyDifferences").checked && snapshot;
    const filtered = state.commands.filter((command) => {
      const previous = snapshot?.bindings[command.name] || "";
      const difference = shortcutDifference(command, snapshot);
      return (
        matchesCommand(
          { ...command, shortcut: `${command.shortcut || ""} ${previous}` },
          element<HTMLInputElement>("search").value,
        ) &&
        (!onlyDifferences ||
          difference === "missing" ||
          difference === "changed")
      );
    });
    for (const category of [
      "Tabs",
      "Groups",
      "Windows",
      "Navigation",
      "Media",
    ]) {
      const items = filtered.filter(
        (command) => commandCategory(command.name) === category,
      );
      if (!items.length) continue;
      const heading = document.createElement("h2");
      heading.textContent = category;
      container.append(heading);
      for (const command of items) {
        const item = document.createElement("div");
        item.className = "shortcut-item";
        const description = document.createElement("span");
        description.className = "shortcut-copy";
        description.textContent = shortCommandLabel(command);
        item.title = command.description;
        const difference = shortcutDifference(command, snapshot);
        if (snapshot && ["missing", "changed"].includes(difference)) {
          const previous = document.createElement("span");
          previous.className = "previous-shortcut";
          previous.textContent = `Was ${formatShortcut(snapshot.bindings[command.name]).replace(/ \+ /g, "+") || "—"}`;
          item.classList.add(difference);
          description.append(previous);
        }
        const key = document.createElement(command.shortcut ? "kbd" : "span");
        key.textContent = command.shortcut
          ? formatShortcut(command.shortcut).replace(/ \+ /g, "+")
          : "—";
        if (!command.shortcut) {
          key.title = "Not assigned";
          key.setAttribute("aria-label", "Not assigned");
        }
        if (!command.shortcut) key.className = "unassigned";
        item.append(description, key);
        container.append(item);
      }
    }
    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent =
        onlyDifferences && !element<HTMLInputElement>("search").value.trim()
          ? "All shortcuts match."
          : "No matching shortcuts.";
      container.append(empty);
    }
  }
  return renderCommands;
}
