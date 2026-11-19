import { listen } from "../../../ui/dom";
import { element } from "../../../ui/dom";
import type { TabSettings } from "../../../contracts/browser";
import { tabSettingsClient } from "../adapters/settings";
import { onPageClose } from "../../../ui/dom";
import { TAB_SETTINGS_PREFIX, TAB_SETTINGS_DEFAULTS } from "../domain/settings";
const settingsPort = tabSettingsClient();
const { readTabSettings, saveTabSettings } = settingsPort;
onPageClose(settingsPort.dispose);

export function setupTabSettings() {
  const fields = element<HTMLFieldSetElement>("tabSettingsFields");
  const status = element("tabSettingsStatus");
  const seconds = element<HTMLInputElement>("pauseSeconds");
  const slider = element<HTMLInputElement>("pauseSlider");
  const reset = element<HTMLButtonElement>("resetTabSettings");
  let saving = false;

  function render(settings: TabSettings) {
    for (const name of Object.keys(TAB_SETTINGS_DEFAULTS).filter(
      (name) => name !== "pauseMs",
    )) {
      element<HTMLInputElement>(name).checked = Boolean(
        settings[name as keyof TabSettings],
      );
    }
    seconds.value = slider.value = String(settings.pauseMs / 1000);
    seconds.disabled = slider.disabled = !settings.resetAfterPause;
  }
  async function refresh() {
    render(await readTabSettings());
    fields.disabled = reset.disabled = saving;
  }
  async function save(patch: Partial<TabSettings>) {
    saving = true;
    fields.disabled = reset.disabled = true;
    status.textContent = "Saving…";
    try {
      await saveTabSettings(patch);
      status.textContent = "Saved. Syncs when Chrome Sync is enabled.";
    } catch {
      status.textContent = "Could not save. Try changing the setting again.";
    } finally {
      saving = false;
      try {
        await refresh();
      } catch {
        status.textContent =
          "Could not load settings. Reopen Settings to try again.";
      }
    }
  }

  listen(element("openSettings"), "click", async () => {
    fields.disabled = reset.disabled = true;
    element("shortcutView").hidden = true;
    element("tabSettings").hidden = false;
    element("closeSettings").focus();
    try {
      await refresh();
      status.textContent = "Changes apply on your next history shortcut.";
    } catch {
      status.textContent =
        "Could not load settings. Reopen Settings to try again.";
    }
  });
  listen(element("closeSettings"), "click", () => {
    element("tabSettings").hidden = true;
    element("shortcutView").hidden = false;
    element("openSettings").focus();
  });
  for (const name of Object.keys(TAB_SETTINGS_DEFAULTS).filter(
    (name) => name !== "pauseMs",
  )) {
    listen(element(name), "change", (event) =>
      save({ [name]: (event.target as HTMLInputElement).checked }),
    );
  }
  listen(seconds, "change", () => {
    if (!seconds.checkValidity() || !Number.isFinite(seconds.valueAsNumber)) {
      status.textContent =
        "Enter a pause from 0.25 to 10 seconds, in steps of 0.05.";
      seconds.reportValidity();
      return;
    }
    void save({ pauseMs: Math.round(seconds.valueAsNumber * 1000) });
  });
  listen(slider, "input", () => {
    seconds.value = slider.value;
  });
  // Save only after releasing the slider, avoiding Chrome Sync write limits.
  listen(slider, "change", () =>
    save({ pauseMs: Math.round(Number(slider.value) * 1000) }),
  );
  listen(reset, "click", () => save(TAB_SETTINGS_DEFAULTS));
  settingsPort.watch((changes, area) => {
    if (
      area !== "sync" ||
      saving ||
      !Object.keys(changes).some((key) => key.startsWith(TAB_SETTINGS_PREFIX))
    )
      return;
    refresh()
      .then(() => {
        status.textContent = "Settings updated.";
      })
      .catch(() => {
        fields.disabled = reset.disabled = true;
        status.textContent =
          "Could not refresh settings. Reopen Settings to try again.";
      });
  });
}
