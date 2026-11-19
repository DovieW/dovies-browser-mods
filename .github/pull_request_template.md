## Change and validation

Describe the user-visible result, relevant checks and material limitations.

## Substantial features and migrations

For small fixes/docs-only changes, mark this section not applicable.

- Link the feature admission decision (docs/feature-admission.md): include in this extension or defer.
- Explain fit with the package's narrow purpose and any Store-policy uncertainty without silently changing the one-extension architecture.
- State permissions/data flow and worker/page activation, idle/disabled cost and teardown.
- Record relevant before/after measurements and conditions; do not claim performance from size or feature count.
- Cover failure isolation, integration ownership, migration/rollback and packaged behavior checks.

- For validation, overlays, large lists, UI redesigns or new runtime dependencies, consult `docs/dependencies.md` and record adoption or deferral, including measured cost when adopting.
