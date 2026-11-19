export type Result = {
  id: string;
  label: string;
  group: string;
  key?: string;
  run: () => Promise<unknown>;
  stay?: boolean;
};
export const pages = [
  "Appearance & navigation",
  "Shortcuts",
  "Mods",
  "Site access",
  "Sync & backup",
] as const;
export const planned = [
  "Full-page capture & PDF",
  "Extension profiles & ZIP export",
  "Video saving",
  "Per-tab mono",
  "Domain warnings",
  "Selection highlighting",
  "Refresh scheduling",
  "Quick Bookmark",
];
export const settings = [
  { label: "Toolbar popup layout", page: pages[0], control: "layout" },
  { label: "Command palette location", page: pages[0], control: "placement" },
  { label: "Palette search mode", page: pages[0], control: "searchMode" },
  {
    label: "Show disabled mods in search",
    page: pages[0],
    control: "includeDisabled",
  },
  {
    label: "Pinned actions and ordering",
    page: pages[0],
    control: "action-order",
  },
  {
    label: "Keyboard shortcuts and history",
    page: "Shortcuts",
    control: "shortcut-settings",
  },
  { label: "Enable or disable mods", page: "Mods", control: "mod-settings" },
  {
    label: "Site permissions and access",
    page: "Site access",
    control: "site-settings",
  },
  {
    label: "Sync, import and export",
    page: "Sync & backup",
    control: "backup-settings",
  },
];
