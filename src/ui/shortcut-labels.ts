import type { Command } from "../contracts/shortcuts";

// Shared with the popup and dependency-free tests.
export function formatShortcut(shortcut?: string) {
  return (shortcut || "")
    .split("+")
    .map(
      (key) =>
        (
          ({ MacCtrl: "Control", Command: "Cmd", Option: "Option" }) as Record<
            string,
            string
          >
        )[key] || key,
    )
    .join(" + ");
}
export function commandCategory(name: string) {
  if (["copy-url", "copy-screenshot", "go-home"].includes(name))
    return "Navigation";
  if (name === "pause-all-tabs") return "Media";
  if (name.includes("window")) return "Windows";
  if (name.includes("group")) return "Groups";
  return "Tabs";
}
export function matchesCommand(command: Command, query: string) {
  return `${command.description} ${command.name} ${command.shortcut || ""} ${commandCategory(command.name)}`
    .toLowerCase()
    .includes(query.trim().toLowerCase());
}

export function shortCommandLabel(command: Command) {
  const labels: Record<string, string> = {
    "duplicate-tab": "Duplicate tabs",
    "discard-tabs": "Unload tabs",
    "pin-tab": "Pin / unpin tabs",
    "go-incognito": "Open in incognito",
    "open-tab-near": "New tab nearby",
    "add-tab-to-current-group": "New tab in group",
    "open-tab-at-end": "New tab at end",
    "move-tabs-left": "Move left",
    "move-tabs-right": "Move right",
    "move-tabs-to-front": "Move to front",
    "move-tabs-to-back": "Move to back",
    "switch-windows": "Next window",
    "move-tabs-to-window": "Move to next window",
    "toggle-collapse-groups": "Collapse / expand groups",
    "switch-to-last-tab": "Last active tab",
    "walk-recent-tabs": "Older recent tab",
    "walk-recent-tabs-forward": "Newer recent tab",
    "copy-url": "Copy links",
    "copy-screenshot": "Copy screenshot",
    "move-all-groups": "Groups to front / back",
    "go-home": "Site home",
    "cycle-tab-groups": "Move to next group",
    "pause-all-tabs": "Pause all media",
  };
  return labels[command.name] || command.description;
}
