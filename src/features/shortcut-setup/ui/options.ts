import { popupBrowser } from "../adapters/browser";
const port = popupBrowser();
import { listen } from "../../../ui/dom";
import {
  adoptShortcut,
  readShortcutSetup,
} from "../../../platform/messaging/shortcuts";
import { commands } from "../../../core/actions/catalog";
const status = document.querySelector<HTMLElement>("#status");
const table = document.querySelector<HTMLTableSectionElement>("#shortcuts");
listen(document.querySelector("#edit"), "click", () => {
  void port.editKeys();
});
let running = false;
async function refresh(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const result = await readShortcutSetup();
    const rows = Object.entries(commands).map(([name, definition]) => {
      const row = document.createElement("tr");
      for (const value of [
        definition.description,
        result.actual[name] ?? "Unassigned",
        result.desired[name] ?? "Not saved",
      ]) {
        const cell = document.createElement("td");
        cell.textContent = value || "Unassigned";
        row.append(cell);
      }
      const cell = document.createElement("td");
      const detail = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "Past assignments";
      detail.append(summary);
      const revisions = result.records
        .flatMap((r) => r.revisions)
        .filter((r) => r.command === name)
        .sort((a, b) => b.clock - a.clock);
      for (const revision of revisions) {
        const item = document.createElement("p");
        item.textContent = `${revision.binding || "Unassigned"} · ${new Date(revision.observedAt).toLocaleString()} · ${revision.device.slice(0, 8)}`;
        detail.append(item);
      }
      cell.append(detail);
      row.append(cell);
      const choice = document.createElement("td");
      if (
        Object.hasOwn(result.desired, name) &&
        result.actual[name] !== result.desired[name]
      ) {
        const keep = document.createElement("p");
        keep.textContent =
          "Saved preference retained until you choose otherwise.";
        choice.append(keep);
        const adopt = document.createElement("button");
        adopt.textContent = "Use this device’s assignment";
        adopt.addEventListener("click", () => {
          adopt.disabled = true;
          void adoptShortcut(name)
            .then(refresh)
            .catch(() => {
              if (status)
                status.textContent = "Could not save assignment. Try again.";
            })
            .finally(() => {
              adopt.disabled = false;
            });
        });
        choice.append(adopt);
      }
      row.append(choice);
      return row;
    });
    table?.replaceChildren(...rows);
    const differences = Object.entries(result.desired).filter(
      ([name, key]) => key !== result.actual[name],
    ).length;
    if (status)
      status.textContent = differences
        ? `${differences} assignments differ from your desired setup.`
        : "This device matches your desired setup. Saved locally; Chrome manages sync delivery.";
  } catch (error: unknown) {
    if (status)
      status.textContent =
        error instanceof Error
          ? error.message
          : "Could not load shortcut setup.";
  } finally {
    running = false;
  }
}
export function initializeOptions(): void {
  listen(window, "focus", () => {
    void refresh();
  });
  const search = document.querySelector<HTMLInputElement>("#shortcutSearch");
  listen(search, "input", () => {
    if (!search) return;
    for (const row of table?.rows ?? [])
      row.hidden = !row.textContent
        .toLowerCase()
        .includes(search.value.toLowerCase());
  });
  void refresh();
}
