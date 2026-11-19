export type OptionsProps = {
  port: WorkspacePort;
  prefs: Preferences;
  save: <K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) => Promise<void>;
  fail: (e: unknown) => void;
  notice: string;
  setNotice: (s: string) => void;
  actions: Result[];
};
import { useEffect, useState } from "react";
import {
  parsePreferences,
  validatePreferences,
  type Preferences,
} from "../domain/preferences";
import type { WorkspacePort } from "../adapters/browser";
import { pages, planned, settings, type Result } from "./model";
import { sections } from "../domain/preferences";
export function Options({
  port,
  prefs,
  save,
  fail,
  notice,
  setNotice,
  actions: allActions,
}: OptionsProps) {
  const [page, setPage] = useState<string>(
    decodeURIComponent(location.hash.slice(1)).split("|")[0] || pages[0],
  );
  const [query, setQuery] = useState("");
  const [origins, setOrigins] = useState<string[]>([]);
  const enabled = allActions.filter((r) => !prefs.disabled.includes(r.group));
  const byOrder = (a: Result, b: Result) => {
    const rank = (id: string) => {
      const i = prefs.order.indexOf(id);
      return i < 0 ? 10000 : i;
    };
    return rank(a.id) - rank(b.id) || a.label.localeCompare(b.label);
  };
  const [focusControl, setFocusControl] = useState(
    decodeURIComponent(location.hash.slice(1)).split("|")[1] ?? "",
  );
  useEffect(() => {
    if (focusControl) {
      document.getElementById(focusControl)?.focus();
      setFocusControl("");
    }
  }, [page, focusControl]);
  function navigate(target: string, control = "") {
    setFocusControl(control);
    setPage(target);
    location.hash = encodeURIComponent(target + (control ? "|" + control : ""));
  }
  useEffect(() => {
    if (page === "Site access")
      void port
        .permissions()
        .then((p) => {
          setOrigins(p.origins ?? []);
        })
        .catch(fail);
  }, [page, port]);
  function toggle(key: "pins" | "hidden", id: string) {
    void save(
      key,
      prefs[key].includes(id)
        ? prefs[key].filter((x) => x !== id)
        : [...prefs[key], id],
    );
  }
  function reorder(
    key: "order" | "pins" | "sections",
    id: string,
    delta: number,
  ) {
    const ids =
      key === "order"
        ? [...enabled].sort(byOrder).map((a) => a.id)
        : [...prefs[key]];
    const index = ids.indexOf(id),
      next = index + delta;
    if (index < 0 || next < 0 || next >= ids.length) return;
    ids.splice(index, 1);
    ids.splice(next, 0, id);
    void save(key, ids);
  }
  const select = (
    label: string,
    key: "layout" | "placement" | "searchMode",
    choices: readonly (readonly [string, string])[],
  ) => (
    <label className="field">
      {label}
      <select
        aria-label={label}
        id={key}
        value={prefs[key]}
        onChange={(e) => {
          const p = parsePreferences({ [key]: e.target.value });
          void save(key, p[key]);
        }}
      >
        {choices.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      <div className="settings-layout">
        <nav aria-label="Options sections">
          {pages.map((p) => (
            <button
              key={p}
              aria-current={page === p ? "page" : undefined}
              onClick={() => {
                navigate(p);
              }}
            >
              {p}
            </button>
          ))}
        </nav>
        <main>
          <label className="field">
            Find a setting
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              placeholder="Search layouts, keys, permissions…"
            />
          </label>
          {query && (
            <div>
              {settings
                .filter((s) =>
                  `${s.label} ${s.page}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((s) => (
                  <button
                    key={s.control}
                    onClick={() => {
                      navigate(s.page, s.control);
                      setQuery("");
                    }}
                  >
                    {s.label}
                  </button>
                ))}
            </div>
          )}
          <h2
            id={
              page === "Shortcuts"
                ? "shortcut-settings"
                : page === "Mods"
                  ? "mod-settings"
                  : page === "Site access"
                    ? "site-settings"
                    : page === "Sync & backup"
                      ? "backup-settings"
                      : undefined
            }
            tabIndex={-1}
          >
            {page}
          </h2>
          {page === pages[0] && (
            <>
              {select("Toolbar popup layout", "layout", [
                ["favorites", "Favorites + current tab"],
                ["commands", "Searchable command list"],
                ["sections", "Feature sections"],
              ])}
              {select("Command palette location", "placement", [
                ["toolbar", "Toolbar popup"],
                ["centered", "Centered page launcher"],
              ])}
              {select("Palette search", "searchMode", [
                ["scoped", "Actions + scoped searches"],
                ["everything", "Everything"],
                ["commands", "Commands only"],
              ])}
              <label className="check">
                <input
                  type="checkbox"
                  id="includeDisabled"
                  checked={prefs.includeDisabled}
                  onChange={(e) => {
                    void save("includeDisabled", e.target.checked);
                  }}
                />
                Include disabled and planned mods in search
              </label>
              <h3 id="action-order" tabIndex={-1}>
                Actions
              </h3>
              <p className="muted">
                Pin favorites, hide controls, and arrange your command list.
              </p>
              {enabled.sort(byOrder).map((r) => (
                <div className="custom-row" key={r.id}>
                  <span>{r.label}</span>
                  <button
                    aria-pressed={prefs.pins.includes(r.id)}
                    onClick={() => {
                      toggle("pins", r.id);
                    }}
                  >
                    Pin
                  </button>
                  <button
                    aria-pressed={prefs.hidden.includes(r.id)}
                    onClick={() => {
                      toggle("hidden", r.id);
                    }}
                  >
                    Hide
                  </button>
                  <button
                    aria-label={`Move ${r.label} up`}
                    onClick={() => {
                      reorder("order", r.id, -1);
                    }}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Move ${r.label} down`}
                    onClick={() => {
                      reorder("order", r.id, 1);
                    }}
                  >
                    ↓
                  </button>
                </div>
              ))}
              <h3>Favorites order</h3>
              {prefs.pins.map((id) => (
                <div className="custom-row" key={id}>
                  <span>
                    {allActions.find((r) => r.id === id)?.label ?? id}
                  </span>
                  <button
                    aria-label={`Move favorite ${id} up`}
                    onClick={() => {
                      reorder("pins", id, -1);
                    }}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Move favorite ${id} down`}
                    onClick={() => {
                      reorder("pins", id, 1);
                    }}
                  >
                    ↓
                  </button>
                </div>
              ))}
              <h3>Section order</h3>
              {prefs.sections.map((s) => (
                <div className="custom-row" key={s}>
                  <span>{s}</span>
                  <button
                    aria-pressed={prefs.hidden.includes(`section:${s}`)}
                    onClick={() => {
                      toggle("hidden", `section:${s}`);
                    }}
                  >
                    Hide section
                  </button>
                  <button
                    onClick={() => {
                      reorder("sections", s, -1);
                    }}
                    aria-label={`Move ${s} up`}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => {
                      reorder("sections", s, 1);
                    }}
                    aria-label={`Move ${s} down`}
                  >
                    ↓
                  </button>
                </div>
              ))}
            </>
          )}
          {page === "Shortcuts" && (
            <>
              <p>
                Assigned keys are managed by Chrome. Desired keys and assignment
                history follow your setup across devices.
              </p>
              <button
                onClick={() => {
                  void port.editKeys().catch(fail);
                }}
              >
                Edit browser keys
              </button>
              <iframe
                className="settings-frame"
                title="Shortcut setup and history"
                src="history.html"
              />
            </>
          )}
          {page === "Mods" && (
            <>
              {sections.map((s) => (
                <div className="card" key={s}>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={!prefs.disabled.includes(s)}
                      onChange={(e) => {
                        void save(
                          "disabled",
                          e.target.checked
                            ? prefs.disabled.filter((x) => x !== s)
                            : [...prefs.disabled, s],
                        );
                      }}
                    />
                    {s}
                  </label>
                  <p className="muted">
                    {s === "Tabs"
                      ? "Tab, group and window commands. Recent-tab history remains available to the shared shortcut service."
                      : s === "Clipboard"
                        ? "Copy tab URLs and visible-page screenshots."
                        : "Pause media on demand and show YouTube playlist duration in the toolbar popup."}
                  </p>
                </div>
              ))}
              <button
                onClick={() => {
                  void port.open(port.url("legacy.html")).catch(fail);
                }}
              >
                Tab-switching behavior & existing tools
              </button>
              <h3>Coming from the roadmap</h3>
              {planned.map((p) => (
                <p key={p} className="muted">
                  {p} · not implemented yet
                </p>
              ))}
            </>
          )}
          {page === "Site access" && (
            <>
              <p>
                Access is requested when a tool needs it. Removing access can
                prevent that tool from running.
              </p>
              {origins.length ? (
                origins.map((o) => (
                  <div className="custom-row" key={o}>
                    <span>{o}</span>
                    <button
                      onClick={() => {
                        void port
                          .revoke([o])
                          .then(() => {
                            setOrigins(origins.filter((x) => x !== o));
                          })
                          .catch(fail);
                      }}
                    >
                      Revoke
                    </button>
                  </div>
                ))
              ) : (
                <p>No optional site access granted.</p>
              )}
            </>
          )}
          {page === "Sync & backup" && (
            <>
              <p>
                Interface preferences sync through Chrome. Changes to separate
                controls merge independently; concurrent edits to the same
                control use Chrome’s resolved value. Running jobs, grants, and
                browser shortcut assignments stay on this device.
              </p>
              <button
                onClick={() => {
                  const blob = new Blob(
                    [
                      JSON.stringify(
                        { version: 1, preferences: prefs },
                        null,
                        2,
                      ),
                    ],
                    { type: "application/json" },
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "browser-mods-settings-v1.json";
                  a.click();
                  setTimeout(() => {
                    URL.revokeObjectURL(url);
                  }, 1000);
                }}
              >
                Export interface settings
              </button>
              <label className="field">
                Import interface settings
                <input
                  type="file"
                  accept="application/json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 65536) {
                      fail(Error("Settings file is too large."));
                      return;
                    }
                    void file
                      .text()
                      .then(async (text) => {
                        const data: unknown = JSON.parse(text);
                        if (
                          !data ||
                          typeof data !== "object" ||
                          !("version" in data) ||
                          data.version !== 1 ||
                          !("preferences" in data) ||
                          !data.preferences ||
                          typeof data.preferences !== "object"
                        )
                          throw Error("Invalid settings backup.");
                        if (!validatePreferences(data.preferences))
                          throw Error("Invalid settings backup.");
                        await port.importPreferences(data.preferences);
                        setNotice("Imported settings.");
                      })
                      .catch(fail);
                  }}
                />
              </label>
              <button
                onClick={() => {
                  void port.open(port.url("legacy.html")).catch(fail);
                }}
              >
                Shortcut backup & recovery
              </button>
              <button
                onClick={() => {
                  void port
                    .restorePreferences()
                    .then(() => {
                      setNotice(
                        "Restored settings from before the last import.",
                      );
                    })
                    .catch(fail);
                }}
              >
                Undo last settings import
              </button>
            </>
          )}
          <p role="status" className="muted">
            {notice}
          </p>
        </main>
      </div>
    </>
  );
}
