import {
  desired,
  observe,
  validateRecord,
  type Assignments,
  type DeviceRecord,
} from "./history";
export interface ShortcutPort {
  readLocal(): Promise<Record<string, unknown>>;
  readSync(): Promise<Record<string, unknown>>;
  writeLocal(value: Record<string, unknown>): Promise<void>;
  publish(value: Record<string, DeviceRecord>): Promise<void>;
  assignments(): Promise<Assignments>;
  platform(): Promise<string>;
  newDevice(): string;
}
export function createShortcutService(port: ShortcutPort) {
  const prefix = "mods.shortcuts.device.";
  let pending: Promise<unknown> = Promise.resolve();
  async function reconcileShortcuts(): Promise<{
    actual: Assignments;
    desired: Assignments;
    records: DeviceRecord[];
  }> {
    const task = pending.then(async () => {
      const local = await port.readLocal();
      const device =
        typeof local["mods.device"] === "string" &&
        /^[a-zA-Z0-9-]{1,80}$/.test(local["mods.device"])
          ? local["mods.device"]
          : port.newDevice();
      if (local["mods.device"] !== device)
        await port.writeLocal({ "mods.device": device });
      const stored = await port.readSync();
      const records = Object.entries(stored)
        .filter(([key]) => key.startsWith(prefix))
        .map(([, value]: [string, unknown]) => value)
        .filter(validateRecord);
      const own: unknown = local["mods.shortcuts.local"];
      const record: DeviceRecord =
        validateRecord(own) && own.device === device
          ? own
          : { device, clock: 0, baseline: {}, revisions: [] };
      if (!records.length && !record.revisions.length) {
        const platform = await port.platform();
        const legacy: unknown = stored[`shortcutSnapshotV1-${platform}`];
        if (
          legacy &&
          typeof legacy === "object" &&
          "bindings" in legacy &&
          legacy.bindings &&
          typeof legacy.bindings === "object"
        ) {
          for (const [command, binding] of Object.entries(legacy.bindings)) {
            if (
              typeof binding !== "string" ||
              binding.length > 100 ||
              command.length > 100
            )
              continue;
            record.clock++;
            record.revisions.push({
              id: `${device}:${record.clock}`,
              device,
              command,
              binding,
              clock: record.clock,
              observedAt: Date.now(),
            });
          }
        }
      }
      const actual = await port.assignments();
      const next = observe(record, actual, [...records, record], Date.now());
      if (JSON.stringify(own) !== JSON.stringify(next))
        await port.writeLocal({ "mods.shortcuts.local": next });
      // Each device owns separate keys. Split by command to respect per-item quota.
      const groups = new Map<string, typeof next.revisions>();
      for (const revision of next.revisions)
        groups.set(
          revision.command,
          [...(groups.get(revision.command) ?? []), revision].slice(-10),
        );
      const writes: Record<string, DeviceRecord> = {};
      for (const [command, revisions] of groups) {
        const shard: DeviceRecord = {
          device,
          clock: Math.max(...revisions.map((r) => r.clock)),
          baseline: {},
          revisions,
        };
        const key = `${prefix}${device}.${command}`;
        if (JSON.stringify(stored[key]) !== JSON.stringify(shard))
          writes[key] = shard;
      }
      if (Object.keys(writes).length) {
        const size = new TextEncoder().encode(
          JSON.stringify({ ...stored, ...writes }),
        ).length;
        if (size > 85000)
          throw Error(
            "Shortcut sync storage is nearly full. Your changes remain saved locally.",
          );
        await port.publish(writes);
      }
      const merged = [...records.filter((r) => r.device !== device), next];
      return { actual, desired: desired(merged), records: merged };
    });
    pending = task.catch(() => undefined);
    return task;
  }

  async function adoptAssignment(command: string): Promise<void> {
    await reconcileShortcuts();
    const task = pending.then(async () => {
      const local = await port.readLocal();
      const own: unknown = local["mods.shortcuts.local"];
      if (!validateRecord(own)) throw Error("Shortcut history is unavailable.");
      const actual = await port.assignments();
      if (!Object.hasOwn(actual, command)) throw Error("Unknown shortcut.");
      const sync = await port.readSync();
      const peers = Object.values(sync).filter(validateRecord);
      const clock = Math.max(own.clock, ...peers.map((p) => p.clock)) + 1;
      const next: DeviceRecord = {
        ...own,
        clock,
        baseline: { ...actual },
        revisions: [
          ...own.revisions,
          {
            id: `${own.device}:${clock}`,
            device: own.device,
            command,
            binding: actual[command] ?? "",
            clock,
            observedAt: Date.now(),
          },
        ].slice(-1000),
      };
      await port.writeLocal({ "mods.shortcuts.local": next });
    });
    pending = task.catch(() => undefined);
    await task;
    await reconcileShortcuts();
  }
  return { reconcileShortcuts, adoptAssignment };
}
