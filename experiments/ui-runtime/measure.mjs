import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
const root = path.dirname(fileURLToPath(import.meta.url));
const artifacts = JSON.parse(
  await readFile(path.join(root, "dist/bundles.json"), "utf8"),
);
const quantile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
};
const summary = (values) => ({
  samples: values.length,
  p50: quantile(values, 0.5),
  p95: quantile(values, 0.95),
});
const runs = [];
const requested = process.env.MODS_UI_VARIANTS?.split(",");
const rounds = Number(process.env.MODS_UI_ROUNDS || 3);
assert.ok(Number.isInteger(rounds) && rounds >= 1 && rounds <= 10);
const variants = ["native", "react", "preact", "redact"];
if (requested)
  for (const variant of requested)
    assert.ok(variant in artifacts.bundles, `Unknown variant: ${variant}`);
let browserVersion;
let reference;
let completed = false;

async function ready(page) {
  await page.locator('#screen[data-ready="true"]').waitFor();
}
async function parity(page, size) {
  const search = page.locator("#search");
  assert.equal(await page.locator("#commands li").count(), size);
  const signature = await page.locator("#commands li").allTextContents();
  if (size === artifacts.catalogSize) {
    if (reference) assert.deepEqual(signature, reference);
    else reference = signature;
  }
  await page.locator("#pause").fill("0");
  await page.waitForFunction(
    () =>
      document.querySelector("#save").disabled &&
      document.querySelector("#validation").textContent.includes("100"),
  );
  await page.locator("#pause").fill("700");
  await page.locator("#enabled").uncheck();
  await page.locator("#save").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#saved").textContent ===
        "Saved: disabled, 700 ms" && document.querySelector("#save").disabled,
  );
  await page.locator("#pause").focus();
  await page.keyboard.press("Control+k");
  assert.equal(
    await search.evaluate((element) => document.activeElement === element),
    true,
  );
  await search.fill("screenshot");
  await page.waitForFunction(
    () => document.querySelector("#screen").dataset.query === "screenshot",
  );
  const filtered = await page.locator("#commands li").allTextContents();
  assert.ok(
    filtered.length > 0 &&
      filtered.every((text) => text.toLowerCase().includes("screenshot")),
  );
  await search.fill("no matches exist here");
  await page.waitForFunction(
    () => document.querySelector("#count").textContent === "0 commands",
  );
  await search.fill("");
  await page.waitForFunction(
    (count) => document.querySelectorAll("#commands li").length === count,
    size,
  );
  await page.locator("#dialog-trigger").click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[role="dialog"], dialog[open]')
        ?.contains(document.activeElement),
    undefined,
    { timeout: 1000 },
  );
  const inDialog = () =>
    page.evaluate(() =>
      document
        .querySelector('[role="dialog"], dialog[open]')
        .contains(document.activeElement),
    );
  assert.equal(await inDialog(), true, "dialog takes focus");
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    assert.equal(await inDialog(), true, "Tab stays in dialog");
  }
  await page.keyboard.press("Shift+Tab");
  assert.equal(await inDialog(), true, "reverse Tab stays in dialog");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => document.activeElement?.id === "dialog-trigger",
  );
  await page.locator("#dialog-trigger").click();
  await dialog.waitFor();
  await page.locator("#dialog-close").click();
  await dialog.waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => document.activeElement?.id === "dialog-trigger",
  );
  return {
    rows: size,
    settingsSave: true,
    validation: true,
    search: true,
    shortcut: true,
    dialogFocusTrap: true,
    escapeAndRestore: true,
  };
}
async function collect(session) {
  await session.send("HeapProfiler.collectGarbage");
  const heap = await session.send("Runtime.getHeapUsage");
  const dom = await session.send("Memory.getDOMCounters");
  return { usedHeapBytes: heap.usedSize, ...dom };
}
async function unmount(page) {
  await page.evaluate(() => globalThis.ModsUiFixture.unmount());
  await page.waitForFunction(
    () => document.getElementById("app").childElementCount === 0,
  );
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}
async function memory(page) {
  const session = await page.context().newCDPSession(page);
  let rapidEscapeMisses = 0;
  try {
    // Prime one-time runtime/browser caches before measuring repeated lifecycle cost.
    for (let i = 0; i < 5; i++) {
      await unmount(page);
      await page.evaluate(() => globalThis.ModsUiFixture.mount());
      await ready(page);
    }
    const mounted = await collect(session);
    await unmount(page);
    const before = await collect(session);
    const modalStyles = () =>
      page.evaluate(() => ({
        pointerEvents: document.body.style.pointerEvents,
        overflow: document.body.style.overflow,
        scrollLock: document.body.getAttribute("data-scroll-locked"),
        appHidden: document.getElementById("app").getAttribute("aria-hidden"),
      }));
    const beforeStyles = await modalStyles();
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => globalThis.ModsUiFixture.mount());
      await ready(page);
      // Exercise the actual dialog lifecycle as well as component mount/unmount.
      await page.locator("#dialog-trigger").click();
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      if (await page.getByRole("dialog").isVisible()) {
        // Keep the first-key failure in the report. A delayed retry diagnoses
        // listener readiness and lets other candidates/lifecycle checks finish;
        // it does not turn the rapid-interaction result into a pass.
        rapidEscapeMisses++;
        await page.waitForTimeout(150);
        await page.keyboard.press("Escape");
      }
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await unmount(page);
    }
    const after = await collect(session);
    assert.deepEqual(
      await modalStyles(),
      beforeStyles,
      "modal styles and aria-hidden are restored",
    );
    const lifecycle = await page.evaluate(() => ({
      mounts: globalThis.ModsUiFixture.mountCount,
      cleanups: globalThis.ModsUiFixture.cleanupCount,
    }));
    assert.equal(
      lifecycle.mounts,
      lifecycle.cleanups,
      "effects dispose on every unmount",
    );
    // Browser/runtime bookkeeping may retain a small fixed number of objects.
    assert.ok(
      after.nodes <= before.nodes + 10,
      `DOM growth: ${JSON.stringify({ before, after })}`,
    );
    assert.ok(
      after.jsEventListeners <= before.jsEventListeners + 5,
      `listener growth: ${JSON.stringify({ before, after })}`,
    );
    assert.equal(
      await page.locator('[role="dialog"], .overlay, #screen').count(),
      0,
    );
    return {
      cycles: 20,
      primingCycles: 5,
      mounted,
      before,
      after,
      retainedDeltaBytes: after.usedHeapBytes - before.usedHeapBytes,
      lifecycle,
      rapidEscape: { attempts: 20, missed: rapidEscapeMisses },
    };
  } finally {
    await session.detach();
  }
}
async function run(variant, size, round, compatibilityOnly = false) {
  const directory = path.join(root, "dist", variant);
  const profile = await mkdtemp(path.join(os.tmpdir(), "mods-ui-"));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: "chromium",
      headless: true,
      viewport: { width: 440, height: 900 },
      args: [
        `--disable-extensions-except=${directory}`,
        `--load-extension=${directory}`,
      ],
    });
    browserVersion ??= context.browser().version();
    assert.equal(context.browser().version(), browserVersion);
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker", { timeout: 10000 }));
    const url = `chrome-extension://${new URL(worker.url()).host}/index.html?size=${size}`;
    const errors = [];
    context.on("page", (page) =>
      page.on("pageerror", (error) => errors.push(error.message)),
    );
    const navigation = [];
    let page;
    for (let i = 0; i < (compatibilityOnly ? 1 : 8); i++) {
      page = await context.newPage();
      await page.goto(url);
      await ready(page);
      navigation.push(
        await page.evaluate(() => globalThis.ModsUiFixture.readyMs),
      );
      if (i < (compatibilityOnly ? 0 : 7)) await page.close();
    }
    const behavior = await parity(page, size);
    if (round === 0 && size === artifacts.catalogSize) {
      await mkdir(path.join(root, "test-results"), { recursive: true });
      await page.screenshot({
        path: path.join(root, "test-results", `${variant}.png`),
        fullPage: true,
      });
    }
    await page.evaluate(() => {
      globalThis.ModsUiFixture.samples.length = 0;
    });
    for (const query of Array.from(
      { length: 24 },
      (_, i) => ["tab", "screenshot", "copy", "", "group", "zzzz"][i % 6],
    )) {
      await page.locator("#search").fill(query);
      await page.waitForFunction(
        (q) =>
          globalThis.ModsUiFixture.samples.at(-1)?.query === q &&
          globalThis.ModsUiFixture.samples.at(-1)?.twoFramesMs !== undefined,
        query,
      );
    }
    const interactions = await page.evaluate(
      () => globalThis.ModsUiFixture.samples,
    );
    assert.equal(interactions.length, 24);
    await page.locator("#search").fill("");
    await page.waitForFunction(
      (count) => document.querySelectorAll("#commands li").length === count,
      size,
    );
    const lifecycle = round === 0 ? await memory(page) : undefined;
    if (lifecycle?.rapidEscape.missed)
      console.warn(
        `${variant}: ${lifecycle.rapidEscape.missed}/20 rapid Escape presses missed; this integration is not approved for adoption`,
      );
    assert.deepEqual(errors, [], `${variant}: browser errors`);
    const record = {
      variant,
      size,
      round: round + 1,
      compatibilityOnly,
      readyMs: { first: navigation[0], warm: summary(navigation.slice(1)) },
      inputCommitMs: summary(interactions.map((sample) => sample.commitMs)),
      inputTwoFramesMs: summary(
        interactions.map((sample) => sample.twoFramesMs),
      ),
      behavior,
      lifecycle,
      raw: { navigation, interactions },
    };
    runs.push(record);
    console.log(
      JSON.stringify({
        variant,
        size,
        round: round + 1,
        readyMs: record.readyMs,
        inputCommitMs: record.inputCommitMs,
        lifecycle: lifecycle && {
          delta: lifecycle.retainedDeltaBytes,
          before: lifecycle.before.jsEventListeners,
          after: lifecycle.after.jsEventListeners,
          rapidEscape: lifecycle.rapidEscape,
        },
      }),
    );
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
}
try {
  for (let round = 0; round < rounds; round++) {
    const rotated = [
      ...variants.slice(round % variants.length),
      ...variants.slice(0, round % variants.length),
    ];
    for (const size of [artifacts.catalogSize, 1000])
      for (const variant of rotated)
        if (!requested || requested.includes(variant))
          await run(variant, size, round);
  }
  for (const variant of ["react-radix", "preact-radix", "redact-radix"])
    if (!requested || requested.includes(variant))
      await run(variant, artifacts.catalogSize, 0, true);
  completed = true;
} finally {
  const output = path.resolve(
    process.env.MODS_UI_OUTPUT || path.join(root, "test-results/results.json"),
  );
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(
    output,
    JSON.stringify(
      {
        completed,
        measuredAt: new Date().toISOString(),
        node: process.version,
        browser: browserVersion,
        platform: process.platform,
        cpu: os.cpus()[0]?.model,
        rounds,
        viewport: { width: 440, height: 900 },
        artifacts,
        runs,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Results: ${output}`);
}
