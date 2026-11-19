import * as Dialog from "@radix-ui/react-dialog";
import type { DialogProps } from "./dialog";
export function SettingsDialog({ open, onClose }: DialogProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className="dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById("dialog-trigger")?.focus();
          }}
        >
          <Dialog.Title>Shortcut setup</Dialog.Title>
          <Dialog.Description>
            Chrome manages browser-wide shortcut assignments. Desired settings
            can differ on this device.
          </Dialog.Description>
          <a href="#commands" onClick={(event) => event.preventDefault()}>
            Review desired shortcuts
          </a>
          <Dialog.Close id="dialog-close">Close</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
