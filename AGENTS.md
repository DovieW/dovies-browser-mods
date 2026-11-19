# Dovie's Browser Mods

This product is one Chrome extension. Read `docs/architecture.md` and `docs/feature-admission.md` before substantial changes. The shared package supplies standards/theme assets, not another extension. Preserve existing command IDs.

All runtime code belongs under `src/` as strict TypeScript. Entrypoints compose, domain code is pure, browser effects belong in adapters, and sibling feature internals are private. Do not restore root JS runtime scripts or add migration exemptions. Public exports must not bypass boundaries.

Performance and data preservation come first. Record workload, idle/disabled cost, permissions, teardown and meaningful before/after measurements for substantial additions. No polling/keepalive or speculative micro-optimization. Store policy concerns require an explicit feature/product discussion; do not silently redesign this as multiple extensions.

Run `npm run verify`; run packaged browser tests for runtime changes and `npm run test:performance` when changing startup, rendering, tab-wide operations, storage or observation. Add negative architecture fixtures when changing enforcement. No test bridge may ship in production. Review failures, concurrency, suspension and privacy boundaries. See `docs/review.md` for the current review record.

Before introducing a runtime dependency or implementing validation, overlays, large lists or UI redesigns, consult `docs/dependencies.md`. Its candidates have explicit revisit triggers; they are not automatic installations. Record adoption/deferral and actual measured costs.

Prefer established, widely adopted, actively maintained packages when suitability is comparable. Use a less familiar alternative only for a concrete benefit; do not optimize tiny bundle differences at the expense of readable code, documentation or ecosystem support.

Judge runtime choices by correct behavior and measured responsiveness, startup, memory and idle cost. Performance is the highest priority; among choices with comparable performance, prefer lower compatibility and maintenance risk. Bundle size matters when it causes a material runtime cost, not as an independent reason to accept regressions or compatibility workarounds. The user chose Redact for the redesigned extension-page UI. Use the recorded comparison and exact component tests; use the verified workspace shell and retain native maintenance screens until migrated. Do not silently switch the chosen renderer back to React or Preact.

The eight additional reference projects and proposed feature slices are recorded in `docs/feature-roadmap.md`. Implement our own selected workflows, not wholesale source/asset copies or every upstream feature. Unanswered scope questions remain provisional; preserve the existing migration backlog.

The implemented UI interaction and synchronization contract is in `docs/ui-interaction.md`. Launcher authorization and tab ownership must not be bypassed by web-accessible pages.
