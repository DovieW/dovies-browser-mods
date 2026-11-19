export interface PlaylistTab {
  list: string;
  page: "playlist" | "watch";
}

export interface PlaylistDuration {
  seconds: number;
  entries: number;
  counted: number;
  complete: boolean;
  more: boolean;
}

export function playlistTab(url: string): PlaylistTab | null {
  const parsed = URL.canParse(url) ? new URL(url) : null;
  if (
    parsed?.protocol !== "https:" ||
    !["www.youtube.com", "youtube.com"].includes(parsed.hostname) ||
    !["/playlist", "/watch"].includes(parsed.pathname)
  )
    return null;
  const list = parsed.searchParams.get("list");
  if (!list || !/^[\w-]{2,150}$/.test(list)) return null;
  return { list, page: parsed.pathname === "/playlist" ? "playlist" : "watch" };
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  return [
    hours ? `${hours}h` : "",
    minutes ? `${minutes}m` : "",
    `${seconds % 60}s`,
  ]
    .filter(Boolean)
    .join(" ");
}
