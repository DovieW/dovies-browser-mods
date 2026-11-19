import { element, listen } from "../../../ui/dom";
import type { Command, Snapshot } from "../../../contracts/shortcuts";
import {
  SNAPSHOT_PREFIX,
  SNAPSHOT_PLATFORMS,
  PLATFORM_NAMES,
  readShortcutSnapshots,
  saveShortcutSnapshot,
  makeShortcutSnapshot,
  validateShortcutSnapshot,
  snapshotDifferences,
  shortcutDifference,
} from "../adapters/snapshots";
import type { popupBrowser } from "../adapters/browser";
export function backupView(
  state: { commands: Command[] },
  port: ReturnType<typeof popupBrowser>,
  readCommands: () => Promise<Command[]>,
  renderCommands: () => void,
  showStatus: (text: string, temporary?: boolean) => void,
) {
  let snapshots: Record<string, Snapshot> = {};
  let localPlatform = "";
  let selectedPlatform = "";
  let pendingSnapshot: { snapshot: Snapshot; previous: string } | null = null;
  let memoryReady = false;
  function currentSnapshot() {
    return snapshots[selectedPlatform];
  }

  function renderMemory() {
    const select = element<HTMLSelectElement>("snapshotPlatform");
    const platforms = Object.keys(snapshots);
    if (!snapshots[selectedPlatform])
      selectedPlatform = snapshots[localPlatform]
        ? localPlatform
        : (platforms.sort(
            (a, b) =>
              (snapshots[b]?.savedAt ?? 0) - (snapshots[a]?.savedAt ?? 0),
          )[0] ?? "");
    select.replaceChildren();
    for (const platform of platforms) {
      const option = document.createElement("option");
      option.value = platform;
      option.textContent = PLATFORM_NAMES[platform] ?? platform;
      select.append(option);
    }
    if (selectedPlatform) select.value = selectedPlatform;
    select.hidden = platforms.length < 2;
    element("snapshotLabel").hidden = platforms.length < 2;
    const snapshot = currentSnapshot();
    const summary = element("memorySummary");
    if (!snapshot) {
      summary.textContent = "No saved setup";
      summary.title = "Use the save button to remember your current shortcuts.";
      summary.classList.remove("has-differences");
    } else {
      const differences = snapshotDifferences(state.commands, snapshot);
      const missing = differences.filter(
        (command) => shortcutDifference(command, snapshot) === "missing",
      ).length;
      const changed = differences.length - missing;
      const crossPlatform =
        selectedPlatform !== localPlatform
          ? ` · ${PLATFORM_NAMES[selectedPlatform]}`
          : "";
      summary.textContent =
        ([
          missing ? `${missing} missing` : "",
          changed ? `${changed} changed` : "",
        ]
          .filter(Boolean)
          .join(" · ") || "Saved") + crossPlatform;
      summary.title = `Saved on ${new Date(snapshot.savedAt).toLocaleDateString()} for ${PLATFORM_NAMES[selectedPlatform]}.${crossPlatform ? " Keys may differ on this operating system." : ""}`;
      summary.classList.toggle("has-differences", differences.length > 0);
    }
    element<HTMLButtonElement>("rememberShortcuts").disabled = !memoryReady;
    element<HTMLButtonElement>("exportShortcuts").disabled =
      !snapshot || !memoryReady;
    element<HTMLButtonElement>("importShortcuts").disabled = !memoryReady;
    element<HTMLInputElement>("onlyDifferences").disabled = !snapshot;
  }

  async function refreshMemory() {
    snapshots = await readShortcutSnapshots();
    renderMemory();
    renderCommands();
  }

  function cancelSnapshot() {
    pendingSnapshot = null;
    element("replaceSnapshot").hidden = true;
  }

  async function commitSnapshot(snapshot: Snapshot) {
    await saveShortcutSnapshot(snapshot);
    selectedPlatform = snapshot.platform;
    cancelSnapshot();
    await refreshMemory();
    showStatus("Shortcuts saved.", true);
  }

  async function proposeSnapshot(snapshot: Snapshot) {
    const latest = await readShortcutSnapshots();
    const previous = latest[snapshot.platform];
    if (
      !previous ||
      JSON.stringify(previous.bindings) === JSON.stringify(snapshot.bindings)
    ) {
      await commitSnapshot(snapshot);
      return;
    }
    pendingSnapshot = { snapshot, previous: JSON.stringify(previous) };
    const assigned = Object.values(snapshot.bindings).filter(Boolean).length;
    const oldAssigned = Object.values(previous.bindings).filter(Boolean).length;
    element("replaceSummary").textContent =
      `Replace ${PLATFORM_NAMES[snapshot.platform]} setup? ${oldAssigned} → ${assigned} assigned.`;
    element("replaceSnapshot").hidden = false;
  }

  function setupShortcutMemory() {
    listen(
      element<HTMLSelectElement>("snapshotPlatform"),
      "change",
      (event) => {
        selectedPlatform = (event.target as HTMLInputElement).value;
        renderMemory();
        renderCommands();
      },
    );
    listen(
      element<HTMLInputElement>("onlyDifferences"),
      "change",
      renderCommands,
    );
    listen(
      element<HTMLButtonElement>("rememberShortcuts"),
      "click",
      async (event) => {
        const button = event.currentTarget as HTMLButtonElement;
        button.disabled = true;
        try {
          state.commands = await readCommands();
          await proposeSnapshot(
            makeShortcutSnapshot(state.commands, localPlatform),
          );
          renderCommands();
        } catch {
          showStatus(
            "Could not remember shortcuts. Your saved setup was left intact.",
          );
        } finally {
          button.disabled = !memoryReady;
        }
      },
    );
    listen(element("cancelSnapshot"), "click", cancelSnapshot);
    listen(element("confirmSnapshot"), "click", async (event) => {
      if (!pendingSnapshot) return;
      const button = event.currentTarget as HTMLButtonElement;
      button.disabled = true;
      try {
        const pending = pendingSnapshot;
        const latest = await readShortcutSnapshots();
        if (
          JSON.stringify(latest[pending.snapshot.platform]) !== pending.previous
        ) {
          cancelSnapshot();
          await refreshMemory();
          showStatus(
            "The saved setup changed on another browser. Review it, then choose Remember current again.",
          );
        } else await commitSnapshot(pending.snapshot);
      } catch {
        showStatus("Could not save the snapshot. Try again.");
      } finally {
        button.disabled = false;
      }
    });
    listen(element<HTMLButtonElement>("exportShortcuts"), "click", () => {
      const snapshot = currentSnapshot();
      if (!snapshot) return;
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(snapshot, null, 2) + "\n"], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `simple-shortcuts-${snapshot.platform}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    });
    listen(element<HTMLButtonElement>("importShortcuts"), "click", () => {
      element<HTMLInputElement>("backupFile").click();
    });
    listen(element<HTMLInputElement>("backupFile"), "change", async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      try {
        if (!file) return;
        if (file.size > 32768) throw new Error("Backup too large");
        const snapshot = validateShortcutSnapshot(
          JSON.parse(await file.text()),
        );
        await proposeSnapshot(snapshot);
      } catch {
        showStatus(
          "This backup could not be imported. Choose a Simple Shortcuts JSON backup.",
        );
      } finally {
        (event.target as HTMLInputElement).value = "";
      }
    });
    port.watchSync((changes, area) => {
      if (
        area === "sync" &&
        Object.keys(changes).some((key) => key.startsWith(SNAPSHOT_PREFIX))
      ) {
        refreshMemory().catch(() => {
          showStatus(
            "Saved shortcuts could not refresh. Reopen the popup to try again.",
          );
        });
      }
    });
  }
  async function initialize(platform: string) {
    localPlatform = platform;
    snapshots = await readShortcutSnapshots();
    memoryReady = SNAPSHOT_PLATFORMS.includes(localPlatform);
    renderMemory();
    renderCommands();
  }
  return { setupShortcutMemory, currentSnapshot, initialize };
}
