import { initialize } from "../../features/shortcut-setup/public";
import { showShortcutNotice } from "../../ui/shortcut-notice";
document.addEventListener("DOMContentLoaded", () => {
  void initialize();
  void showShortcutNotice();
});
