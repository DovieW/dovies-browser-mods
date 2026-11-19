const { test } = require("node:test");
const assert = require("node:assert/strict");
async function load() {
  return import("../src/core/shortcuts/history.ts");
}
test("new device and missing keys cannot overwrite desired setup", async () => {
  const { observe, desired } = await load();
  const a = observe(
    { device: "a", clock: 0, baseline: {}, revisions: [] },
    { copy: "Ctrl+C" },
    [],
    1,
  );
  const b = observe(
    { device: "b", clock: 0, baseline: {}, revisions: [] },
    { copy: "Alt+C" },
    [a],
    2,
  );
  assert.equal(desired([a, b]).copy, "Ctrl+C");
  const cleared = observe(a, { copy: "" }, [a, b], 3);
  assert.equal(desired([cleared, b]).copy, "Ctrl+C");
});
test("real local edits win and stale reconnect does not generate edits", async () => {
  const { observe, desired } = await load();
  const a = observe(
    { device: "a", clock: 0, baseline: {}, revisions: [] },
    { copy: "Ctrl+C" },
    [],
    1,
  );
  const b = observe(
    { device: "b", clock: 0, baseline: {}, revisions: [] },
    { copy: "Ctrl+C" },
    [a],
    2,
  );
  const changed = observe(b, { copy: "Alt+C" }, [a, b], 3);
  const stale = observe(a, { copy: "Ctrl+C" }, [a, changed], 4);
  assert.equal(desired([stale, changed]).copy, "Alt+C");
  assert.equal(stale.revisions.length, 1);
});
test("equal logical clocks converge regardless of delivery order", async () => {
  const { observe, desired } = await load();
  const base = { clock: 0, baseline: {}, revisions: [] };
  const a = observe({ ...base, device: "a" }, { copy: "A" }, [], 1),
    b = observe({ ...base, device: "b" }, { copy: "B" }, [], 1);
  assert.deepEqual(desired([a, b]), desired([b, a]));
});
