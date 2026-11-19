import { checkBundles } from "./checks/bundles.mjs";
import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { commands } from "../src/core/actions/catalog.ts";
await rm("dist", { recursive: true, force: true });
await mkdir("dist");
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
manifest.commands = commands;
for (const file of [
  "popup.css",
  "offscreen.html",
  "PRIVACY.md",
  "logo16.png",
  "logo48.png",
  "logo128.png",
  "LICENSE",
])
  await cp(file, `dist/${file}`);
await cp("src/features/workspace/ui/workspace.css", "dist/workspace.css");
await cp("node_modules/@doview/mods-shared/design/styles", "dist/theme", {
  recursive: true,
});
for (const name of ["popup", "options", "launcher", "legacy", "history"]) {
  let html = await readFile(`src/entrypoints/${name}/index.html`, "utf8");
  if (name === "legacy")
    html = html.replace('src="popup.js"', 'src="legacy.js"');
  if (name === "history")
    html = html.replace('src="options.js"', 'src="history.js"');
  await writeFile(`dist/${name}.html`, html);
}
await writeFile("dist/manifest.json", JSON.stringify(manifest, null, 2));
const result = await build({
  entryPoints: {
    background: "src/entrypoints/worker/main.ts",
    popup: "src/entrypoints/popup/main.ts",
    options: "src/entrypoints/options/main.ts",
    offscreen: "src/entrypoints/offscreen/main.ts",
    launcher: "src/entrypoints/launcher/main.ts",
    legacy: "src/entrypoints/legacy/main.ts",
    history: "src/entrypoints/history/main.ts",
  },
  outdir: "dist",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: {
    react: "@tanstack/redact",
    "react-dom/client": "@tanstack/redact/dom-client",
    "react/jsx-runtime": "@tanstack/redact/jsx-runtime",
  },
  bundle: true,
  target: "chrome127",
  format: "iife",
  minify: true,
  metafile: true,
});
await writeFile("dist/build-meta.json", JSON.stringify(result.metafile));

const scripts = Object.fromEntries(
  await Promise.all(
    Object.keys(result.metafile.outputs)
      .filter((name) => name.endsWith(".js"))
      .map(async (name) => [name, await readFile(name, "utf8")]),
  ),
);
const errors = checkBundles(result.metafile, scripts);
if (errors.length) throw Error(errors.join("\n"));
