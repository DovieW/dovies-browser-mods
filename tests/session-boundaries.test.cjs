const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { moduleCode } = require("./module-harness.cjs");
test("tab session adapter rejects malformed state and bounds history", async () => {
  const context = vm.createContext({});
  vm.runInContext(moduleCode("src/features/tabs/adapters/session.ts"), context);
  const raw = {
    tabHistory: [
      null,
      { tabId: "wrong" },
      ...Array.from({ length: 50 }, (_, i) => ({ tabId: i })),
    ],
    tabHistoryWalk: { ids: [1, "bad"], currentTabId: 1 },
    lastAction: { command: "move", ids: [1], windowId: 1, at: Infinity },
  };
  const state = await context.readSession({ get: async () => raw }, [
    "tabHistory",
    "tabHistoryWalk",
    "lastAction",
  ]);
  assert.equal(state.tabHistory.length, 32);
  assert.equal(state.tabHistoryWalk, undefined);
  assert.equal(state.lastAction, undefined);
});
