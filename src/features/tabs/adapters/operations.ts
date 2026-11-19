import { isBlankTab, sections } from "../domain/policy";
import { present } from "../../../core/present";
import { readSession } from "./session";
import type { BrowserPort } from "../../../platform/chrome/browser";
import type { Tab, CommandContext } from "../../../contracts/browser";
import { commandError, commandErrorCode } from "../../../core/actions/errors";
import { createContextService } from "../../../platform/chrome/context";

export function createTabOperations(
  chrome: Pick<BrowserPort, "tabs" | "windows" | "tabGroups" | "storage">,
) {
  const NONE = -1;
  const { normalWindows, safeGetTab } = createContextService(chrome);
  async function createNewTab(context: CommandContext, position: string) {
    if (!context.active) return;
    const groupId = position !== "end" ? context.active.groupId : NONE;
    const groupTabs = context.tabs.filter((tab) => tab.groupId === groupId);
    const index =
      position === "end"
        ? context.tabs.length
        : position === "group" && groupId !== NONE
          ? present(groupTabs.at(-1)).index + 1
          : context.active.index + 1;
    const candidate =
      position === "near" || (position === "group" && groupId === NONE)
        ? context.tabs[index]
        : context.tabs[index - 1];
    const reusable = isBlankTab(candidate) && candidate.groupId === groupId;
    // Create and group before closing anything: one-tab windows/groups stay alive.
    const created = await chrome.tabs.create({
      windowId: context.window.id,
      index: reusable ? candidate.index : index,
      active: true,
    });
    if (groupId !== NONE)
      await chrome.tabs.group({ groupId, tabIds: created.id });
    else await chrome.tabs.ungroup(created.id);
    if (reusable) {
      const fresh = await safeGetTab(candidate.id);
      if (
        isBlankTab(fresh) &&
        fresh.groupId === groupId &&
        fresh.windowId === context.window.id
      ) {
        await chrome.tabs.remove(candidate.id);
      }
    }
  }

  async function highlightIds(
    windowId: number,
    ids: number[],
    activeId = ids[0],
  ) {
    const tabs = await chrome.tabs.query({ windowId });
    const selected = ids
      .map((id) => tabs.find((tab) => tab.id === id))
      .filter((tab): tab is Tab => !!tab);
    selected.sort(
      (a, b) => Number(b.id === activeId) - Number(a.id === activeId),
    );
    if (selected.length)
      await chrome.tabs.highlight({
        windowId,
        tabs: selected.map((tab) => tab.index),
      });
  }

  async function duplicateTabs(context: CommandContext) {
    const ids = [];
    for (const original of context.selected) {
      const source = await chrome.tabs.get(original.id);
      const duplicate = await chrome.tabs.duplicate(source.id);
      ids.push(duplicate.id);
      await chrome.tabs.update(duplicate.id, { pinned: source.pinned });
      if (source.groupId !== NONE)
        await chrome.tabs.group({
          groupId: source.groupId,
          tabIds: duplicate.id,
        });
      else if (!source.pinned) await chrome.tabs.ungroup(duplicate.id);
      const refreshed = await chrome.tabs.get(source.id);
      await chrome.tabs.move(duplicate.id, { index: refreshed.index + 1 });
    }
    await highlightIds(context.window.id, ids);
  }

  async function discardTabs(context: CommandContext) {
    if (!context.selected.length) throw commandError("no_tab");
    // Keep the original selection: activating a fallback clears highlighting.
    const ids = new Set(context.selected.map((tab) => tab.id));
    const tabs = await chrome.tabs.query({ windowId: context.window.id });
    let failed = false;
    if (tabs.some((tab) => tab.active && ids.has(tab.id))) {
      const collapsed = new Set(
        (await chrome.tabGroups.query({ windowId: context.window.id }))
          .filter((group) => group.collapsed)
          .map((group) => group.id),
      );
      // Do not reload another discarded tab or expand a collapsed group just to
      // park focus. Chrome requires one active tab that is not being discarded.
      const fallback = tabs.find(
        (tab) =>
          !ids.has(tab.id) && !tab.discarded && !collapsed.has(tab.groupId),
      );
      try {
        if (fallback) await chrome.tabs.update(fallback.id, { active: true });
        else
          await chrome.tabs.create({
            windowId: context.window.id,
            url: "chrome://newtab/",
            active: true,
          });
      } catch {
        failed = true;
      }
    }
    for (const id of ids) {
      try {
        const tab = await chrome.tabs.get(id);
        // A tab moved by the user during the command is no longer our target.
        if (
          tab.windowId !== context.window.id ||
          tab.incognito !== context.window.incognito
        ) {
          throw commandError("invalid_target");
        }
        if (tab.discarded) continue;
        const discarded = await chrome.tabs.discard(id);
        if (!discarded?.discarded) throw commandError("discard_partial");
      } catch (error) {
        // Closed targets need no unloading. Other failures must be visible, and
        // must not prevent the rest of a multi-tab selection from being tried.
        if (commandErrorCode(error) !== "no_tab") failed = true;
      }
    }
    if (failed) throw commandError("discard_partial");
  }

  async function setPinned(tabs: Tab[], pinned: boolean) {
    for (const tab of pinned ? tabs : [...tabs].reverse())
      await chrome.tabs.update(tab.id, { pinned });
  }

  async function moveBlock(tabs: Tab[], index: number, direction: number) {
    if (!tabs.length) return;
    const ordered = direction > 0 ? [...tabs].reverse() : tabs;
    for (const tab of ordered) {
      const offset = tabs.findIndex((item) => item.id === tab.id);
      await chrome.tabs.move(tab.id, { index: index + offset });
    }
  }

  async function moveSide(
    context: CommandContext,
    direction: number,
    bounded = false,
  ) {
    const selected = context.selected;
    if (!selected.length) return;
    const parts = sections(selected, context.tabs);
    if (parts.length > 1 && !bounded) {
      // Mixed selections stay within their existing pin/group sections.
      for (const part of direction > 0 ? [...parts].reverse() : parts) {
        const tabs = await chrome.tabs.query({ windowId: context.window.id });
        await moveSide(
          {
            ...context,
            tabs,
            selected: part
              .map((tab) => tabs.find((item) => item.id === tab.id))
              .filter((tab): tab is Tab => !!tab),
          },
          direction,
          true,
        );
      }
      await highlightIds(
        context.window.id,
        selected.map((tab) => tab.id),
        context.active?.id,
      );
      return;
    }
    const first = selected[0];
    const last = selected.at(-1);
    if (!first || !last) return;
    const selectedIds = new Set(selected.map((tab) => tab.id));
    let index = direction < 0 ? first.index - 1 : last.index + 1;
    let neighbor = context.tabs[index];
    if (bounded) {
      const within = (tab: Tab) =>
        tab.pinned === first.pinned && tab.groupId === first.groupId;
      if (!neighbor || !within(neighbor)) return;
    }
    if (!neighbor) {
      if (!bounded && first.groupId !== NONE)
        await chrome.tabs.ungroup(selected.map((tab) => tab.id));
      return;
    }
    if (neighbor.pinned !== first.pinned) {
      if (!bounded) await setPinned(selected, neighbor.pinned);
      return;
    }
    if (first.groupId !== NONE && neighbor.groupId !== first.groupId) {
      if (!bounded) await chrome.tabs.ungroup(selected.map((tab) => tab.id));
      return;
    }
    const groups = await chrome.tabGroups.query({
      windowId: context.window.id,
    });
    const collapsed = new Set(
      groups.filter((group) => group.collapsed).map((group) => group.id),
    );
    let skipped = false;
    while (
      index >= 0 &&
      index < context.tabs.length &&
      collapsed.has(present(context.tabs[index]).groupId) &&
      present(context.tabs[index]).groupId !== first.groupId
    ) {
      skipped = true;
      index += direction;
    }
    neighbor = context.tabs[index];
    if (
      !skipped &&
      neighbor &&
      !neighbor.pinned &&
      first.groupId === NONE &&
      neighbor.groupId !== NONE &&
      !collapsed.has(neighbor.groupId)
    ) {
      await chrome.tabs.group({
        groupId: neighbor.groupId,
        tabIds: selected.map((tab) => tab.id),
      });
    } else {
      // Insertion indices are computed after removing the selected tabs.
      const remaining = context.tabs.filter((tab) => !selectedIds.has(tab.id));
      let insertion;
      if (direction < 0)
        insertion = remaining.filter((tab) =>
          skipped ? tab.index <= index : tab.index < index,
        ).length;
      else
        insertion = remaining.filter((tab) =>
          skipped ? tab.index < index : tab.index <= index,
        ).length;
      insertion = Math.max(
        first.pinned ? 0 : remaining.filter((tab) => tab.pinned).length,
        insertion,
      );
      await moveBlock(selected, insertion, direction);
    }
    await highlightIds(
      context.window.id,
      selected.map((tab) => tab.id),
      context.active?.id,
    );
  }

  async function moveEdge(context: CommandContext, back: boolean) {
    if (!context.selected.length) return;
    const command = back ? "move-tabs-to-back" : "move-tabs-to-front";
    const { lastAction } = await readSession(
      chrome.storage.session,
      "lastAction",
    );
    const ids = context.selected.map((tab) => tab.id);
    const repeat =
      lastAction?.command === command &&
      lastAction.windowId === context.window.id &&
      Date.now() - lastAction.at < 2000 &&
      JSON.stringify(lastAction.ids) === JSON.stringify(ids);
    const parts = sections(context.selected, context.tabs);
    for (const part of back ? [...parts].reverse() : parts) {
      const all = await chrome.tabs.query({ windowId: context.window.id });
      const first = part[0];
      if (!first) continue;
      let domain = all.filter((tab) =>
        first.pinned
          ? tab.pinned
          : first.groupId !== NONE
            ? tab.groupId === first.groupId
            : !tab.pinned,
      );
      if (parts.length > 1 && !first.pinned && first.groupId === NONE) {
        // Restrict ungrouped selections to the contiguous segment containing them.
        const low =
          all
            .slice(0, first.index)
            .findLast((tab) => tab.pinned || tab.groupId !== NONE)?.index ?? -1;
        const high =
          all.slice(first.index + 1).find((tab) => tab.groupId !== NONE)
            ?.index ?? all.length;
        domain = domain.filter((tab) => tab.index > low && tab.index < high);
        if (!part.every((tab) => domain.some((item) => item.id === tab.id)))
          continue;
      }
      const index = back
        ? present(domain.at(-1)).index - part.length + 1
        : present(domain[0]).index;
      const atEdge = part.every(
        (tab, i) => all.find((item) => item.id === tab.id)?.index === index + i,
      );
      if (repeat && parts.length === 1 && atEdge && first.groupId !== NONE)
        await chrome.tabs.ungroup(part.map((tab) => tab.id));
      else if (
        repeat &&
        parts.length === 1 &&
        atEdge &&
        ((!back && !first.pinned) || (back && first.pinned))
      )
        await setPinned(part, !back);
      else {
        await moveBlock(part, index, back ? 1 : -1);
        if (first.groupId === NONE && !first.pinned)
          await chrome.tabs.ungroup(part.map((tab) => tab.id));
      }
    }
    await chrome.storage.session.set({
      lastAction: { command, windowId: context.window.id, ids, at: Date.now() },
    });
    await highlightIds(context.window.id, ids, context.active?.id);
  }

  async function cycleGroups(context: CommandContext) {
    if (!context.selected.length) return;
    const groups = await chrome.tabGroups.query({
      windowId: context.window.id,
    });
    groups.sort(
      (a, b) =>
        (context.tabs.find((tab) => tab.groupId === a.id)?.index ?? Infinity) -
        (context.tabs.find((tab) => tab.groupId === b.id)?.index ?? Infinity),
    );
    if (!groups.length) throw commandError("no_group");
    const current = groups.findIndex(
      (group) => group.id === context.active?.groupId,
    );
    const target = groups[(current + 1) % groups.length];
    if (!target) throw commandError("invalid_target");
    await setPinned(
      context.selected.filter((tab) => tab.pinned),
      false,
    );
    await chrome.tabs.group({
      groupId: target.id,
      tabIds: context.selected.map((tab) => tab.id),
    });
    await chrome.tabGroups.update(target.id, { collapsed: false });
    await highlightIds(
      context.window.id,
      context.selected.map((tab) => tab.id),
      context.active?.id,
    );
  }

  async function cycleWindows(context: CommandContext, move: boolean) {
    const windows = (await normalWindows())
      .filter((window) => window.incognito === context.window.incognito)
      .sort((a, b) => a.id - b.id);
    if (windows.length < 2) throw commandError("no_other_window");
    const target =
      windows[
        (windows.findIndex((window) => window.id === context.window.id) + 1) %
          windows.length
      ];
    if (!target) throw commandError("invalid_target");
    if (move) {
      // Cross-window tab groups cannot retain their IDs. Recreate their metadata.
      const groups = await chrome.tabGroups.query({
        windowId: context.window.id,
      });
      const moved = [];
      for (const tab of context.selected) {
        await chrome.tabs.move(tab.id, {
          windowId: target.id,
          index: tab.pinned
            ? (await chrome.tabs.query({ windowId: target.id, pinned: true }))
                .length
            : -1,
        });
        moved.push(tab.id);
      }
      for (const group of groups) {
        const ids = context.selected
          .filter((tab) => tab.groupId === group.id)
          .map((tab) => tab.id);
        if (!ids.length) continue;
        const groupId = await chrome.tabs.group({
          tabIds: ids,
          createProperties: { windowId: target.id },
        });
        await chrome.tabGroups.update(groupId, {
          title: group.title ?? "",
          color: group.color,
          collapsed: false,
        });
      }
      await highlightIds(target.id, moved, context.active?.id);
    }
    await chrome.windows.update(target.id, { focused: true });
  }

  async function moveAllGroups(context: CommandContext) {
    const groups = await chrome.tabGroups.query({
      windowId: context.window.id,
    });
    groups.sort(
      (a, b) =>
        (context.tabs.find((tab) => tab.groupId === a.id)?.index ?? Infinity) -
        (context.tabs.find((tab) => tab.groupId === b.id)?.index ?? Infinity),
    );
    if (!groups.length) throw commandError("no_group");
    const grouped = context.tabs.filter((tab) => tab.groupId !== NONE);
    const ungrouped = context.tabs.filter(
      (tab) => tab.groupId === NONE && !tab.pinned,
    );
    const atBack =
      !ungrouped.length ||
      Math.min(...grouped.map((tab) => tab.index)) >
        Math.max(...ungrouped.map((tab) => tab.index));
    for (const group of atBack ? [...groups].reverse() : groups) {
      await chrome.tabGroups.move(group.id, {
        index: atBack ? context.tabs.filter((tab) => tab.pinned).length : -1,
      });
    }
  }
  return {
    createNewTab,
    highlightIds,
    duplicateTabs,
    discardTabs,
    setPinned,
    moveBlock,
    moveSide,
    moveEdge,
    cycleGroups,
    cycleWindows,
    moveAllGroups,
    isBlankTab,
  };
}
