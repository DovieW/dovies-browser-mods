# Architecture

Browser Mods is **one Chrome extension** with one installation, popup, options page and settings system. Features are internal modules, not independently shipped extensions. `dovies-mods-shared` is a build-time dependency for standards/theme assets, not another installed extension. Do not introduce multiple builds without an explicit change of product direction.

## Ownership

| Location           | Responsibility                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `src/entrypoints/` | Thin bootstraps for worker, popup, options and offscreen document                                            |
| `src/composition/` | Connect feature factories, build the typed action registry, register privileged message/event routes         |
| `src/contracts/`   | Shared data types and runtime message validators; no application dependencies                                |
| `src/core/`        | Pure policies and application services against explicit ports; no Chrome, DOM, network or storage API access |
| `src/platform/`    | Browser context, lifecycle, messaging and storage adapters                                                   |
| `src/features/`    | Feature-owned domain logic, operations, adapters and UI                                                      |
| `src/ui/`          | Reusable DOM helpers, labels, feedback and local theme integration                                           |

Entrypoints do not implement workflows. Features can import sibling public contracts (`public.ts`, `public-ui.ts`, `public-options.ts`); sibling internals are private. Public files cannot bypass this rule. Domain code imports no adapters, browser APIs or UI. Dependencies have no cycles. Create folders only when populated; no generic plugin framework, event bus, global mutable namespace or miscellaneous utils bucket.

## Current modules

- Tabs: pure selection/blank-tab and switching-settings policies, session-state adapter, history lifecycle, tab/group/window operations and settings UI.
- Clipboard: link/screenshot operations and the dedicated offscreen DOM adapter.
- Media: on-demand pause operation, with no persistent page observer.
- Shortcut setup: backup adapter, contextual popup UI and history options view.
- Core shortcuts: deterministic desired-key resolution and an application service using the storage/assignment port.

All production source is TypeScript. The root legacy JavaScript runtime files have been removed. Build output contains static, bundled context entrypoints; there are no runtime concatenation shims, test bridges or remote assets. The shared package is an exact archived dependency, recorded in `vendor/ORIGIN.md`.

## State, lifecycle and trust

Mutable queues and caches belong to factory instances. Worker listeners register synchronously. Needed state is restored from Chrome session/local/sync storage after suspension; no artificial keepalive. Listener scopes provide disposal. UI event listeners and refresh timers are cleaned up on page close. Clipboard bitmap retention is bounded and cleared on the next copy or cleanup deadline.

Validated messages enter through composition/adapter boundaries. Browser assignments and storage are not trusted merely because TypeScript types exist. Message dispatch checks sender identity/context, action schema and tab/privacy ownership. Stable error codes cross boundaries; raw browser error contents are not persisted.

The typed catalog is the only command declaration source; build generates manifest commands from it. The typed registry binds every catalog command to a handler. The compiler checks complete coverage. Browser-specific calls stay in platform or feature adapters. UI calls explicit clients rather than Chrome globals.

Pure core and contracts may refer to Chrome _types_; they may not execute Chrome APIs. Application services receive ports. Domain decisions receive time as an argument, rather than reading the clock.

## Enforcement and verification

`npm run verify` checks formatting, strict TypeScript, typed ESLint, import direction/cycles, forbidden APIs in pure code, unused code, unit tests and the build. Negative architecture fixtures prove that violations fail, including direct API access that an import-only checker cannot see. Tests run the same production modules; a private bridge is generated only inside disposable white-box fixtures and never shipped.

Packaged browser tests cover the real popup/options, production message routing, media and clipboard behavior. White-box tab/clipboard fixtures also exercise private operations in disposable instrumented copies; distinguish those from unmodified-package checks.

Run `npm run test:performance` for disposable browser measurements and 500/1000-tab synthetic operation timings. See [performance](performance.md) for baselines, conditions and limits. Idle/disposal tests enforce no recurring work after quiescence and no listener leaks after teardown. Future page-observing modules must add their own workload/cleanup checks.

[Feature admission](feature-admission.md) still applies to performance, permissions and Store compatibility. It does not change the one-extension architecture.

## Runtime dependency choices

See [dependency decisions](dependencies.md) before adding runtime libraries. The next recommended implementation is standard Zod for boundary validation; no validator has been installed yet. Overlay positioning, list virtualization and templating have separate revisit triggers. Favor measurable benefits and readable code rather than a zero-dependency rule or speculative size optimization.

The popup/options/launcher shell uses pinned Redact. Strict TypeScript/TSX, typed lint, import/context checks, Knip and negative fixtures cover the component code. Options code is excluded from popup/launcher output; the renderer is excluded from worker/offscreen. See [UI interaction](ui-interaction.md) for navigation, authorization, preference synchronization and maintenance views.
