const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "mods-workspace-"));
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
    const base = `chrome-extension://${id}/`;
    const errors = [];
    const popup = await context.newPage();
    popup.on("pageerror", (e) => errors.push(e.message));
    await popup.goto(base + "popup.html");
    await popup.locator(".result").first().waitFor();
    assert.equal(await popup.locator(".result").count(), 4);
    await popup.locator("#search").fill("screenshot");
    assert.equal(await popup.locator(".result").count(), 1);
    await popup.locator("#search").press("ArrowDown");
    assert.equal(await popup.locator("[aria-selected=true]").count(), 1);
    await popup.locator("#search").fill("");
    const options = await context.newPage();
    options.on("pageerror", (e) => errors.push(e.message));
    await options.goto(base + "options.html");
    await options.getByLabel("Toolbar popup layout").selectOption("sections");
    await popup
      .getByRole("heading", { name: "Clipboard", exact: true })
      .waitFor();
    await options.getByLabel("Toolbar popup layout").selectOption("commands");
    await popup.locator(".result").nth(22).waitFor();
    await options
      .getByLabel("Palette search", { exact: true })
      .selectOption("commands");
    await popup.locator("#search").fill("Find tab");
    assert.equal(await popup.locator(".result").count(), 0);
    await options
      .getByLabel("Palette search", { exact: true })
      .selectOption("scoped");
    await popup.getByRole("option", { name: /Find tab/ }).waitFor();
    await popup.getByRole("option", { name: /Find tab/ }).click();
    await popup.getByRole("combobox", { name: "Search tabs" }).waitFor();
    await popup.getByRole("combobox", { name: "Search tabs" }).press("Escape");
    await popup
      .getByRole("combobox", { name: "Search Browser Mods" })
      .waitFor();
    await options.getByRole("button", { name: "Mods", exact: true }).click();
    await options.getByLabel("Clipboard", { exact: true }).uncheck();
    await popup.locator("#search").fill("screenshot");
    assert.equal(await popup.locator(".result").count(), 0);
    await options
      .getByRole("button", { name: "Appearance & navigation", exact: true })
      .click();
    await options
      .getByLabel("Include disabled and planned mods in search")
      .check();
    await popup.getByRole("option", { name: /Enable Clipboard/ }).waitFor();
    await options.getByRole("button", { name: "Mods", exact: true }).click();
    await options.getByLabel("Clipboard", { exact: true }).check();
    await options
      .getByRole("button", { name: "Shortcuts", exact: true })
      .click();
    await options
      .frameLocator("iframe")
      .locator("#shortcuts tr")
      .first()
      .waitFor();
    assert.equal(
      await options.frameLocator("iframe").locator("#shortcuts tr").count(),
      24,
    );
    await options
      .getByRole("button", { name: "Sync & backup", exact: true })
      .click();
    await options.getByLabel("Import interface settings").setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":1,"preferences":{"layout":"bad"}}'),
    });
    await options
      .getByRole("alert")
      .filter({ hasText: "Invalid settings backup" })
      .waitFor();
    await options.getByRole("button", { name: "Dismiss error" }).click();
    await options
      .getByRole("button", { name: "Appearance & navigation", exact: true })
      .click();
    await options.getByLabel("Find a setting").fill("location");
    await options
      .getByRole("button", { name: "Command palette location", exact: true })
      .click();
    assert.equal(
      await options
        .locator("#placement")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    for (const layout of ["favorites", "commands", "sections"])
      for (const search of ["scoped", "commands", "everything"]) {
        await options.getByLabel("Toolbar popup layout").selectOption(layout);
        await options
          .getByLabel("Palette search", { exact: true })
          .selectOption(search);
        await popup.locator("#search").fill("copy-url");
        await popup.getByRole("option", { name: /Copy highlighted/ }).waitFor();
      }
    const launcher = await context.newPage();
    await launcher.goto(base + "launcher.html");
    await launcher.waitForTimeout(200);
    assert.equal(await launcher.locator("#app").innerText(), "");
    assert.deepEqual(errors, []);
    console.log(
      "PASS configurable layouts, live sync, search modes, keyboard scope, mod toggles, shortcut history, invalid import, unauthorized launcher",
    );
  } finally {
    await context.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
