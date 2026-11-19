import { committed, initialize } from "./instrumentation";
import { trapDialogTab } from "./dialog-focus";
import {
  initialSettings,
  matches,
  rows,
  rowText,
  settingsText,
  validPause,
} from "./model";
const host = document.getElementById("app");
if (!host) throw Error("Missing host");
let dispose: (() => void) | undefined;
function mount() {
  if (!host) throw Error("Missing host");
  host.innerHTML = `<main id="screen"><header><h1>Browser Mods</h1><p>Commands and settings · evaluation fixture</p></header>
    <form><label><input id="enabled" type="checkbox" checked> Enable tab shortcuts</label>
    <label for="pause">Recent-tab pause (ms)</label><input id="pause" type="number" min="100" max="5000" value="1200">
    <p id="validation" role="status"></p><button id="save" disabled>Save settings</button><output id="saved"></output></form>
    <button id="dialog-trigger">Shortcut setup help</button><dialog aria-labelledby="help-title"><h2 id="help-title">Shortcut setup</h2>
    <p>Chrome manages browser-wide shortcut assignments. Desired settings can differ on this device.</p>
    <a href="#commands">Review desired shortcuts</a><button id="dialog-close">Close</button></dialog>
    <label for="search">Search commands</label><input id="search" type="search" placeholder="Search · Ctrl/⌘ K">
    <p id="count" role="status"></p><ul id="commands"></ul></main>`;
  const element = <T extends Element>(selector: string) => {
    const found = host.querySelector<T>(selector);
    if (!found) throw Error(selector);
    return found;
  };
  const controller = new AbortController();
  const listen = (target: EventTarget, name: string, handler: EventListener) =>
    target.addEventListener(name, handler, { signal: controller.signal });
  const search = element<HTMLInputElement>("#search");
  const pause = element<HTMLInputElement>("#pause");
  const enabled = element<HTMLInputElement>("#enabled");
  const save = element<HTMLButtonElement>("#save");
  const list = element<HTMLUListElement>("#commands");
  const count = element("#count");
  const dialog = element<HTMLDialogElement>("dialog");
  let saved = { ...initialSettings };
  const settings = () => ({
    enabled: enabled.checked,
    pause: pause.valueAsNumber,
  });
  const updateSettings = () => {
    const draft = settings();
    element("#validation").textContent = validPause(draft.pause)
      ? ""
      : "Enter a whole number from 100 to 5000";
    save.disabled =
      !validPause(draft.pause) ||
      (draft.pause === saved.pause && draft.enabled === saved.enabled);
    element("#saved").textContent = settingsText(saved);
  };
  const nodes = new Map(
    rows.map((row) => {
      const li = document.createElement("li");
      li.dataset.id = row.id;
      li.textContent = rowText(row);
      return [row.id, li];
    }),
  );
  const render = () => {
    const filtered = rows.filter((row) => matches(row, search.value));
    list.replaceChildren(
      ...filtered.map((row) => {
        const node = nodes.get(row.id);
        if (!node) throw Error(row.id);
        return node;
      }),
    );
    count.textContent = `${filtered.length} commands`;
    committed(search.value);
  };
  listen(search, "input", render);
  listen(pause, "input", updateSettings);
  listen(enabled, "change", updateSettings);
  listen(element("form"), "submit", (event) => {
    event.preventDefault();
    if (validPause(pause.valueAsNumber)) {
      saved = settings();
      updateSettings();
    }
  });
  listen(element("#dialog-trigger"), "click", () => dialog.showModal());
  listen(element("#dialog-close"), "click", () => dialog.close());
  listen(dialog, "keydown", (event) => {
    if (event instanceof KeyboardEvent) trapDialogTab(event, dialog);
  });
  listen(element("dialog a"), "click", (event) => event.preventDefault());
  listen(document, "keydown", (event) => {
    if (
      event instanceof KeyboardEvent &&
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "k"
    ) {
      event.preventDefault();
      search.focus();
    }
  });
  globalThis.ModsUiFixture.mountCount++;
  dispose = () => {
    controller.abort();
    host.replaceChildren();
    globalThis.ModsUiFixture.cleanupCount++;
  };
  updateSettings();
  render();
}
initialize(mount, () => {
  dispose?.();
  dispose = undefined;
});
mount();
