import {
  validatePreferences,
  parsePreferences,
  preferenceDefaults,
  type Preferences,
} from "../domain/preferences";
const prefix = "mods.ui.v1.";
export async function readPreferences(): Promise<Preferences> {
  const all = await chrome.storage.sync.get(
    Object.keys(preferenceDefaults).map((k) => prefix + k),
  );
  return parsePreferences(
    Object.fromEntries(
      Object.entries(all)
        .filter(([k]) => k.startsWith(prefix))
        .map(([k, v]) => [k.slice(prefix.length), v]),
    ),
  );
}
export async function savePreference<K extends keyof Preferences>(
  key: K,
  value: Preferences[K],
): Promise<void> {
  await chrome.storage.sync.set({
    [prefix + key]: parsePreferences({ [key]: value })[key],
  });
}
export function watchPreferences(callback: () => void) {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (
      area === "sync" &&
      Object.keys(changes).some((k) => k.startsWith(prefix))
    )
      callback();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}
async function savePreferences(value: Preferences): Promise<void> {
  await chrome.storage.sync.set(
    Object.fromEntries(Object.entries(value).map(([k, v]) => [prefix + k, v])),
  );
}
export async function importPreferences(value: Preferences): Promise<void> {
  await chrome.storage.local.set({
    "mods.ui.importBackup": await readPreferences(),
  });
  await savePreferences(value);
}
export async function restorePreferences(): Promise<void> {
  const value: unknown = (
    await chrome.storage.local.get("mods.ui.importBackup")
  )["mods.ui.importBackup"];
  if (!validatePreferences(value))
    throw Error("No previous import to restore.");
  await savePreferences(value);
}
