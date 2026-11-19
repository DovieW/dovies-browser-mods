import ts from "typescript";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
export function checkSource(root) {
  const errors = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walk(file);
        continue;
      }
      if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
      const name = relative(root, file).replaceAll("\\", "/");
      if (!/\.tsx?$/.test(file))
        errors.push(`${name}: runtime source must be TypeScript`);
      const pure =
        name.startsWith("core/") ||
        name.startsWith("contracts/") ||
        name.includes("/domain/");
      const ast = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      function visit(node) {
        if (ts.isTypeNode(node)) return;
        if (ts.isPropertySignature(node)) return;
        if (
          (pure || name.includes("/ui/") || name.startsWith("ui/")) &&
          ts.isIdentifier(node) &&
          [
            "chrome",
            "browser",
            "window",
            "document",
            "fetch",
            "localStorage",
            "sessionStorage",
            "navigator",
            "globalThis",
            "setInterval",
            "setTimeout",
          ].includes(node.text)
        ) {
          if (!pure && !["chrome", "browser"].includes(node.text)) {
            ts.forEachChild(node, visit);
            return;
          }
          if (
            !(
              ts.isPropertyAccessExpression(node.parent) &&
              node.parent.name === node
            ) &&
            !(ts.isPropertyAssignment(node.parent) && node.parent.name === node)
          )
            errors.push(`${name}: forbidden domain/core API ${node.text}`);
        }
        if (ts.isIdentifier(node) && node.text === "setInterval")
          errors.push(`${name}: periodic polling is prohibited`);
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
  }
  walk(root);
  return errors;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const errors = checkSource(resolve("src"));
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else console.log("Source context rules passed");
}
