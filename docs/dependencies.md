# Runtime dependency decisions

Reviewed 2026-11-16. This is a recommendation and revisit checklist, not a record of installed packages. Browser Mods ships pinned Redact 0.3.1 for its workspace UI; native React is excluded by bundle checks. Build/check/test tools are development dependencies; the shared package contributes local theme assets.

The goal is reliable, maintainable functionality with good measured performance. Zero dependencies is not a goal in itself, and a few extra kilobytes are not sufficient reason to prefer a harder-to-maintain implementation.

## Selection preference

Prefer established, widely adopted, actively maintained packages when they fit the job comparably. Documentation, integrations, familiar APIs and long-term maintainability matter more than shaving a few speculative kilobytes. Use a less familiar alternative only for a concrete advantage. Popularity does not require adding a framework for a small task that native APIs already handle.

Performance remains the first priority: evaluate responsiveness, startup, memory and idle cost with correct behavior. Among choices with comparable performance, prefer fewer future compatibility and maintenance problems. Bundle size counts when it causes a material runtime cost; smaller output alone does not justify a replacement runtime or additional integration risk. See the [TanStack review](tanstack-review.md) for the full public library catalog, adoption triggers and extension-specific limits. A TanStack package's maturity must be assessed independently of the reputation of Query or Table.

The [initial comparison is complete](performance/ui-runtime-2026-11-16.md). **The user selected Redact for the redesigned extension-page UI.** Its tested native/Radix dialog interactions and direct-esbuild integration passed. The production popup/options/palette shell now uses Redact; retained maintenance views remain native. Pin and test exact components/adapters; do not assume blanket React compatibility or ship native React alongside Redact. The tested Preact/Radix pairing remains blocked. Other comparison candidates remain isolated in `experiments/ui-runtime/`; production imports no experiment code.

## Next implementation: runtime validation with Zod

**Recommend standard Zod as the next runtime dependency. Not installed yet.**

A validator checks data while the extension is running. TypeScript checks our source while developing; its types cannot verify a JSON import, a Chrome message or old/corrupt saved settings. For example, a saved pause value of `"fast"` needs a real runtime check, not a TypeScript annotation.

Zod and Valibot are separate alternatives for this same job. Each describes expected data using a schema, validates unknown values, and can derive a TypeScript type from the schema. Valibot is not Zod and is not a wrapper around it. Standard Zod emphasizes a convenient method-based API; Valibot uses modular functions that bundlers can discard when unused. Modern Zod also provides `zod/mini`, a functional, tree-shakable variant, so comparisons must not assume an older Zod build.

Prefer standard Zod initially for readable, discoverable schemas and its documented integrations. There is no measured project-specific runtime advantage supporting the earlier recommendation to choose Valibot primarily for bundle footprint. Do not claim Zod is faster either: compare the actual implementation.

Implementation scope:

- Start with one worker message contract and one settings/import schema before converting all validators.
- Preserve current behavior for unknown fields, missing fields, defaulting, numeric bounds and malformed values. Saved preferences and old backups must remain compatible.
- Infer data types from schemas where appropriate; keep validation at message/storage/import boundaries rather than repeatedly parsing trusted internal values.
- Preserve stable user-facing error codes; do not surface raw payloads or validation details containing sensitive data.
- Measure actual per-context bundles, validation latency and the existing popup/operation benchmarks. Keep meaningful behavior and failure tests.
- Use one schema library. Reconsider Valibot or Zod Mini only for a demonstrated footprint/performance need or a concrete integration advantage; do not install both speculatively.

Sources: [Zod introduction](https://zod.dev/), [Zod Mini and tradeoffs](https://zod.dev/packages/mini), [Valibot introduction](https://valibot.dev/guides/introduction/).

## Revisit with a concrete feature

| Candidate        | Plain-language purpose                                           | Revisit trigger                                                                           | Preferred direction                                                                                                                                                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI runtime       | Build stateful popup/options screens from reusable components    | Substantial UI redesign                                                                   | Redact is selected. Carry the tested esbuild aliases into the first designed slice; verify responsiveness, startup, memory, cleanup and exact third-party controls. Keep renderer code out of worker/content/offscreen bundles and prove native React is absent from the Redact build. |
| Radix Primitives | Accessible React dialogs, menus, popovers and related controls   | A React-compatible UI needs those interactions                                            | Prefer established primitives over custom focus/keyboard/accessibility infrastructure. Apply the shared theme; import only needed components. Verify actual controls under Preact/Redact; React compatibility is not blanket library support.                                          |
| Floating UI      | Position anchored menus/overlays and handle scrolling/collisions | Media controls or anchored menus need robust positioning                                  | Already an established positioning option, evolved from Popper. Keep it as the preferred candidate; compare native CSS first and clean up updates on close/navigation. Do not choose older Popper solely for name recognition.                                                         |
| TanStack Virtual | Render only the visible part of a long list                      | Realistic tab/bookmark/history collections show rendering or scrolling problems           | Keep this candidate. Select a verified adapter for the chosen runtime or framework-free core. `react-window` is an established React-only alternative for simpler list/grid views. Do not add React just to virtualize a list.                                                         |
| lit-html         | Declarative HTML templates with incremental DOM updates          | A template-only solution has a demonstrated advantage over a component runtime/native DOM | A focused alternative when the redesign needs templates rather than a component ecosystem.                                                                                                                                                                                             |

Recheck current support, licenses and measured cost at adoption. These candidates are not mandatory installations. Virtualization needs keyboard/focus/accessibility tests and does not speed up the search algorithm itself. Positioning does not solve media-player compatibility or speed arbitration.

Sources: [React components](https://react.dev/learn), [Radix introduction](https://www.radix-ui.com/primitives/docs/overview/introduction), [Floating UI and Popper](https://floating-ui.com/docs/migration), [Floating UI cleanup](https://floating-ui.com/docs/autoupdate), [TanStack Virtual](https://tanstack.com/virtual/latest/docs/introduction), [framework adapters/core](https://tanstack.com/virtual/latest/docs/installation), [react-window](https://github.com/bvaughn/react-window), [standalone lit-html](https://lit.dev/docs/libraries/standalone-templates/).

## How to keep this actionable

Before implementing runtime validation, overlays, large lists or a UI redesign, consult the corresponding entry above and record adoption or deferral in the feature decision/PR. Update the status here after a real comparison or installation. These recommendations do not install anything automatically and do not make future projects depend on the same libraries.

All adopted code ships locally in the extension. Keep dependencies out of unrelated contexts, pin the resolved version in the lockfile, and review transitive dependencies, maintenance, licenses and actual bundled cost. A small library that removes substantial risk can be preferable to a larger body of custom code.
