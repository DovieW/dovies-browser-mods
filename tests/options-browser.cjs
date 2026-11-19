const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "mods-options-"));
  const extension = path.resolve("dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  try {
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker"));
    const id = new URL(worker.url()).host;
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`chrome-extension://${id}/history.html`);
    await page
      .locator("#shortcuts tr")
      .first()
      .waitFor({ timeout: 8000 })
      .catch(async (e) => {
        console.error(await page.locator("#status").innerText(), errors);
        throw e;
      });
    assert.equal(await page.locator("#shortcuts tr").count(), 24);
    assert.match(await page.locator("#status").innerText(), /matches|differ/);
    const device = await worker.evaluate(
      async () =>
        (await chrome.storage.local.get("mods.device"))["mods.device"],
    );
    assert.ok(device);
    assert.deepEqual(errors, []);
    console.log(
      "PASS options reconciliation, worker messaging and action rows",
    );
  } finally {
    await context.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
