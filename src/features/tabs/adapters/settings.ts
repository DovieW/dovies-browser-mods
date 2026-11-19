import { listenerScope } from "../../../platform/chrome/listeners";
import {
  TAB_SETTINGS_PREFIX,
  TAB_SETTINGS_DEFAULTS,
  normalizeTabSettings,
} from "../domain/settings";
import type { TabSettings } from "../../../contracts/browser";

export function createTabSettings(storage: typeof chrome.storage) {
  async function readTabSettings() {
    const names = Object.keys(TAB_SETTINGS_DEFAULTS);
    const stored = await storage.sync.get(
      names.map((name) => TAB_SETTINGS_PREFIX + name),
    );
    return normalizeTabSettings(
      Object.fromEntries(
        names.map((name) => [name, stored[TAB_SETTINGS_PREFIX + name]]),
      ),
    );
  }

  async function saveTabSettings(patch: Partial<TabSettings>) {
    const normalized = normalizeTabSettings(patch);
    // Each setting has its own sync key, so changing the pause on one device
    // doesn't overwrite an unrelated setting changed on another device.
    const values: Record<string, unknown> = {};
    for (const name of Object.keys(
      TAB_SETTINGS_DEFAULTS,
    ) as (keyof TabSettings)[]) {
      if (!Object.hasOwn(patch, name)) continue;
      if (patch[name] !== normalized[name])
        throw new Error("Invalid tab switching setting");
      values[TAB_SETTINGS_PREFIX + name] = patch[name];
    }
    await storage.sync.set(values);
  }

  return { readTabSettings, saveTabSettings };
}

export function tabSettingsClient() {
  const scope = listenerScope();
  return {
    ...createTabSettings(chrome.storage),
    watch: (
      callback: (
        changes: Record<string, chrome.storage.StorageChange>,
        area: string,
      ) => void,
    ) => {
      scope.listen(chrome.storage.onChanged, callback);
    },
    dispose: () => {
      scope.dispose();
    },
  };
}
