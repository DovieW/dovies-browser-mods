const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const repo = path.resolve(__dirname, "..");
function fixture(files, run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mods-boundary-"));
  try {
    for (const [name, source] of Object.entries(files)) {
      const target = path.join(root, "src", name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, source);
    }
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
function cruise(root) {
  fs.writeFileSync(path.join(root, "tsconfig.json"), "{}");
  const result = spawnSync(
    process.execPath,
    [
      path.join(
        repo,
        "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs",
      ),
      "src",
      "--config",
      path.join(repo, ".dependency-cruiser.cjs"),
    ],
    { cwd: root, encoding: "utf8" },
  );
  return result;
}
for (const [name, files] of Object.entries({
  "TSX sibling privacy is enforced": {
    "features/a/view.tsx": "import '../b/private';",
    "features/b/private.tsx": "export const secret=1;",
  },
  "core cannot import UI": {
    "core/bad.ts": "import '../ui/view';",
    "ui/view.ts": "export const view=1;",
  },
  "domain cannot import adapters": {
    "features/a/domain/bad.ts": "import '../adapters/side';",
    "features/a/adapters/side.ts": "export const side=1;",
  },
  "sibling private imports fail": {
    "features/a/main.ts": "import '../b/private';",
    "features/b/private.ts": "export const secret=1;",
  },
  "public files cannot bypass sibling privacy": {
    "features/a/public.ts": "export * from '../b/private';",
    "features/b/private.ts": "export const secret=1;",
  },
  "cycles fail": { "core/a.ts": "import './b';", "core/b.ts": "import './a';" },
}))
  test(name, () =>
    fixture(files, (root) => {
      const result = cruise(root);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stdout + result.stderr, /error /);
    }),
  );
test("public contracts are permitted", () =>
  fixture(
    {
      "features/a/main.ts": "import '../b/public'; import '../b/public-ui';",
      "features/b/public-ui.ts": "export const view=1;",
      "features/b/public.ts": "export const api=1;",
    },
    (root) => {
      const result = cruise(root);
      assert.equal(result.status, 0, result.stdout + result.stderr);
    },
  ));
test("direct Chrome, DOM, fetch and JS escape hatches fail source checks", async () => {
  const { checkSource } = await import("../scripts/checks/architecture.mjs");
  fixture(
    {
      "core/policy.ts":
        "export function policy(){return chrome.storage.local.get('x');}",
      "features/a/domain/dom.ts": "export const x=document.title;",
      "features/a/domain/network.ts": "export const y=fetch('/');",
      "features/a/ui/direct.ts": "export const ui=chrome.tabs.query({});",
      "features/a/adapters/polling.ts": "setInterval(()=>{},100);",
      "core/legacy.js": "export const z=1;",
    },
    (root) => {
      const errors = checkSource(path.join(root, "src"));
      assert.equal(errors.length, 6, errors.join("\n"));
    },
  );
});
