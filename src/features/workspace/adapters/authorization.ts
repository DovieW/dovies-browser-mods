export async function authorizeLauncher(
  sender: chrome.runtime.MessageSender,
): Promise<boolean> {
  if (!sender.url?.startsWith(chrome.runtime.getURL("launcher.html")))
    return true;
  const url = new URL(sender.url),
    token = url.searchParams.get("token");
  if (!token || !sender.tab?.id) return false;
  const stored: unknown = (
    await chrome.storage.session.get(`mods.launcher.${sender.tab.id}`)
  )[`mods.launcher.${sender.tab.id}`];
  return (
    !!stored &&
    typeof stored === "object" &&
    "token" in stored &&
    stored.token === token &&
    "expires" in stored &&
    typeof stored.expires === "number" &&
    stored.expires > Date.now()
  );
}
