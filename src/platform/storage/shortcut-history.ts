import type { ShortcutPort } from "../../core/shortcuts/application";
export function shortcutHistoryPort(api: typeof chrome): ShortcutPort {
  return {
    readLocal: () =>
      api.storage.local.get(["mods.device", "mods.shortcuts.local"]),
    readSync: () => api.storage.sync.get(null),
    writeLocal: (values) => api.storage.local.set(values),
    publish: (values) => api.storage.sync.set(values),
    assignments: async () =>
      Object.fromEntries(
        (await api.commands.getAll())
          .filter((c) => c.name && !c.name.startsWith("_"))
          .map((c) => [c.name ?? "", c.shortcut ?? ""]),
      ),
    platform: async () => (await api.runtime.getPlatformInfo()).os,
    newDevice: () => crypto.randomUUID(),
  };
}
