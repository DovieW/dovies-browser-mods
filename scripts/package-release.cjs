const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

(async () => {
  const root = path.resolve(__dirname, "..");
  const manifest = JSON.parse(
    await fs.readFile(path.join(root, "manifest.json"), "utf8"),
  );
  const pkg = JSON.parse(
    await fs.readFile(path.join(root, "package.json"), "utf8"),
  );
  if (
    manifest.version !== pkg.version ||
    !/^\d+\.\d+\.\d+$/.test(manifest.version)
  )
    throw Error("Release versions must match");
  const source = path.join(root, "dist");
  const files = await fs.readdir(source);
  const output = path.resolve(
    process.argv[2] ||
      path.join(os.tmpdir(), `dovies-browser-mods-release-${manifest.version}`),
  );
  await fs.mkdir(output, { recursive: true });
  const stage = await fs.mkdtemp(
    path.join(os.tmpdir(), "dovies-browser-mods-package-"),
  );
  try {
    for (const file of files)
      await fs.cp(path.join(source, file), path.join(stage, file), {
        recursive: true,
      });
    const name = `dovies-browser-mods-v${manifest.version}.zip`;
    execFileSync(
      "zip",
      [
        "-q",
        "-r",
        "-X",
        "-9",
        name,
        ...files.filter((file) => file !== "build-meta.json"),
      ],
      { cwd: stage },
    );
    await fs.copyFile(path.join(stage, name), path.join(output, name));
    console.log(path.join(output, name));
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
