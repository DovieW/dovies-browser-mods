import { build, version as esbuildVersion } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { gzipSync } from "node:zlib";
import assert from "node:assert/strict";
import { commands } from "../../src/core/actions/catalog.ts";
const root = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const resolve = (specifier) => require.resolve(specifier);
const output = path.join(root, "dist");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const variants = [
  "native",
  "react",
  "preact",
  "redact",
  "react-radix",
  "preact-radix",
  "redact-radix",
];
const bundles = {};
for (const variant of variants) {
  const runtime = variant.split("-")[0];
  const alias = {
    "fixture-dialog": path.join(
      root,
      variant.endsWith("radix") ? "radix-dialog.tsx" : "dialog.tsx",
    ),
  };
  if (runtime === "preact")
    Object.assign(alias, {
      react: resolve("preact/compat"),
      "react-dom": resolve("preact/compat"),
      "react-dom/client": resolve("preact/compat/client"),
      "react/jsx-runtime": resolve("preact/jsx-runtime"),
      "react/jsx-dev-runtime": resolve("preact/jsx-dev-runtime"),
    });
  if (runtime === "redact")
    Object.assign(alias, {
      react: resolve("@tanstack/redact"),
      "react-dom": resolve("@tanstack/redact/dom"),
      "react-dom/client": resolve("@tanstack/redact/dom-client"),
      "react/jsx-runtime": resolve("@tanstack/redact/jsx-runtime"),
      "react/jsx-dev-runtime": resolve("@tanstack/redact/jsx-dev-runtime"),
      scheduler: resolve("@tanstack/redact/scheduler"),
    });
  const destination = path.join(output, variant);
  await mkdir(destination);
  const result = await build({
    absWorkingDir: root,
    entryPoints: [runtime === "native" ? "native.ts" : "component.tsx"],
    outfile: path.join(destination, "app.js"),
    bundle: true,
    minify: true,
    target: "chrome127",
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    alias,
    metafile: true,
  });
  const inputs = Object.keys(result.metafile.inputs);
  const retainedReact = inputs.filter((file) =>
    /node_modules\/(react|react-dom)\//.test(file),
  );
  assert.equal(
    retainedReact.length > 0,
    runtime === "react",
    `${variant}: unexpected React inclusion`,
  );
  assert.equal(
    inputs.some((file) => file.includes("node_modules/preact/")),
    runtime === "preact",
  );
  assert.equal(
    inputs.some((file) => file.includes("node_modules/@tanstack/redact/")),
    runtime === "redact",
  );
  await cp(
    path.resolve(root, "../../node_modules/@doview/mods-shared/design/styles"),
    path.join(destination, "theme"),
    { recursive: true },
  );
  await cp(path.join(root, "style.css"), path.join(destination, "style.css"));
  await writeFile(
    path.join(destination, "index.html"),
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Browser Mods UI evaluation</title><link rel="stylesheet" href="style.css"><body><div id="app"></div><script src="app.js"></script></body></html>',
  );
  await writeFile(
    path.join(destination, "manifest.json"),
    JSON.stringify({
      manifest_version: 3,
      name: `Browser Mods evaluation: ${variant}`,
      version: "0.0.1",
      action: { default_popup: "index.html" },
      background: { service_worker: "worker.js" },
    }),
  );
  await writeFile(
    path.join(destination, "worker.js"),
    "chrome.runtime.onInstalled.addListener(() => {});",
  );
  const script = await readFile(path.join(destination, "app.js"));
  bundles[variant] = {
    minifiedBytes: script.length,
    gzipBytes: gzipSync(script).length,
    inputs,
  };
}
const versions = {};
for (const name of [
  "react",
  "react-dom",
  "preact",
  "@tanstack/redact",
  "@radix-ui/react-dialog",
]) {
  const json = JSON.parse(
    await readFile(
      path.join(root, "node_modules", name, "package.json"),
      "utf8",
    ),
  );
  versions[name] = { version: json.version, license: json.license };
}
await writeFile(
  path.join(output, "bundles.json"),
  JSON.stringify(
    {
      catalogSize: Object.keys(commands).length,
      esbuildVersion,
      versions,
      bundles,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify(
    Object.fromEntries(
      Object.entries(bundles).map(([name, stats]) => [
        name,
        { minifiedBytes: stats.minifiedBytes, gzipBytes: stats.gzipBytes },
      ]),
    ),
    null,
    2,
  ),
);
