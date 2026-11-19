const { test } = require("node:test");
const assert = require("node:assert/strict");
test("bundle checks reject worker/UI mixing and test bridges", async () => {
  const { checkBundles } = await import("../scripts/checks/bundles.mjs");
  const bad = {
    outputs: {
      "dist/background.js": {
        inputs: { "src/features/media/ui/view.ts": {}, "tests/runtime.ts": {} },
      },
    },
  };
  assert.equal(
    checkBundles(bad, { "dist/background.js": "ModsTest.runtime" }).length,
    3,
  );
  const valid = {
    outputs: {
      "dist/background.js": { inputs: { "src/composition/worker.ts": {} } },
      "dist/popup.js": { inputs: { "src/ui/dom.ts": {} } },
    },
  };
  assert.deepEqual(checkBundles(valid, {}), []);
});
test("experiment sources and instrumentation cannot enter a release bundle", async () => {
  const { checkBundles } = await import("../scripts/checks/bundles.mjs");
  const bad = {
    outputs: {
      "dist/popup.js": {
        inputs: { "experiments/ui-runtime/component.tsx": {} },
      },
    },
  };
  assert.equal(
    checkBundles(bad, { "dist/popup.js": "globalThis.ModsUiFixture" }).length,
    2,
  );
});
