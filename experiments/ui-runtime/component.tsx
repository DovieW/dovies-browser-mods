import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SettingsDialog } from "fixture-dialog";
import { committed, initialize } from "./instrumentation";
import {
  initialSettings,
  matches,
  rows,
  rowText,
  settingsText,
  validPause,
} from "./model";

export function App() {
  const [query, setQuery] = useState("");
  const [settings, setSettings] = useState(initialSettings);
  const [saved, setSaved] = useState(initialSettings);
  const [open, setOpen] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const filtered = useMemo(
    () => rows.filter((row) => matches(row, query)),
    [query],
  );
  useLayoutEffect(() => {
    committed(query);
  });
  useEffect(() => {
    globalThis.ModsUiFixture.mountCount++;
    const controller = new AbortController();
    document.addEventListener(
      "keydown",
      (event) => {
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "k"
        ) {
          event.preventDefault();
          search.current?.focus();
        }
      },
      { signal: controller.signal },
    );
    return () => {
      controller.abort();
      globalThis.ModsUiFixture.cleanupCount++;
    };
  }, []);
  return (
    <main id="screen">
      <header>
        <h1>Browser Mods</h1>
        <p>Commands and settings · evaluation fixture</p>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (validPause(settings.pause)) setSaved({ ...settings });
        }}
      >
        <label>
          <input
            id="enabled"
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) =>
              setSettings({ ...settings, enabled: event.currentTarget.checked })
            }
          />{" "}
          Enable tab shortcuts
        </label>
        <label htmlFor="pause">Recent-tab pause (ms)</label>
        <input
          id="pause"
          type="number"
          min="100"
          max="5000"
          value={settings.pause}
          onInput={(event) =>
            setSettings({
              ...settings,
              pause: event.currentTarget.valueAsNumber,
            })
          }
        />
        <p id="validation" role="status">
          {validPause(settings.pause)
            ? ""
            : "Enter a whole number from 100 to 5000"}
        </p>
        <button
          id="save"
          disabled={
            !validPause(settings.pause) ||
            (settings.pause === saved.pause &&
              settings.enabled === saved.enabled)
          }
        >
          Save settings
        </button>
        <output id="saved">{settingsText(saved)}</output>
      </form>
      <button id="dialog-trigger" onClick={() => setOpen(true)}>
        Shortcut setup help
      </button>
      <SettingsDialog open={open} onClose={() => setOpen(false)} />
      <label htmlFor="search">Search commands</label>
      <input
        ref={search}
        id="search"
        type="search"
        value={query}
        onInput={(event) => setQuery(event.currentTarget.value)}
        placeholder="Search · Ctrl/⌘ K"
      />
      <p id="count" role="status">
        {filtered.length} commands
      </p>
      <ul id="commands">
        {filtered.map((row) => (
          <li key={row.id} data-id={row.id}>
            {rowText(row)}
          </li>
        ))}
      </ul>
    </main>
  );
}
const host = document.getElementById("app");
if (!host) throw Error("Missing host");
let root: Root | undefined;
initialize(
  () => {
    root = createRoot(host);
    root.render(<App />);
  },
  () => {
    root?.unmount();
    root = undefined;
  },
);
globalThis.ModsUiFixture.mount();
