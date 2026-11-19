# Browser Mods interaction design

Status: initial production shell implemented, 2026-11-17. One extension, Redact 0.3.1, shared GitHub Dark Default assets and native accessible form controls. New feature implementations remain in the feature roadmap.

## Everyday interaction

Direct Chrome commands execute existing actions without rendering UI. The unassigned `open-palette` command opens search independently of the toolbar home. Existing command IDs and four suggested defaults are preserved. Configure its key through Chrome’s shortcut editor.

The toolbar home supports favorites/current tab (default), searchable commands, and feature sections. Pins, visibility, command/favorite/section ordering, search mode and palette placement sync as separate versioned preference keys. Concurrent changes to separate controls merge independently; Chrome resolves concurrent writes to the same key. No per-device UI overrides. Saving locally does not prove remote delivery.

Palette placement is toolbar (default) or an on-demand centered launcher. The latter uses a modal native dialog and isolated extension iframe, with a short-lived session authorization bound to the source tab, a private MessageChannel, explicit readiness handshake, and focus restoration. Unauthorized embedded launchers do not render; privileged requests revalidate the session and active tab. Unsupported pages or denied injection use the toolbar fallback. No launcher listeners, polling, or page scripts run before invocation.

Search modes are actions/scoped searches (default), everything grouped by result type, or commands only. Disabled and planned mods are excluded unless configured or explicitly explored. Search matches descriptions, command IDs, categories and aliases. Tab metadata is fetched when entering its search mode, not for every character; bookmark search is optional-permission, debounced, and stale results are discarded. Search renders at most 100 results; refine the query for others. Extension/profile search becomes available with the actual extension manager, rather than returning fictional entries.

Arrow keys navigate results, Enter runs, and Escape clears a query, returns from scoped search, then dismisses. One-shot actions close; toggles stay open. Errors are actionable; routine success notifications are omitted. Future persisted jobs must expose progress/cancellation without depending on popup lifetime; no new long-running job module is implemented here.

## Options and maintenance

The full-tab options page separates appearance/navigation, shortcuts, mods, site access, and sync/backup. Search and palette settings results navigate to the matching control. Available mod switches gate commands in every surface, including native maintenance tools. Tabs’ existing bounded recent-history service remains shared infrastructure when tab commands are disabled; Media and Clipboard have no feature observers while disabled.

Shortcut history shows actual and desired bindings and observed device revisions. Explicit adoption can include an empty binding and creates a causally newer revision. Keeping the desired assignment requires no write; Chrome still owns actual assignment. The existing shortcut backup and tab-switch behavior screens remain available as native maintenance views; the options page embeds the existing history view rather than rewriting it twice.

Interface backups use a versioned, strictly validated JSON envelope, a 64 KiB input limit, one sync write, and a local pre-import recovery snapshot. Import does not assign browser keys or grant permissions. Shortcut backups retain their existing separate format and safeguards. Optional site grants can be revoked from options.

## Engineering and verification

Workspace feature adapters own browser access, pure preference policy owns normalization/validation, and feature UI owns search and presentation. Options UI is a separate entrypoint dependency and is absent from popup/launcher bundles. Privileged actions use existing typed worker dispatch; the renderer stays out of worker/offscreen output. TSX participates in strict typing, typed lint, dependency/context checks, Knip and negative fixtures. React-facing imports resolve to pinned Redact; production metadata rejects actual React/ReactDOM and test instrumentation.

No additional positioning or list library is needed for the current bounded native controls. Zod remains the documented candidate for broader shared schemas; this small fixed preference boundary follows existing explicit validators. Revisit indexing/virtualization with real large tab/bookmark workloads, rather than scanning every feature or installing a generic automation framework.

Packaged tests cover layouts, live synchronization, search modes, scoped keyboard navigation, disabled visibility, history, malformed imports and unauthorized launchers. A separate centered-launcher fixture adds localhost host access only in its disposable manifest so injection can be tested without changing production grants; it checks the handshake, Escape, focus restoration and repeat-invocation cleanup. Existing native maintenance, media, clipboard, and tab operation suites remain regression coverage.
