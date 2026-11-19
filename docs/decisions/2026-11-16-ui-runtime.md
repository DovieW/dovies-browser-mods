# UI runtime comparison

Status: Redact selected; production workspace shell adopted 2026-11-17. See [UI interaction](../ui-interaction.md).

## Problem and scope

Browser Mods needs maintainable options and command-palette UI without paying an unjustified startup or runtime cost. React's ecosystem is useful, but popularity alone does not establish that its renderer is the right fit. Compare native DOM, React, Preact compat and Redact using equal visible behavior before changing the product.

This remains one extension. The separate builds in `experiments/ui-runtime/` are disposable development fixtures, not independently shipped features or a new product architecture. They use fictional in-memory settings and the public command catalog, never the user's actual data.

## Recommendation

Use **Redact for the redesigned extension-page UI**, following the user's selection. Correct behavior is required. Prioritize measured responsiveness, startup, memory and idle cost; among choices with comparable performance, prefer lower compatibility and maintenance risk. This choice does not change those priorities or establish that Redact is universally faster.

Redact's tested interactions, native dialog and Radix Dialog integration passed, including the rapid Escape probe. Direct esbuild aliases worked without adding Vite or a server, and build metadata confirmed native React was absent from its output. Carry that verified integration into the first real UI slice. React remains a measured reference and a possible fallback for an identified unsupported dependency, not the selected renderer.

Keep the current native DOM production UI until a redesigned slice has an agreed design and passes its own behavior/performance checks. Native DOM remains a strong performance baseline. This experiment does not establish a speedup from replacing it. Use native controls where they meet the workflow; component adoption should reduce UI maintenance work.

Preact's smaller output does not justify preferring it here. Its 1,000-row warm-readiness P95 crossed the project's review threshold against the native reference, so large unvirtualized views are not cleared. Investigate with more samples and a real collection workload; evaluate Virtual if viewport rendering addresses that feature's measured problem.

**Do not adopt the tested Preact/Radix Dialog combination yet.** The rapid open/Escape probe dropped key presses; delayed retries succeeded. That is consistent with passive-effect/listener readiness, not proof of the exact cause. Do not hide it with an arbitrary production delay or patch framework internals. Recheck a fixed upstream version or select another tested control implementation when the actual design needs it.

Redact's newer implementation and documented compatibility differences remain engineering constraints. Pin the package, test every adopted control/adapter combination, and benchmark the actual screens. React-facing imports and types do not mean shipping both runtimes: production build checks must prove the selected renderer is the only one included. Do not disable Redact features merely to win a size comparison. [Redact's compatibility limits](https://tanstack.com/redact/latest/docs/compatibility), [Radix's accessible primitives](https://www.radix-ui.com/primitives/docs/overview/introduction).

The result does not require TanStack Start, Vite, global state management, routing or replacing domain/storage architecture. Hotkeys and Form remain separate evaluations tied to actual UI workflows. Virtual and Pacer retain their feature-specific triggers.

## Integration boundaries

- Component code belongs in feature UI and shared UI helpers. Entrypoints stay thin; domain code and persisted shortcut reconciliation remain independent of the renderer.
- No framework code enters the service worker, offscreen clipboard or content/page scripts merely because extension-page UI uses it.
- No new permissions, content-script registrations, remote services or worker activity were introduced. A production UI library would load only when its extension page is opened; effects/listeners must dispose on unmount or closure.
- The experiment's package and lockfile are isolated development dependencies. The root production build imports none of them; bundle checks reject experiment sources and instrumentation. The experiment remains isolated; the later workspace shell adopts Redact through its own root dependency.
- Retain the comparison until the UI choice is implemented and covered by product benchmarks; then update or retire it instead of maintaining a second product UI indefinitely.

## Evidence and acceptance limits

See [the measurement report](../performance/ui-runtime-2026-11-16.md), its raw samples and [reproduction instructions](../../experiments/ui-runtime/README.md). Fixture package versions/licenses and actual bundled inputs are recorded with the data. Exact adapter/control combinations require checks at adoption; this is not blanket React-library compatibility.

The tests cover settings validation/saving, search and empty results, a keyboard shortcut, dialog focus/Tab wrapping/Escape/restoration, repeated unmounts, and bounded short-run DOM/listener counts. A 1,000-row synthetic list supplements the current catalog. They do not cover Chrome sync, media observers, worker suspension, long-session memory, every accessibility requirement or other browsers.

Reverting the experiment requires no settings migration: no production source, persisted data or installed extension was changed. Any future product adoption should be a separate reviewable change with existing behavior preserved and a rollback to the current renderer.
