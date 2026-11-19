# UI runtime experiment results

Measured 2026-11-16 in packaged, disposable Chrome extensions. This compares new equivalent fixtures, not a migration of the existing product. [Raw results and bundled inputs](ui-runtime-2026-11-16.json), [reproduction/method](../../experiments/ui-runtime/README.md), [decision](../decisions/2026-11-16-ui-runtime.md).

## Conditions

- Linux, Intel Core Ultra 9 285H, Node 26.13.1, Chromium 153.0.8010.12, esbuild 0.28.2 targeting Chrome 127.
- React/ReactDOM 19.3.1, Preact 11.2.0 with compat, Redact 0.3.1 and Radix Dialog 1.3.1. These packages report MIT licenses; resolved/transitive versions are pinned in the experiment lockfile. No production dependency was installed.
- One shared React-style component implementation under the three component runtimes; native DOM uses cached row nodes. Identical fixture data, shared theme tokens and 440 × 900 viewport. Standard variants all use native HTML dialogs with the same explicit keyboard wrapping.
- Three rounds with rotating runtime order, fresh profile per runtime/size/round. Each has one first navigation and seven subsequent navigations. Main tables pool 21 warm navigation samples and 72 input samples per runtime/size, using nearest-rank percentiles. Radix compatibility fixtures run once separately, not as a repeated performance comparison.
- Current 23-command catalog and a synthetic 1,000-row list. The latter represents potential future collection rendering, not an accepted requirement for 1,000 shortcuts. Production checks completed before final collection; no competing verification jobs were started during this run.

## Actual bundled JavaScript

Decimal kB; includes fixture UI, catalog, instrumentation and runtime. These are not bare-library sizes. CSS/theme files are identical and separate. Gzip is supplementary; an installed extension does not download its UI bundle on each open.

| Runtime       | Standard minified kB | Standard gzip kB | With Radix Dialog, minified kB | With Radix Dialog, gzip kB |
| ------------- | -------------------: | ---------------: | -----------------------------: | -------------------------: |
| Native DOM    |                  6.1 |              2.6 |                              — |                          — |
| Preact compat |                 32.3 |             12.8 |                           70.7 |                       25.7 |
| Redact        |                 69.5 |             27.2 |                          113.8 |                       42.0 |
| React         |                229.9 |             71.7 |                          270.6 |                       85.1 |

Build assertions confirmed React is absent from Preact/Redact outputs and each component output includes only its intended renderer. Direct esbuild aliases work for this tested Redact fixture without Vite or a server. It uses published package defaults, not a pruned/nano build or a guarantee of all Vite-plugin behavior.

## Navigation and interaction

Warm readiness is navigation-start to committed UI plus two animation frames. Input timing starts at a trusted input event and ends at committed DOM. It excludes paint and is not INP. No forced synchronous React flushes were used.

| Runtime       | 23 rows: warm ready P50 / P95 ms | 23 rows: input commit P50 / P95 ms | 1,000 rows: warm ready P50 / P95 ms | 1,000 rows: input commit P50 / P95 ms |
| ------------- | -------------------------------: | ---------------------------------: | ----------------------------------: | ------------------------------------: |
| Native DOM    |                      70.6 / 84.1 |                          0.2 / 0.5 |                        96.5 / 126.4 |                             1.5 / 3.0 |
| Preact compat |                      78.0 / 86.2 |                          0.6 / 1.2 |                       108.2 / 154.1 |                             4.3 / 9.9 |
| Redact        |                      78.7 / 85.8 |                          0.8 / 1.5 |                       106.3 / 127.6 |                             3.8 / 8.5 |
| React         |                      79.0 / 89.2 |                          0.9 / 1.4 |                       108.1 / 122.8 |                             3.9 / 7.1 |

At current catalog size, the component runtimes' small interaction differences do not support a user-visible speed ranking. Smaller bundles did not yield a comparable proportional startup improvement. Native DOM is still a strong baseline; these results do not justify migrating it as a speedup.

**The large-list Preact tail needs review.** Its pooled warm P95 is 27.7 ms (21.9%) above the native reference, crossing both project review thresholds. Individual-round P95 gaps were 28.4, 5.2 and 28.6 ms; with only seven warm samples per round, that P95 is the maximum. This is a review trigger with limited tail precision. Do not clear a 1,000-row unvirtualized Preact view for adoption from this experiment. Use more samples and evaluate viewport-based rendering when the actual collection feature exists. React's larger bundle did not make it universally slower here.

First-profile navigation was noisy: native's 23-row samples ranged from 124.7 to 1,528.9 ms, and Preact's 1,000-row samples ranged from 152.2 to 1,364.0 ms. Keep those samples in the record; do not select a renderer using the best cold result or attribute the outliers to a runtime without a trace. Browser launch is excluded, OS disk caches are not cleared, and system scheduling remains uncontrolled. Raw data includes first navigations and input-to-two-frame measurements.

## Behavior, compatibility and teardown

All standard variants passed settings validation/saving, dirty state, equal row text, search/empty results, Ctrl K focus, dialog Tab wrapping, Escape, trigger focus restoration and repeated unmount checks. These checks cover one representative slice, not a complete UI or accessibility audit.

Radix fixtures passed normal dialog interactions after autofocus. The rapid probe sends Escape as soon as visible, checks after two frames, and records a miss before retrying after 150 ms:

| Integration    | Rapid Escape misses / 20 | Delayed retry   | Adoption status              |
| -------------- | -----------------------: | --------------- | ---------------------------- |
| React + Radix  |                        0 | Not needed      | Tested slice passed          |
| Preact + Radix |                        4 | Closed on retry | Block this exact integration |
| Redact + Radix |                        0 | Not needed      | Tested slice passed          |

Preact/Radix also missed Escape in exploratory runs. Radix installs its dismiss-layer key listener in a passive effect; Preact schedules passive effects after paint. The observations are consistent with listener readiness, but do not prove that is the sole cause. No dependency patch or production timeout was added. Completing the comparison does not accept this failing combination.

In round one, each case primed five mount/unmount cycles and then exercised 20 more mounts/dialogs. App-effect mount/cleanup counts matched. Modal body styles, scroll-lock attributes and `aria-hidden` state were restored. Final unmounted DOM/listener counts did not grow beyond the primed baseline; all standard dialogs had zero rapid Escape misses.

Mounted forced-GC JS heap in the 23-row cases was approximately 2.06 MiB native, 2.34 MiB Preact, 2.52 MiB Redact and 3.07 MiB React. These are single short-run snapshots including the browser/fixture environment, not whole-browser memory or statistical footprint rankings. Unmounted heap deltas remained nonzero; React's primed snapshots also retained temporary detached DOM that disappeared later. One forced-GC snapshot is not a settled memory floor. These results do not prove leak freedom or long-session stability.

## Result and validation

The user selected Redact for the redesigned extension-page UI. Keep the current native production UI until the first real slice is verified. Redact passed the tested interactions and esbuild/Radix integration; its newer implementation and compatibility limits remain explicit acceptance checks. Correct behavior and measured responsiveness/startup/memory/idle cost still determine implementation quality. The choice does not imply a universal speed advantage or justify skipping component/adapter tests. Preact's large-list tail and Radix failure remain recorded limits. The measurements are unchanged; see the [selected direction and adoption boundaries](../decisions/2026-11-16-ui-runtime.md).

The isolated experiment adds no host permissions, user-data reads, production observers, worker work or runtime dependencies. Root verification passed 108 tests and all static/build checks; packaged product browser tests and the existing production performance check also passed. Experiment types/format/build checks and the 27-case comparison completed, with the Preact/Radix rapid-key failure retained. CI runs a one-round compatibility/measurement smoke and uploads artifacts; local numbers are not CI performance budgets.
