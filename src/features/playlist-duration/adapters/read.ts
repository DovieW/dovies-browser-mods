import type { PlaylistDuration, PlaylistTab } from "../domain/playlist";

// Chrome serializes this function into the isolated world. Keep page reads
// self-contained and return only aggregate metadata to the popup.
async function readPage(
  target: PlaylistTab,
  loadMore: boolean,
): Promise<PlaylistDuration | null> {
  const isCurrent = () =>
    location.protocol === "https:" &&
    ["youtube.com", "www.youtube.com"].includes(location.hostname) &&
    location.pathname === `/${target.page}` &&
    new URL(location.href).searchParams.get("list") === target.list;
  const findRoot = () => {
    const roots = document.querySelectorAll<HTMLElement>(
      target.page === "watch"
        ? "ytd-playlist-panel-renderer"
        : "ytd-browse #primary",
    );
    return Array.from(roots).find((root) => root.getClientRects().length > 0);
  };
  const continuation = (root: Element) =>
    Array.from(
      root.querySelectorAll<HTMLElement>(
        "ytd-continuation-item-renderer, yt-continuation-item-view-model",
      ),
    ).find((node) => !node.closest("[hidden]"));
  const rows = (root: Element) =>
    root.querySelectorAll(
      target.page === "watch"
        ? "ytd-playlist-panel-video-renderer"
        : "ytd-playlist-video-renderer, yt-item-section-renderer yt-lockup-view-model",
    );
  const snapshot = (root: Element): PlaylistDuration => {
    let seconds = 0,
      entries = 0,
      counted = 0;
    for (const row of rows(root)) {
      const link = row.querySelector<HTMLAnchorElement>("a[href*='list=']");
      if (link && new URL(link.href).searchParams.get("list") !== target.list)
        continue;
      if (!link && row.localName === "yt-lockup-view-model") continue;
      entries++;
      const badges = row.querySelectorAll(
        "yt-thumbnail-badge-view-model, ytd-thumbnail-overlay-time-status-renderer #text, ytd-thumbnail-overlay-time-status-renderer",
      );
      for (const badge of badges) {
        const label = badge.textContent.replace(/\s/g, "");
        if (!/^(?:\d{1,5}:)?\d{1,5}:[0-5]\d$/.test(label)) continue;
        const parts = label.split(":").map(Number);
        if (parts.length === 3 && (parts[1] ?? 0) > 59) continue;
        const duration = parts.reduce((total, part) => total * 60 + part, 0);
        if (!duration) continue;
        seconds += duration;
        counted++;
        break;
      }
    }
    const countLabel =
      target.page === "watch"
        ? root.querySelector(".index-message, #index-message")?.textContent
        : root
            .closest("ytd-browse")
            ?.querySelector(
              "yt-page-header-view-model yt-content-metadata-view-model, ytd-playlist-header-renderer #stats, ytd-playlist-sidebar-primary-info-renderer #stats",
            )?.textContent;
    const expected = countLabel
      ?.match(
        target.page === "watch"
          ? /\/\s*([\d,.\s]+)\s*$/
          : /([0-9][\d,.\s]*)\s+videos?\b/i,
      )?.[1]
      ?.replace(/\D/g, "");
    // YouTube may leave a continuation marker below a complete list.
    const expectedCount = expected ? Number(expected) : undefined;
    const more =
      Boolean(continuation(root)) &&
      (expectedCount === undefined || entries < expectedCount);
    return {
      seconds,
      entries,
      counted,
      more,
      complete:
        entries > 0 &&
        counted === entries &&
        !more &&
        (expectedCount === undefined
          ? target.page === "playlist"
          : expectedCount === entries),
    };
  };
  if (!isCurrent()) return null;
  const root = findRoot();
  if (!root) return null;
  const initial = snapshot(root);
  if (!loadMore || target.page !== "playlist" || !initial.more) return initial;

  const initialScroll = scrollY;
  const userActivity = new AbortController();
  const stop = (event: Event) => {
    if (event.isTrusted) userActivity.abort();
  };
  for (const event of ["wheel", "touchmove", "pointerdown", "keydown"])
    addEventListener(event, stop, {
      capture: true,
      passive: true,
      signal: userActivity.signal,
    });
  const deadline = performance.now() + 15_000;
  try {
    for (let batch = 0; batch < 50 && performance.now() < deadline; batch++) {
      const pending = continuation(root);
      if (
        !pending ||
        !isCurrent() ||
        !root.isConnected ||
        userActivity.signal.aborted
      )
        break;
      const count = rows(root).length;
      pending.scrollIntoView({ block: "end", behavior: "instant" });
      const advanced = await new Promise<boolean>((resolve) => {
        const finish = (advanced: boolean) => {
          observer.disconnect();
          clearTimeout(timer);
          resolve(advanced);
        };
        const observer = new MutationObserver(() => {
          if (!isCurrent() || !root.isConnected) finish(false);
          else if (rows(root).length > count || !pending.isConnected)
            finish(true);
        });
        const timer = setTimeout(
          () => {
            finish(false);
          },
          Math.min(2_500, Math.max(0, deadline - performance.now())),
        );
        observer.observe(root, { childList: true, subtree: true });
      });
      if (!advanced || !snapshot(root).more) break;
    }
  } finally {
    if (
      isCurrent() &&
      root.isConnected &&
      !userActivity.signal.aborted &&
      scrollY !== initialScroll
    )
      scrollTo({ top: initialScroll, behavior: "instant" });
    userActivity.abort();
  }
  return isCurrent() && root.isConnected ? snapshot(root) : null;
}

export async function readPlaylistDuration(
  tabId: number,
  target: PlaylistTab,
  loadMore: boolean,
): Promise<PlaylistDuration | null> {
  const [active] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (active?.id !== tabId)
    throw Error("Open the popup again on the playlist tab.");
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: readPage,
    args: [target, loadMore],
  });
  return result?.result ?? null;
}
