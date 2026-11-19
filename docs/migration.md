# Migration status

## Completed

- Repository and product rename, retaining Simple Shortcuts command IDs and store identity.
- Shared standards/theme repository and revision-pinned archive dependency.
- Strict TypeScript, ESLint, import/cycle checks, Knip and CI.
- Bundled, typed context entrypoints with no legacy runtime exceptions.
- Pure shortcut reconciliation, per-device sync shards, worker-owned writes, popup notice and options history.

## Architecture extraction complete

The legacy root runtime has been replaced with strict TypeScript feature modules, thin context entrypoints, explicit browser/storage ports and typed action dispatch. Architecture checks include negative fixtures and direct-API rules. Listener teardown, idle-work checks and a repeatable performance benchmark now exist. See architecture.md and performance.md.

Browser Mods is one extension. Evaluate new features against feature-admission.md without assuming separate builds. A concrete Store-policy conflict requires a product discussion, not an automatic packaging change.

The Redact workspace shell now provides configurable popup layouts, toolbar/centered palettes, settings search, synced customization and links to retained native maintenance screens. See [UI interaction](ui-interaction.md). The eight additional reference projects and confirmed screenshot/PDF, profile/bulk-toggle, versioned root-ZIP, single-video-file and per-tab mono requirements are captured in [the feature roadmap](feature-roadmap.md). This expands the backlog below without marking those workflows implemented or dropping earlier migrations.

## Remaining implementation

1. Complete shortcut UX: explicit global unassignment, import/export with rollback, 40KiB global history eviction, 100 revisions per shortcut locally, remaining shortcut-specific adapter cases and workload coverage. Initial adapter and performance checks now exist. Current synced history keeps ten per command per device; quota pressure surfaces a failure rather than silently discarding data. Legacy snapshot UI remains separate until this conversion is finished.
2. Keep the extracted modules within enforced boundaries as functionality grows.
3. Evaluate package fit, then port updated Quick Bookmark including ranking and playlist intent tests; configure OAuth for the retained extension identity and reconnect locally.
4. Evaluate package fit, then port tab discarding with protection/race checks and coordinated badge ownership.
5. Evaluate package fit, then port middle-click search with frame targeting, handoff authorization and cancellation tests.
6. Evaluate package fit, then port Omnivore with local-only credentials, consent, resumable operations and no duplicate destructive retries.
7. Evaluate package fit, then port media arbitration/visibility behavior and formal models, replacing broad observation only after profiling.
8. Complete module enablement/permissions, contextual palette views, validated migrations, docs/store assets and benchmark gates.

Source repositories are intact. Do not remove or disable their installations until their replacement is verified. No store publication has occurred. Preserve licenses/attribution. New features must follow shared standards and the enforced module boundaries.

## Review notes

Per-device sync keys avoid whole-snapshot overwrites. Worker-owned queues serialize observations across extension pages. First observations and empty bindings cannot replace an existing desired key. Lamport revisions establish causality; observation time and ID break concurrent ties. Offline change timestamps are unknown. Repeated observations don't claim newer intent. Local revisions persist before sync writes, allowing retries after quota/network errors.
