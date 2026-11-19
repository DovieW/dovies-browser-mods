// The same explicit wrap behavior for both native-dialog implementations.
// Browser-native modal Tab traversal can otherwise leave document focus for browser chrome.
export function trapDialogTab(event: KeyboardEvent, dialog: HTMLElement) {
  if (event.key !== "Tab") return;
  const focusable = [
    ...dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]',
    ),
  ];
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
