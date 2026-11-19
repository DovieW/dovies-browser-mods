# Workspace UI performance

Measured 2026-11-17 with disposable packaged Chromium profiles on the same CPU/browser/Node versions. Raw environment and samples: [measurement record](workspace-2026-11-17.json).

| Popup ready | Previous native popup | Final Redact workspace |
| ----------- | --------------------: | ---------------------: |
| First open  |             170.48 ms |              166.17 ms |
| Warm P50    |              82.92 ms |               83.62 ms |
| Warm P95    |             101.67 ms |              116.88 ms |

Each run has one first-open and 14 warm observations. These are time-to-visible-command measurements, not paint/INP, a statistically precise cold-start comparison, or proof of a speedup. The default workspace has four favorites rather than the old 23-row list. Synthetic 500/1000-tab copy operation P95 was 3.95/6.23 ms in the final run, versus 2.55/2.49 ms before; this includes the new per-command preference gate. Neither final UI nor synthetic delta crosses both 20% and 20 ms. No idle polling or renderer in the worker/offscreen was added.

An initial run concurrent with browser tests had a 236.64 ms first-open result. An isolated repeat was 152.21 ms first / 80.52 ms warm P50 / 99.26 ms warm P95; the final build was measured again above. Do not treat the noisy first sample as a repeatable regression, or the faster repeat as a universal improvement. Broader large-result rendering, retained-memory and long-session measurements remain feature-specific acceptance work.

The final bundled popup is approximately 81 KiB minified, options 88 KiB, worker 35 KiB and offscreen 1.4 KiB. Options components are absent from popup/launcher inputs, actual React/ReactDOM are absent, and production contains no test bridge. Native maintenance views load only when opened. Prior comparative runtime evidence remains in [the renderer experiment](ui-runtime-2026-11-16.md).
