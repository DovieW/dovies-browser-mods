const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { moduleCode } = require("./module-harness.cjs");
function setup() {
  const context = vm.createContext({ TextEncoder });
  vm.runInContext(moduleCode("src/core/shortcuts/application.ts"), context);
  const local = {},
    sync = {};
  const calls = [];
  let fail = false;
  const port = {
    readLocal: async () => structuredClone(local),
    readSync: async () => structuredClone(sync),
    writeLocal: async (patch) => {
      calls.push("local");
      Object.assign(local, structuredClone(patch));
    },
    publish: async (patch) => {
      calls.push("sync");
      if (fail) throw Error("quota");
      Object.assign(sync, structuredClone(patch));
    },
    assignments: async () => ({ copy: "Ctrl+C" }),
    platform: async () => "linux",
    newDevice: () => "device-1",
  };
  return {
    service: context.createShortcutService(port),
    local,
    sync,
    calls,
    fail(value) {
      fail = value;
    },
  };
}
test("unchanged shortcut observations do not rewrite local or sync data", async () => {
  const h = setup();
  await h.service.reconcileShortcuts();
  const writes = h.calls.length;
  const result = await h.service.reconcileShortcuts();
  assert.equal(result.desired.copy, "Ctrl+C");
  assert.equal(h.calls.length, writes);
});
test("failed sync retains local intent and a later request retries without blocking the queue", async () => {
  const h = setup();
  h.fail(true);
  await assert.rejects(h.service.reconcileShortcuts(), /quota/);
  assert.ok(h.local["mods.shortcuts.local"].revisions.length);
  h.fail(false);
  const result = await h.service.reconcileShortcuts();
  assert.equal(result.desired.copy, "Ctrl+C");
  assert.ok(Object.keys(h.sync).length);
});
test("concurrent UI requests serialize and do not duplicate history", async () => {
  const h = setup();
  await Promise.all(
    Array.from({ length: 10 }, () => h.service.reconcileShortcuts()),
  );
  assert.equal(h.local["mods.shortcuts.local"].revisions.length, 1);
  assert.equal(h.calls.filter((v) => v === "sync").length, 1);
});
test("malformed synced revisions do not break valid local setup", async () => {
  const h = setup();
  h.sync["mods.shortcuts.device.bad"] = {
    device: "bad",
    clock: 1,
    baseline: {},
    revisions: [null],
  };
  const result = await h.service.reconcileShortcuts();
  assert.equal(result.desired.copy, "Ctrl+C");
});

test("invalid device identity is replaced before writing revision shards", async () => {
  const h = setup();
  h.local["mods.device"] = "invalid.device";
  const result = await h.service.reconcileShortcuts();
  assert.equal(h.local["mods.device"], "device-1");
  assert.equal(result.records[0].device, "device-1");
});
test("explicit adoption overrides a newer peer preference and remains in history", async () => {
  const h = setup();
  await h.service.reconcileShortcuts();
  h.sync["mods.shortcuts.device.peer.copy"] = {
    device: "peer",
    clock: 50,
    baseline: {},
    revisions: [
      {
        id: "peer:50",
        device: "peer",
        clock: 50,
        command: "copy",
        binding: "Alt+C",
        observedAt: Date.now(),
      },
    ],
  };
  await h.service.adoptAssignment("copy");
  const result = await h.service.reconcileShortcuts();
  assert.equal(result.desired.copy, "Ctrl+C");
  assert.ok(h.local["mods.shortcuts.local"].clock > 50);
  await assert.rejects(h.service.adoptAssignment("unknown"), /Unknown/);
});
