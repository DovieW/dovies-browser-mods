export async function consumePaletteRequest(): Promise<boolean> {
  const value = await chrome.storage.session.get("mods.palette.open");
  await chrome.storage.session.remove("mods.palette.open");
  return value["mods.palette.open"] === true;
}

export async function checkLauncher(): Promise<boolean> {
  const r: unknown = await chrome.runtime.sendMessage({
    type: "mods.launcher.authorize",
  });
  return !!r && typeof r === "object" && "ok" in r && r.ok === true;
}
