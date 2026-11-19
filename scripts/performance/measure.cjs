// Disposable-profile benchmark. No live browser or user data is accessed.
const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");
const quantile = (values, p) =>
  [...values].sort((a, b) => a - b)[
    Math.min(values.length - 1, Math.ceil(values.length * p) - 1)
  ];
(async () => {
  const source = path.resolve(process.env.MODS_BENCH_EXTENSION || "dist");
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "mods-benchmark-"));
  const samples = [];
  const started = performance.now();
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${source}`,
      `--load-extension=${source}`,
    ],
  });
  try {
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker", { timeout: 10000 }));
    const id = new URL(worker.url()).host;
    const browserStart = performance.now() - started;
    for (let i = 0; i < 15; i++) {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const start = performance.now();
      await page.goto(`chrome-extension://${id}/popup.html`);
      await page.locator(".shortcut-item").first().waitFor({ timeout: 10000 });
      samples.push(performance.now() - start);
      assert.deepEqual(errors, []);
      await page.close();
    }
    const { createHarness } = require(
      path.resolve(process.env.MODS_BENCH_HARNESS || "tests/chrome-mock.cjs"),
    );
    const tabTimings = {};
    for (const count of [500, 1000]) {
      const times = [];
      for (let i = 0; i < 25; i++) {
        const h = createHarness({
          tabs: Array.from({ length: count }, (_, i) => ({
            id: i + 1,
            active: i === 0,
            highlighted: true,
            url: `https://fixture.test/${i}`,
          })),
        });
        await h.drain();
        const start = performance.now();
        await h.run("copy-url");
        times.push(performance.now() - start);
      }
      tabTimings[count] = {
        samples: times.length,
        p50: quantile(times, 0.5),
        p95: quantile(times, 0.95),
      };
    }
    const report = {
      measuredAt: new Date().toISOString(),
      node: process.version,
      browser: context.browser().version(),
      platform: process.platform,
      cpu: os.cpus()[0]?.model,
      extension: source,
      samples: samples.length,
      browserLaunchAndWorkerMs: browserStart,
      popupMs: {
        first: samples[0],
        warmP50: quantile(samples.slice(1), 0.5),
        warmP95: quantile(samples.slice(1), 0.95),
      },
      mockCopyLinksMs: tabTimings,
    };
    console.log(JSON.stringify(report, null, 2));
    if (process.env.MODS_BENCH_OUTPUT)
      await fs.writeFile(
        process.env.MODS_BENCH_OUTPUT,
        JSON.stringify(report, null, 2) + "\n",
      );
  } finally {
    await context.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
