const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { moduleCode } = require("./module-harness.cjs");
function load() {
  const c = vm.createContext({});
  vm.runInContext(
    moduleCode("src/features/workspace/domain/preferences.ts"),
    c,
  );
  return c;
}
test("UI preferences reject invalid enums and bound untrusted arrays", () => {
  const c = load();
  assert.equal(
    c.parsePreferences({ layout: "oops", pins: Array(201).fill("x") }).layout,
    "favorites",
  );
  assert.equal(
    c.parsePreferences({ placement: "centered" }).placement,
    "centered",
  );
  assert.equal(c.validatePreferences({ layout: "favorites" }), false);
  assert.equal(c.validatePreferences(c.parsePreferences(null)), true);
  assert.equal(
    c.validatePreferences({
      ...c.parsePreferences(null),
      includeDisabled: "yes",
    }),
    false,
  );
});
test("TSX cannot bypass browser API context checks", async () => {
  const { checkSource } = await import("../scripts/checks/architecture.mjs");
  const fs = require("node:fs"),
    os = require("node:os"),
    path = require("node:path");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mods-tsx-"));
  try {
    fs.mkdirSync(path.join(root, "ui"));
    fs.writeFileSync(
      path.join(root, "ui", "bad.tsx"),
      "export const Bad=()=> <button onClick={()=>chrome.tabs.query({})}>Bad</button>",
    );
    assert.match(checkSource(root).join("\n"), /forbidden/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test("React and renderer in worker bundles fail packaging", async () => {
  const { checkBundles } = await import("../scripts/checks/bundles.mjs");
  assert.match(
    checkBundles(
      {
        outputs: {
          "dist/background.js": {
            inputs: { "node_modules/@tanstack/redact/index.js": {} },
          },
        },
      },
      {},
    ).join("\n"),
    /renderer/,
  );
  assert.match(
    checkBundles(
      {
        outputs: {
          "dist/popup.js": { inputs: { "node_modules/react/index.js": {} } },
        },
      },
      {},
    ).join("\n"),
    /native React/,
  );
});
test("disabled commands cannot be invoked through a different UI surface", async () => {
  const { createHarness } = require("./chrome-mock.cjs");
  const h = createHarness({ sync: { "mods.ui.v1.disabled": ["Clipboard"] } });
  await h.drain();
  await assert.rejects(h.run("copy-url"));
});
