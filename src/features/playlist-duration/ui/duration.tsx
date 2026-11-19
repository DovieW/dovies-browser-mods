import { useEffect, useState } from "react";
import { readPlaylistDuration } from "../adapters/read";
import {
  formatDuration,
  type PlaylistDuration,
  type PlaylistTab,
} from "../domain/playlist";

export function PlaylistDurationCard({
  target,
  tabId,
  openPlaylist,
}: {
  target: PlaylistTab;
  tabId: number;
  openPlaylist: (url: string) => Promise<unknown>;
}) {
  const [result, setResult] = useState<PlaylistDuration | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadMore, setLoadMore] = useState(false);
  const [request, setRequest] = useState(0);
  useEffect(() => {
    let alive = true;
    setBusy(true);
    setError("");
    void readPlaylistDuration(tabId, target, loadMore)
      .then((value) => {
        if (!alive) return;
        setResult(value);
        if (!value?.entries)
          setError("YouTube hasn’t loaded any playlist entries yet.");
      })
      .catch(() => {
        if (alive)
          setError(
            "Couldn’t read this playlist. Open the toolbar popup on the playlist tab and try again.",
          );
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [tabId, target.list, target.page, loadMore, request]);
  function recalculate(more: boolean) {
    setLoadMore(more);
    setRequest((value) => value + 1);
  }
  const showPlaylist = target.page === "watch" && !result?.complete;
  return (
    <section
      className="context playlist-duration"
      aria-label="YouTube playlist duration"
    >
      <h2>Playlist duration</h2>
      <div role="status" aria-atomic="true">
        {busy ? (
          <p>{loadMore ? "Loading more videos…" : "Reading playlist…"}</p>
        ) : error ? (
          <p>{error}</p>
        ) : (
          result && (
            <>
              <p>
                <strong>
                  {result.counted
                    ? formatDuration(result.seconds)
                    : "Duration unavailable"}
                </strong>
                {result.counted > 0 &&
                  ` · ${result.complete ? "Total" : "Subtotal"} · ${result.counted} ${result.counted === 1 ? "video" : "videos"}`}
              </p>
              {result.entries > result.counted && (
                <p className="muted">
                  {result.entries - result.counted} loaded{" "}
                  {result.entries - result.counted === 1
                    ? "entry has"
                    : "entries have"}{" "}
                  no readable duration.
                </p>
              )}
              {!result.complete &&
                !result.more &&
                !showPlaylist &&
                result.entries === result.counted && (
                  <p className="muted">
                    The loaded entries don’t match YouTube’s playlist count.
                  </p>
                )}
              {(result.more || showPlaylist) && (
                <p className="muted">
                  {showPlaylist
                    ? "The watch sidebar may only show part of the playlist."
                    : loadMore
                      ? "More entries may still be available. If loading stalls, scroll down on the playlist page and reopen the popup."
                      : "YouTube has more entries to load."}
                </p>
              )}
            </>
          )
        )}
      </div>
      {!busy &&
        (result?.more && target.page === "playlist" ? (
          <button
            type="button"
            onClick={() => {
              recalculate(true);
            }}
          >
            Load more and recalculate
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              recalculate(false);
            }}
          >
            Recalculate
          </button>
        ))}
      {!busy && showPlaylist && (
        <button
          type="button"
          onClick={() => {
            const url = new URL("https://www.youtube.com/playlist");
            url.searchParams.set("list", target.list);
            void openPlaylist(url.href).catch(() => {
              setError("Couldn’t open the playlist page.");
            });
          }}
        >
          Open playlist page
        </button>
      )}
    </section>
  );
}
