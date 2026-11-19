import {
  validateRecord,
  type Assignments,
  type DeviceRecord,
} from "../../core/shortcuts/history";
function assignments(value: unknown): value is Assignments {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === "string")
  );
}
export async function readShortcutSetup(): Promise<{
  actual: Assignments;
  desired: Assignments;
  records: DeviceRecord[];
}> {
  const result: unknown = await chrome.runtime.sendMessage({
    type: "mods.shortcuts.reconcile",
  });
  if (
    !result ||
    typeof result !== "object" ||
    !("ok" in result) ||
    result.ok !== true ||
    !("value" in result)
  )
    throw Error(
      "Could not save shortcut history. Local records are retained; check storage access and sync quota.",
    );
  const value: unknown = result.value;
  if (
    !value ||
    typeof value !== "object" ||
    !("actual" in value) ||
    !assignments(value.actual) ||
    !("desired" in value) ||
    !assignments(value.desired) ||
    !("records" in value) ||
    !Array.isArray(value.records) ||
    !value.records.every(validateRecord)
  )
    throw Error("Invalid shortcut response.");
  return {
    actual: value.actual,
    desired: value.desired,
    records: value.records,
  };
}

export async function adoptShortcut(command: string): Promise<void> {
  const r: unknown = await chrome.runtime.sendMessage({
    type: "mods.shortcuts.adopt",
    command,
  });
  if (!r || typeof r !== "object" || !("ok" in r) || r.ok !== true)
    throw Error("Could not save this assignment. Local records are retained.");
}
