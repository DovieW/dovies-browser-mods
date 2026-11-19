import {
  PlaylistDurationCard,
  playlistTab,
} from "../../playlist-duration/public-ui";
import { commandErrorMessage } from "../../../core/actions/errors";
import type { OptionsProps } from "./options";
import type { ComponentType } from "react";
import { pages, planned, settings, type Result } from "./model";
import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { commands } from "../../../core/actions/catalog";
import {
  actionSection,
  preferenceDefaults,
  type Preferences,
} from "../domain/preferences";
import { workspaceBrowser, type WorkspacePort } from "../adapters/browser";

const message = (e: unknown) =>
  e instanceof Error ? e.message : "Could not complete this action.";
function App({
  port,
  mode,
  initialPalette = false,
  Settings,
}: {
  port: WorkspacePort;
  mode: "popup" | "options" | "launcher";
  initialPalette?: boolean;
  Settings: ComponentType<OptionsProps> | undefined;
}) {
  const [prefs, setPrefs] = useState<Preferences>({ ...preferenceDefaults });
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [query, setQuery] = useState(""),
    [scope, setScope] = useState(""),
    [selected, setSelected] = useState(0);
  const [keys, setKeys] = useState<Record<string, string>>({}),
    [tabs, setTabs] = useState<Awaited<ReturnType<WorkspacePort["tabs"]>>>([]);
  const [bookmarks, setBookmarks] = useState<
    Awaited<ReturnType<WorkspacePort["bookmarks"]>>
  >([]);
  const [busy, setBusy] = useState(false);
  const [shortcutDifferences, setShortcutDifferences] = useState(0);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void port
        .readShortcutSetup()
        .then((s) => {
          if (alive)
            setShortcutDifferences(
              Object.keys(s.desired).filter((k) => s.desired[k] !== s.actual[k])
                .length,
            );
        })
        .catch(fail);
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      alive = false;
      window.removeEventListener("focus", refresh);
    };
  }, [port]);
  const [current, setCurrent] = useState<
    Awaited<ReturnType<WorkspacePort["currentTab"]>>
  >({
    title: "Current tab",
    pinned: false,
    id: undefined,
    url: "",
  });
  useEffect(() => {
    if (mode !== "options") void port.currentTab().then(setCurrent).catch(fail);
  }, [mode, port]);
  const playlist =
    mode === "popup" && !prefs.disabled.includes("Media")
      ? playlistTab(current.url)
      : null;
  const [palette, setPalette] = useState(mode === "launcher" || initialPalette);
  const input = useRef<HTMLInputElement>(null),
    connection = useRef<MessagePort | null>(null);
  const close = () => {
    if (mode === "launcher") connection.current?.postMessage("close");
    else window.close();
  };
  const fail = (e: unknown) => {
    setError(message(e));
  };
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void port
        .readPreferences()
        .then((p) => {
          if (alive) {
            setPrefs(p);
            setReady(true);
          }
        })
        .catch(fail);
    };
    refresh();
    const unwatch = port.watchPreferences(refresh);
    void port
      .commands()
      .then((c) => {
        setKeys(
          Object.fromEntries(c.map((x) => [x.name ?? "", x.shortcut ?? ""])),
        );
      })
      .catch(fail);
    void port
      .error()
      .then((e) => {
        if (e) setError(`${e.command}: ${commandErrorMessage(e.code)}`);
      })
      .catch(fail);
    const focus = () => {
      void port
        .commands()
        .then((c) => {
          setKeys(
            Object.fromEntries(c.map((x) => [x.name ?? "", x.shortcut ?? ""])),
          );
        })
        .catch(fail);
    };
    window.addEventListener("focus", focus);
    return () => {
      alive = false;
      unwatch();
      window.removeEventListener("focus", focus);
    };
  }, [port]);
  useEffect(() => {
    const listener = (e: MessageEvent<unknown>) => {
      if (
        e.source === window.parent &&
        e.data === "mods.launcher.connect" &&
        e.ports[0]
      ) {
        connection.current = e.ports[0];
        input.current?.focus();
      }
    };
    if (mode === "launcher") {
      window.addEventListener("message", listener);
      window.parent.postMessage("mods.launcher.ready", "*");
    }
    return () => {
      window.removeEventListener("message", listener);
      connection.current?.close();
    };
  }, [mode]);
  useEffect(() => {
    if (ready && (palette || prefs.layout === "commands"))
      input.current?.focus();
  }, [ready, palette, prefs.layout]);
  useEffect(() => {
    let alive = true;
    if (prefs.searchMode === "everything" || scope === "tabs")
      void port
        .tabs()
        .then((t) => {
          if (alive) setTabs(t);
        })
        .catch(fail);
    return () => {
      alive = false;
    };
  }, [port, prefs.searchMode, scope]);
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      if ((prefs.searchMode === "everything" && query) || scope === "bookmarks")
        void port
          .bookmarks(query)
          .then((b) => {
            if (alive) setBookmarks(b);
          })
          .catch(fail);
    }, 120);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [port, prefs.searchMode, query, scope]);
  useEffect(() => {
    setSelected(0);
  }, [query, scope, prefs.layout]);
  useEffect(() => {
    document
      .getElementById(`result-${selected}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  async function save<K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) {
    setError("");
    setNotice("Saving…");
    try {
      await port.savePreference(key, value);
      setPrefs((p) => ({ ...p, [key]: value }));
      setNotice("Saved locally. Chrome manages sync delivery.");
    } catch (e) {
      fail(e);
      setNotice("Not saved. Try again.");
    }
  }
  async function openOptions(target: string) {
    await port.open(port.url(`options.html#${encodeURIComponent(target)}`));
    close();
  }
  const allActions: Result[] = Object.entries(commands)
    .filter(([id]) => id !== "open-palette")
    .map(([id, c]) => ({
      id,
      label: c.description,
      group: actionSection(id),
      key: keys[id] ?? "",
      stay: ["pin-tab", "toggle-collapse-groups"].includes(id),
      run: () => port.run(id),
    }));
  const enabled = allActions.filter((r) => !prefs.disabled.includes(r.group));
  const byOrder = (a: Result, b: Result) => {
    const rank = (id: string) => {
      const i = prefs.order.indexOf(id);
      return i < 0 ? 10000 : i;
    };
    return rank(a.id) - rank(b.id) || a.label.localeCompare(b.label);
  };
  let results: Result[] = enabled
    .filter((r) => !prefs.hidden.includes(r.id))
    .sort(byOrder);
  const finding = !!query || palette || prefs.layout === "commands" || !!scope;
  if (finding) {
    if (scope === "tabs") results = [];
    if (scope === "bookmarks") results = [];
    if (!scope && prefs.searchMode !== "commands")
      results.push(
        ...settings.map((s) => ({
          id: `setting-${s.control}`,
          label: s.label,
          group: "Settings",
          run: () => openOptions(s.page + "|" + s.control),
        })),
        {
          id: "find-tabs",
          label: "Find tab",
          group: "Search",
          stay: true,
          run: () => {
            setScope("tabs");
            setQuery("");
            return Promise.resolve();
          },
        },
        {
          id: "find-bookmarks",
          label: "Find bookmark",
          group: "Search",
          stay: true,
          run: async () => {
            if (await port.requestBookmarks()) {
              setScope("bookmarks");
              setQuery("");
            } else throw Error("Bookmark access declined.");
          },
        },
      );
    if (
      scope === "tabs" ||
      (!scope && prefs.searchMode === "everything" && query)
    )
      results.push(
        ...tabs.map((t) => ({
          id: `tab-${t.id}`,
          label: t.title,
          group: "Tabs search",
          run: () => port.focus(t.id),
        })),
      );
    if (
      scope === "bookmarks" ||
      (!scope && prefs.searchMode === "everything" && query)
    )
      results.push(
        ...bookmarks.map((b) => ({
          id: `bookmark-${b.id}`,
          label: b.title,
          group: "Bookmarks",
          run: () => port.open(b.url),
        })),
      );
    if (prefs.includeDisabled || scope === "explore")
      results.push(
        ...planned.map((p) => ({
          id: `planned-${p}`,
          label: p,
          group: "Planned · not yet available",
          stay: true,
          run: () => openOptions("Mods"),
        })),
        ...allActions
          .filter((r) => prefs.disabled.includes(r.group))
          .map((r) => ({
            ...r,
            label: `Enable ${r.group} to use: ${r.label}`,
            group: "Disabled",
            stay: true,
            run: () => openOptions("Mods"),
          })),
      );
    if (!scope)
      results.push({
        id: "explore",
        label: "Explore mods",
        group: "Browser Mods",
        stay: true,
        run: () => {
          setScope("explore");
          setQuery("");
          return Promise.resolve();
        },
      });
  } else if (prefs.layout === "favorites")
    results = results
      .filter((r) => prefs.pins.includes(r.id))
      .sort((a, b) => prefs.pins.indexOf(a.id) - prefs.pins.indexOf(b.id));
  const aliases: Record<string, string> = {
    "copy-screenshot": "screenshot capture image clipboard",
    "copy-url": "link address clipboard",
    "pause-all-tabs": "audio video sound media",
  };
  const terms = query.toLocaleLowerCase().trim().split(/\s+/);
  results = results.filter((r) =>
    terms.every((t) =>
      `${r.label} ${r.id} ${r.group} ${aliases[r.id] ?? ""}`
        .toLocaleLowerCase()
        .includes(t),
    ),
  );
  results = results.slice(0, 100);
  async function activate(r: Result) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await r.run();
      if (r.stay) setCurrent(await port.currentTab());
      if (!r.stay) close();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={mode === "options" ? "workspace options" : "workspace"}>
      <header>
        <div>
          <span className="eyebrow">DOVIE’S</span>
          <h1>Browser Mods</h1>
        </div>
        {mode !== "options" ? (
          <button
            onClick={() => {
              void openOptions(pages[0]);
            }}
          >
            Options
          </button>
        ) : (
          <span className="muted">Make your browser yours.</span>
        )}
      </header>
      {mode !== "options" && shortcutDifferences > 0 && (
        <p className="shortcut-warning">
          {shortcutDifferences} shortcuts differ from your saved setup.{" "}
          <button
            onClick={() => {
              void openOptions("Shortcuts");
            }}
          >
            Review shortcuts
          </button>
        </p>
      )}
      {error && (
        <div role="alert" className="error">
          {error}
          <button
            onClick={() => {
              setError("");
            }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
      {!ready ? (
        <p role="status">Loading your setup…</p>
      ) : mode === "options" && Settings ? (
        <Settings
          port={port}
          prefs={prefs}
          save={save}
          fail={fail}
          notice={notice}
          setNotice={setNotice}
          actions={allActions}
        />
      ) : (
        <>
          <div className="search">
            <input
              ref={input}
              id="search"
              type="search"
              role="combobox"
              aria-label={scope ? `Search ${scope}` : "Search Browser Mods"}
              aria-expanded="true"
              aria-controls="results"
              aria-activedescendant={
                results[selected] ? `result-${selected}` : undefined
              }
              placeholder={scope ? `Search ${scope}…` : "Search commands…"}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelected((i) =>
                    results.length
                      ? (i +
                          (e.key === "ArrowDown" ? 1 : -1) +
                          results.length) %
                        results.length
                      : 0,
                  );
                }
                if (e.key === "Enter" && results[selected]) {
                  e.preventDefault();
                  void activate(results[selected]);
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  if (scope) {
                    setScope("");
                    setQuery("");
                  } else if (query) setQuery("");
                  else close();
                }
              }}
            />
            {scope && (
              <button
                onClick={() => {
                  setScope("");
                  setQuery("");
                  input.current?.focus();
                }}
              >
                Back
              </button>
            )}
          </div>
          {playlist && current.id !== undefined && !query && !scope && (
            <PlaylistDurationCard
              key={`${current.id}:${playlist.page}:${playlist.list}`}
              target={playlist}
              tabId={current.id}
              openPlaylist={port.open}
            />
          )}
          {!finding && prefs.layout === "favorites" && <h2>Favorites</h2>}
          <div id="results" role="listbox" aria-label="Available actions">
            {(prefs.layout === "sections" && !finding
              ? prefs.sections.filter(
                  (s) => !prefs.hidden.includes(`section:${s}`),
                )
              : [""]
            ).map((group) => (
              <section key={group}>
                {group && <h2>{group}</h2>}
                {results
                  .filter((r) => !group || r.group === group)
                  .map((r) => {
                    const index = results.indexOf(r);
                    return (
                      <button
                        id={`result-${index}`}
                        role="option"
                        aria-selected={selected === index}
                        disabled={busy}
                        className={`shortcut-item result ${selected === index ? "selected" : ""}`}
                        key={r.id}
                        onClick={() => {
                          void activate(r);
                        }}
                      >
                        <span>
                          {r.label}
                          <small>{r.group}</small>
                        </span>
                        {r.key && <kbd>{r.key}</kbd>}
                      </button>
                    );
                  })}
              </section>
            ))}
            {!results.length && (
              <p className="muted">
                No matching actions. Try another search or explore mods.
              </p>
            )}
          </div>
          {!finding && prefs.layout === "favorites" && (
            <section className="context">
              <h2>Current tab</h2>
              <p className="muted">{current.title}</p>
              <button
                onClick={() => {
                  void activate({
                    id: "pin-tab",
                    stay: true,
                    label: "Pin tab",
                    group: "Tabs",
                    run: () => port.run("pin-tab"),
                  });
                }}
                disabled={prefs.disabled.includes("Tabs")}
                aria-pressed={current.pinned}
              >
                Toggle pinned
              </button>
              <button
                onClick={() => {
                  void activate({
                    id: "copy-url",
                    label: "Copy URL",
                    group: "Clipboard",
                    run: () => port.run("copy-url"),
                  });
                }}
                disabled={prefs.disabled.includes("Clipboard")}
              >
                Copy URL
              </button>
            </section>
          )}
          <footer>
            <button
              onClick={() => {
                setPalette(true);
                setScope("explore");
                input.current?.focus();
              }}
            >
              Explore mods
            </button>
            <span>↑ ↓ navigate · Enter run · Esc close</span>
          </footer>
        </>
      )}
    </div>
  );
}
export function mountWorkspace(
  mode: "popup" | "options" | "launcher",
  palette = false,
  Settings?: ComponentType<OptionsProps>,
) {
  const port = workspaceBrowser();
  const container = document.getElementById("app");
  if (!container) throw Error("Missing app container");
  if (mode === "launcher") document.body.classList.add("launcher");
  const root = createRoot(container);
  root.render(
    <App
      port={port}
      mode={mode}
      initialPalette={palette}
      Settings={Settings}
    />,
  );
  window.addEventListener(
    "pagehide",
    () => {
      root.unmount();
    },
    { once: true },
  );
}
