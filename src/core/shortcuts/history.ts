export interface Revision {
  id: string;
  device: string;
  command: string;
  binding: string;
  observedAt: number;
  clock: number;
}
export type Assignments = Record<string, string>;
export interface DeviceRecord {
  device: string;
  clock: number;
  baseline: Assignments;
  revisions: Revision[];
}
export function desired(records: readonly DeviceRecord[]): Assignments {
  const winners = new Map<string, Revision>();
  for (const record of records)
    for (const revision of record.revisions) {
      const old = winners.get(revision.command);
      if (
        !old ||
        revision.clock > old.clock ||
        (revision.clock === old.clock &&
          (revision.observedAt > old.observedAt ||
            (revision.observedAt === old.observedAt && revision.id > old.id)))
      )
        winners.set(revision.command, revision);
    }
  return Object.fromEntries(
    [...winners].map(([name, revision]) => [name, revision.binding]),
  );
}
export function observe(
  record: DeviceRecord,
  actual: Assignments,
  peers: readonly DeviceRecord[],
  now: number,
): DeviceRecord {
  const known = desired(peers);
  let clock = Math.max(record.clock, ...peers.map((peer) => peer.clock));
  const revisions = [...record.revisions];
  for (const [command, binding] of Object.entries(actual)) {
    const previous = record.baseline[command];
    // Baseline on a new device never replaces an existing desired setup.
    if (
      binding &&
      binding !== previous &&
      (previous !== undefined || known[command] === undefined)
    ) {
      clock++;
      revisions.push({
        id: `${record.device}:${clock}`,
        device: record.device,
        command,
        binding,
        observedAt: now,
        clock,
      });
    }
  }
  return {
    device: record.device,
    clock,
    baseline: { ...actual },
    revisions: revisions.slice(-1000),
  };
}
export function validateRecord(value: unknown): value is DeviceRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<DeviceRecord>;
  return (
    typeof record.device === "string" &&
    /^[a-zA-Z0-9-]{1,80}$/.test(record.device) &&
    typeof record.clock === "number" &&
    Number.isSafeInteger(record.clock) &&
    record.clock >= 0 &&
    !!record.baseline &&
    typeof record.baseline === "object" &&
    !Array.isArray(record.baseline) &&
    Object.entries(record.baseline).every(
      ([key, binding]) =>
        key.length <= 100 &&
        typeof binding === "string" &&
        binding.length <= 100,
    ) &&
    Array.isArray(record.revisions) &&
    record.revisions.length <= 1000 &&
    record.revisions.every((item: unknown) =>
      validRevision(item, record.device ?? "", record.clock ?? 0),
    )
  );
}

function validRevision(
  value: unknown,
  device: string,
  clock: number,
): value is Revision {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Revision>;
  return (
    typeof item.id === "string" &&
    item.id.length <= 200 &&
    item.device === device &&
    typeof item.command === "string" &&
    item.command.length <= 100 &&
    typeof item.binding === "string" &&
    item.binding.length <= 100 &&
    typeof item.clock === "number" &&
    Number.isSafeInteger(item.clock) &&
    item.clock >= 0 &&
    item.clock <= clock &&
    typeof item.observedAt === "number" &&
    Number.isFinite(item.observedAt) &&
    item.observedAt >= 0 &&
    item.observedAt <= 8640000000000000
  );
}
