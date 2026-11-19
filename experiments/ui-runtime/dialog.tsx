import { useLayoutEffect, useRef } from "react";
import { trapDialogTab } from "./dialog-focus";
export interface DialogProps {
  open: boolean;
  onClose(): void;
}
export function SettingsDialog({ open, onClose }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) dialog.showModal();
    else if (dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby="help-title"
      onCancel={onClose}
      onClose={onClose}
      onKeyDown={(event) =>
        trapDialogTab(event.nativeEvent, event.currentTarget)
      }
    >
      <h2 id="help-title">Shortcut setup</h2>
      <p>
        Chrome manages browser-wide shortcut assignments. Desired settings can
        differ on this device.
      </p>
      <a href="#commands" onClick={(event) => event.preventDefault()}>
        Review desired shortcuts
      </a>
      <button id="dialog-close" onClick={onClose}>
        Close
      </button>
    </dialog>
  );
}
