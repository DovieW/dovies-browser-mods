const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHarness } = require("./chrome-mock.cjs");
test("disposing tab runtime removes listeners and leaves persisted state intact", async () => {
  const h = createHarness({ tabs: [{ id: 1, active: true }, { id: 2 }] });
  await h.drain();
  assert.ok(h.chrome.tabs.onActivated.listeners.length);
  await h.evaluate("dispose()");
  for (const event of [
    h.chrome.tabs.onActivated,
    h.chrome.tabs.onRemoved,
    h.chrome.tabs.onReplaced,
    h.chrome.windows.onFocusChanged,
    h.chrome.commands.onCommand,
    h.chrome.runtime.onMessage,
  ])
    assert.equal(event.listeners.length, 0);
  const saved = structuredClone(h.session);
  await h.activate(2);
  assert.deepEqual(h.session, saved);
});
test("idle runtime performs no recurring tab queries, writes or script injection", async () => {
  const h = createHarness({ tabs: [{ id: 1, active: true }] });
  await h.drain();
  let activity = 0;
  for (const object of [
    h.chrome.tabs,
    h.chrome.storage.session,
    h.chrome.storage.sync,
  ])
    for (const name of ["query", "get", "set"])
      if (object[name]) {
        const original = object[name];
        object[name] = (...args) => {
          activity++;
          return original(...args);
        };
      }
  const calls = h.calls.length;
  await new Promise((resolve) => setTimeout(resolve, 75));
  assert.equal(activity, 0);
  assert.equal(h.calls.length, calls);
});
