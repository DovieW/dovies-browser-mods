export type WorkerMessage =
  | { target: "background"; type: "run-command"; command: string }
  | { target: "background"; type: "focus-tab" | "mute-tab"; tabId: number };
export function parseWorkerMessage(value: unknown): WorkerMessage | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("target" in value) ||
    value.target !== "background" ||
    !("type" in value)
  )
    return null;
  if (
    value.type === "run-command" &&
    "command" in value &&
    typeof value.command === "string" &&
    value.command.length <= 100
  )
    return { target: "background", type: value.type, command: value.command };
  if (
    (value.type === "focus-tab" || value.type === "mute-tab") &&
    "tabId" in value &&
    typeof value.tabId === "number" &&
    Number.isSafeInteger(value.tabId) &&
    value.tabId >= 0
  )
    return { target: "background", type: value.type, tabId: value.tabId };
  return null;
}
export function succeeded(value: unknown): value is { ok: true } {
  return (
    !!value && typeof value === "object" && "ok" in value && value.ok === true
  );
}
