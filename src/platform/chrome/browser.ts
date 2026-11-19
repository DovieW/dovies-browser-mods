import type { Tab, BrowserWindow } from "../../contracts/browser";
function tab(value: chrome.tabs.Tab | undefined): Tab {
  if (!value || typeof value.id !== "number") throw Error("No tab");
  return { ...value, id: value.id, url: value.url ?? "" };
}
function window(value: chrome.windows.Window): BrowserWindow {
  if (typeof value.id !== "number") throw Error("No window");
  return { ...value, id: value.id };
}
export function createBrowserPort(api: typeof chrome) {
  return {
    ...api,
    tabs: {
      ...api.tabs,
      ungroup: async (ids: number | number[]) => {
        const list = typeof ids === "number" ? [ids] : ids;
        if (list.length) await api.tabs.ungroup(list as [number, ...number[]]);
      },
      group: async (props: {
        tabIds: number | number[];
        groupId?: number;
        createProperties?: { windowId: number };
      }) => {
        const ids =
          typeof props.tabIds === "number" ? [props.tabIds] : props.tabIds;
        if (!ids.length) throw Error("No tab");
        return api.tabs.group({
          ...props,
          tabIds: ids as [number, ...number[]],
        });
      },
      query: async (query: chrome.tabs.QueryInfo) =>
        (await api.tabs.query(query)).map(tab),
      get: async (id: number) => tab(await api.tabs.get(id)),
      create: async (props: chrome.tabs.CreateProperties) =>
        tab(await api.tabs.create(props)),
      update: async (id: number, props: chrome.tabs.UpdateProperties) =>
        tab(await api.tabs.update(id, props)),
      duplicate: async (id: number) => tab(await api.tabs.duplicate(id)),
      discard: async (id: number) => {
        const value = await api.tabs.discard(id);
        return value ? tab(value) : undefined;
      },
    },
    tabGroups: { ...api.tabGroups },
    windows: {
      ...api.windows,
      getAll: async (query: chrome.windows.QueryOptions) =>
        (await api.windows.getAll(query)).map(window),
      get: async (id: number) => window(await api.windows.get(id)),
      getLastFocused: async (query: chrome.windows.QueryOptions) =>
        window(await api.windows.getLastFocused(query)),
      update: async (id: number, props: chrome.windows.UpdateInfo) =>
        window(await api.windows.update(id, props)),
    },
  };
}
export type BrowserPort = ReturnType<typeof createBrowserPort>;
