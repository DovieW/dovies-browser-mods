# UI runtime comparison

Development-only fixtures for Browser Mods. They are never imported by `src/`, copied into `dist/` or packaged with the product. A separate package/lockfile pins the candidate runtimes and Radix dialog. Release bundle checks reject experiment sources and instrumentation.

From the repository root:

```sh
npm ci
npm ci --prefix experiments/ui-runtime
npx playwright install chromium
npm run compare --prefix experiments/ui-runtime
```

The nested package uses the root's existing TypeScript, esbuild and Playwright tools. `npm run compare` checks fixture types, builds all seven packaged extensions, then runs browser behavior and measurement checks. It never opens an existing browser profile or reads actual user settings. Output goes to ignored `experiments/ui-runtime/dist/` and `experiments/ui-runtime/test-results/`.

Optional measurement controls (after a build):

```sh
MODS_UI_ROUNDS=1 npm run measure --prefix experiments/ui-runtime
MODS_UI_VARIANTS=react-radix,preact-radix,redact-radix npm run measure --prefix experiments/ui-runtime
MODS_UI_OUTPUT=/tmp/browser-mods-ui.json npm run measure --prefix experiments/ui-runtime
```

## Equal workload

- Native DOM and one shared component implementation under React, Preact compat and Redact. All builds are minified, production-mode, target Chrome 127 and use identical data/styles/viewport. No React Compiler, virtualization or framework-specific tuning.
- Actual current 23-command catalog, plus a clearly synthetic 1,000-row stress case made from repeated catalog entries. The stress case is not a claim that the product needs 1,000 commands.
- Checkbox and dependent numeric settings, invalid input, save/dirty state, missing-shortcut text, search/empty state, Ctrl/Command K, and a help dialog with keyboard wrapping, Escape and restored trigger focus.
- Standard fixtures use HTML `dialog` in every runtime. Three additional fixtures use a real Radix dialog to check portals, refs, context, focus trapping and cleanup under each compatible runtime. Radix fixtures are compatibility checks, not a statistically repeated timing comparison against the native dialog.
- Native DOM creates and caches row nodes, then replaces the visible list; component builds use keyed rows. Both are reasonable implementations of the same behavior, not identical algorithms. The native fixture is a new reference implementation, not the existing production popup.

## Measurement and limits

Three rounds rotate standard-runtime order. Each runtime/size/round starts a fresh temporary Chromium profile with only that packaged fixture. First navigation and seven later navigations use new documents in that process; values are browser navigation-start to committed UI plus two animation frames. Browser process launch and worker registration are excluded. The first navigation is profile/process cold, not a cleared operating-system disk cache. First-profile initialization and machine load can dominate it.

Twenty-four trusted Playwright input changes per case record browser input-event dispatch to committed DOM. A second value includes two animation frames, which is a rendering opportunity rather than measured paint latency or INP. No synchronous React flush or CPU throttling is used. Raw navigation and interaction samples are retained. Keep foreground/system load similar and do not run competing benchmarks concurrently.

In round one, five mount/unmount cycles prime caches, followed by a mounted forced-GC snapshot, an unmounted baseline and 20 cycles exercising mounts and dialogs. Each cycle sends Escape as soon as the dialog is visible. If it remains visible after two frames, the report counts a rapid-Escape miss, then retries after 150 ms so the rest of the comparison can finish. A retry does not turn that result into a pass. CDP reports used JS heap, document/node and listener counts. Lifecycle assertions check app-effect cleanup and bounded DOM/listener growth. Heap deltas describe this short run; they do not prove leak freedom, quantify allocation rate or represent long-session total browser memory. Forced GC and instrumentation affect behavior.

`completed: true` means the comparison finished. Inspect the per-case behavior and `lifecycle.rapidEscape` results before accepting a candidate. CI retains artifacts and enforces behavior/teardown assertions; timing numbers and captured rapid-interaction misses are informational findings, not an automatic framework-selection gate.

The fixture uses in-memory fake settings without persistence, Chrome command execution, sync, remote data, navigation routes, content scripts, worker workloads or permission changes. It evaluates UI costs and the tested interactions only. It is not a complete accessibility audit or proof that arbitrary third-party controls work.

Redact uses explicit aliases to its published React/DOM/JSX entrypoints and package-default features; no Vite plugin, feature pruning or nano preset is applied. Build assertions ensure native React is absent from Preact/Redact outputs and each output contains only its intended component runtime. This checks direct-esbuild viability for this fixture, not full parity with Redact's Vite integrations.

See the results and adoption decision in [the TanStack review](../../docs/tanstack-review.md).
