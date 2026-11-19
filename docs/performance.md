# Performance baseline

For the separate native DOM/Preact/React/Redact experiment, see [UI runtime results](performance/ui-runtime-2026-11-16.md). Those fixtures are not the production popup and their timings must not be compared directly with the architecture baseline below.

The architecture refactor is compared with commit `3bf1b0a`, before the runtime extraction. Measurements used disposable profiles and fictional local tab data; no live browser or user content was accessed.

## Method

Three alternating before/after runs, each launching Chromium 153.0.8010.12 on Linux, Intel Core Ultra 9 285H, Node v26.13.1. Each run opens the popup 15 times and waits for usable command rows. The first popup is reported separately; the remaining 14 supply warm percentiles. Each tab-size fixture executes 25 copy-links operations against the stateful browser mock. The table shows medians across the three runs. Browser launch time includes browser overhead and is not an isolated worker-start metric.

| Metric (ms)                         | Before |  After |
| ----------------------------------- | -----: | -----: |
| First popup                         | 182.85 | 153.39 |
| Warm popup p50                      |  87.79 |  87.60 |
| Warm popup p95                      | 110.48 | 112.27 |
| 500 synthetic tabs: copy links p95  |   3.84 |   3.30 |
| 1000 synthetic tabs: copy links p95 |   3.32 |   3.21 |

Warm popup latency is broadly unchanged; these samples do not establish a general speed improvement. Cold timings vary between runs. No repeatable regression crosses both the 20% and 20ms review thresholds. Raw measurements are in [2026-11-16.json](performance/2026-11-16.json); [before](performance/before-median.json) and [after](performance/after-median.json) summaries can be compared with the CLI.

## Repeat

```sh
npm run test:performance
MODS_BENCH_OUTPUT=/tmp/mods-current.json npm run test:performance
npm run performance:compare -- docs/performance/after-median.json /tmp/mods-current.json
```

Compare only matching hardware/browser/Node conditions. `MODS_BENCH_EXTENSION` and `MODS_BENCH_HARNESS` select a separately built baseline checkout. The comparison command flags meaningful regressions for repeated investigation; do not treat a single noisy sample as a release verdict. CI records a fresh benchmark artifact, not a cross-hardware comparison against this laptop.

## Automated protections and limits

- Lifecycle tests verify zero recurring tab queries/writes/injections during idle quiescence and removal of runtime listeners on disposal.
- Shortcut-service tests verify unchanged observations do not write storage; failed sync retries preserve local intent; concurrent requests do not duplicate history.
- Architecture tests reject forbidden dependencies and direct APIs in pure code. Build guards reject DOM/UI inputs in the worker and any test bridge in shipped bundles.
- Packaged browser checks cover real interactions and behavior preservation. White-box tests use a bridge only in disposable instrumented fixtures.

This is an initial baseline, not a full browser profiler. Synthetic tab timings do not measure renderer memory or the cost of 1000 live pages. These runs do not establish long-session heap stability, precise idle CPU usage, or page-observer cost. Existing media pausing injects only on demand; future persistent page scripts need their own realistic workload, retention and disabled-state tests. No new persistent polling or page observers were introduced by this refactor.
