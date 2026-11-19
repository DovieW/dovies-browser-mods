import { readShortcutSetup } from "../platform/messaging/shortcuts";
export async function showShortcutNotice(): Promise<void> {
  const notice = document.createElement("a");
  notice.href = "options.html";
  notice.target = "_blank";
  notice.setAttribute("role", "status");
  document.querySelector("header")?.after(notice);
  try {
    const setup = await readShortcutSetup();
    const count = Object.entries(setup.desired).filter(
      ([name, key]) => key !== setup.actual[name],
    ).length;
    notice.textContent = count
      ? `${count} desired shortcuts need attention — review setup`
      : "Shortcut setup and history";
  } catch {
    notice.textContent = "Shortcut history could not be saved — review setup";
  }
}
