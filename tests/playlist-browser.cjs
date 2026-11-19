const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const playlistUrl = "https://www.youtube.com/playlist?list=PL-fixture";
const watchUrl = "https://www.youtube.com/watch?v=one&list=PL-fixture";
function video(duration, id = "one", list = "PL-fixture") {
  return `<yt-lockup-view-model><a href="/watch?v=${id}&amp;list=${list}">
    <yt-thumbnail-badge-view-model>${duration}</yt-thumbnail-badge-view-model>
  </a></yt-lockup-view-model>`;
}

(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "mods-playlist-"));
  const extension = path.join(profile, "extension");
  await fs.cp(process.env.SHORTCUTS_TEST_EXTENSION || "dist", extension, {
    recursive: true,
  });
  const manifestFile = path.join(extension, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestFile, "utf8"));
  // The extension page is opened directly in this fixture. A real toolbar
  // invocation supplies activeTab access in the shipped manifest.
  manifest.host_permissions = ["https://www.youtube.com/*"];
  await fs.writeFile(manifestFile, JSON.stringify(manifest));
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
    await context.route("https://www.youtube.com/**", async (route) => {
      const url = route.request().url();
      if (url === watchUrl) {
        await route.fulfill({
          contentType: "text/html",
          body: `<ytd-playlist-panel-renderer>
          <span class="index-message">1 / 2</span>
          <ytd-playlist-panel-video-renderer><a href="${watchUrl}">Video</a>
          <ytd-thumbnail-overlay-time-status-renderer><span id="text">2:59</span></ytd-thumbnail-overlay-time-status-renderer>
          </ytd-playlist-panel-video-renderer></ytd-playlist-panel-renderer>`,
        });
      } else if (url === playlistUrl) {
        await route.fulfill({
          contentType: "text/html",
          body: `<title>Fixture playlist</title>
          <ytd-browse><yt-page-header-view-model><yt-content-metadata-view-model>Playlist • 3 videos • 42 views</yt-content-metadata-view-model></yt-page-header-view-model><main id="primary"><yt-item-section-renderer id="rows">
          ${video("2:59")}${video("1:03:04")}${video("44:00", "unrelated", "PL-other")}
          </yt-item-section-renderer><div style="height:1800px"></div>
          <yt-continuation-item-view-model id="next" style="display:block;height:50px"></yt-continuation-item-view-model>
          </main></ytd-browse><script>
            const next = document.querySelector('#next');
            const loading = new IntersectionObserver(([entry]) => {
              if (!entry.isIntersecting) return;
              loading.disconnect();
              document.querySelector('#rows').insertAdjacentHTML('beforeend', ${JSON.stringify(video("0:57", "two"))});
              // YouTube can retain the marker after its last batch.
            });
            loading.observe(next);
          </script>`,
        });
      } else if (url.includes("PL-missing")) {
        await route.fulfill({
          contentType: "text/html",
          body: `<ytd-browse><main id="primary">
          <ytd-playlist-video-renderer><a href="/watch?v=one&amp;list=PL-missing">Video</a><ytd-thumbnail-overlay-time-status-renderer>2:59</ytd-thumbnail-overlay-time-status-renderer></ytd-playlist-video-renderer>
          <ytd-playlist-video-renderer>Private video</ytd-playlist-video-renderer>
          </main></ytd-browse>`,
        });
      } else
        await route.fulfill({ contentType: "text/html", body: "No playlist" });
    });
    const page = await context.newPage();
    const popup = await context.newPage();
    async function show(url) {
      await page.goto(url);
      await page.bringToFront();
      await popup.goto(`chrome-extension://${id}/popup.html`);
    }
    await show(playlistUrl);
    const card = popup.getByRole("region", {
      name: "YouTube playlist duration",
    });
    await card.getByText("1h 6m 3s", { exact: true }).waitFor();
    assert.match(await card.innerText(), /Subtotal · 2 videos/);
    await card
      .getByRole("button", { name: "Load more and recalculate" })
      .click();
    await card.getByText("1h 7m 0s", { exact: true }).waitFor();
    assert.match(await card.innerText(), /Total · 3 videos/);
    assert.equal(await page.evaluate(() => scrollY), 0, "restore page scroll");
    assert.equal(
      await page.getByText("Playlist duration", { exact: true }).count(),
      0,
    );
    await show(watchUrl);
    await card.getByText("2m 59s", { exact: true }).waitFor();
    assert.match(await card.innerText(), /Subtotal · 1 video/);
    const playlistTab = context.waitForEvent("page");
    await card.getByRole("button", { name: "Open playlist page" }).click();
    const opened = await playlistTab;
    await opened.waitForURL(playlistUrl);
    await opened.close();
    await show("https://www.youtube.com/playlist?list=PL-missing");
    await card.getByText("2m 59s", { exact: true }).waitFor();
    assert.match(
      await card.innerText(),
      /1 loaded entry has no readable duration/,
    );
    assert.match(await card.innerText(), /Subtotal/);
    await show("https://www.youtube.com/watch?v=standalone");
    await popup.locator(".result").first().waitFor();
    assert.equal(await card.count(), 0);
    console.log(
      "PASS playlist totals, duplicate entries, lazy loading, scroll restoration, watch sidebar and missing durations",
    );
  } finally {
    await context.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
