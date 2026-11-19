import { commands } from "../../src/core/actions/catalog";

export interface Row {
  id: string;
  title: string;
  key: string;
  missing: boolean;
}
export interface Settings {
  enabled: boolean;
  pause: number;
}
export const initialSettings: Settings = { enabled: true, pause: 1200 };
const catalog = Object.entries(commands).map(([id, command], i): Row => ({
  id,
  title: command.description,
  key: "suggested_key" in command ? command.suggested_key : "Not assigned",
  missing: i % 3 === 0,
}));
const count =
  new URLSearchParams(location.search).get("size") === "1000"
    ? 1000
    : catalog.length;
export const rows: Row[] = Array.from({ length: count }, (_, i) => {
  const row = catalog[i % catalog.length];
  if (!row) throw Error("Empty command catalog");
  return {
    ...row,
    id: `${row.id}-${i}`,
    title:
      count === catalog.length ? row.title : `${row.title} · item ${i + 1}`,
  };
});
export const matches = (row: Row, query: string) =>
  `${row.title} ${row.key}`.toLowerCase().includes(query.trim().toLowerCase());
export const validPause = (pause: number) =>
  Number.isInteger(pause) && pause >= 100 && pause <= 5000;
export const settingsText = (settings: Settings) =>
  `Saved: ${settings.enabled ? "enabled" : "disabled"}, ${settings.pause} ms`;
export const rowText = (row: Row) =>
  `${row.title} — ${row.key}${row.missing ? " — Desired shortcut is missing on this device" : ""}`;
