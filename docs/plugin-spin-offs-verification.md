# Plugin spin-off verification

Verified implementation: `add-plugin-spin-offs`, 2026-10-04.

Follow-up, 2026-10-10: Sources ordering now uses `eagle.contextMenu.open` instead of inline Move up/down buttons. Fifteen focused workbench tests pass, covering native menu callbacks, keyboard entry, boundaries, filter restrictions, stale callbacks, host failures, and real catalog ownership handoff. Typecheck/release build, focused ESLint, and strict change validation pass. API reference: https://developer.eagle.cool/plugin-api/api/context-menu. The native popup itself has not been exercised in live Eagle; include right-click and Shift+F10 ordering in the remaining host check.

- **Automated:** 284 tests pass in 59 files, including existing BDD suites and new namespace, artifact, storage, Agent and workbench regressions.
- **Static/release:** lint passes; production build includes passing TypeScript check and assembly of seven built-in artifacts. Both active OpenSpec changes pass strict validation. Build warnings remain for the approximately 690 kB main bundle and old Browserslist data.
- **Visual:** inspected Blueprint and Paper Pop at 910×750 and 600×750 through the browser preview. The Sources menu stays inside its panel; naming forms and Agent remain readable. Compact mode expands one side panel at a time. Measured compact panel scroll width equals its client width (574 px). Paper Pop was returned to off and Blueprint restored after inspection.
- **Checkpoints:** foundation `8c717a7`, artifacts `ec9c3b7`, storage `243b060`, catalog `d4d41c9`, creation controls `0e0b7f2`, Agent `505860b`; final release corrections follow these commits.

## Scenario audit

| Contract | Evidence |
| --- | --- |
| Independent instance identities and declared same-namespace forks | `workspaces.test.ts`: provenance, duplicate records, invalid lineages, preference isolation |
| Whole-namespace order and dependency-safe handoff | workspace/activation tests: disabled holes, failed winners, reverse disposal, revoked handles, unrelated registrations retained |
| Complete artifact snapshots | `artifacts.test.ts`: seven shipped artifacts, relocated runtime/actions, private modules, assets, licenses, cancellation, limits, links and missing files |
| Atomic durable creation and revisions | `store.test.ts`: reopen, ordering, provider-only clones, exactly-once registration, immutable bases, failed writes and transient Windows rename retry |
| Sources creation and priority | `plugin-workspaces.test.tsx`: keyboard menu, cancellation/focus, captured source, duplicate-submit prevention, filtering, inspector instance toggle and promotion |
| Plugin-bound Agent | `agent.test.ts`: real adapter contract, custom widgets, failures, history, older-base refinement, background ownership, activation rollback and monotonic IDs |
| Shared selection and theme behavior | workbench UI tests: background completion retains the other plugin, revision selection, filtered runtime state, saved theme preference, Blueprint default/Paper Pop off |

The browser preview has no Eagle Node/AI bridge and therefore explicitly reports that durable operations require Eagle. Actual durable operations and compiled providers were exercised through the production classes against isolated filesystem fixtures, not by claiming browser simulation was a live Eagle run.

## Remaining live Eagle check

Archive status (2026-10-10): at the user's explicit request, both baselines were synced to nine main capability specs and archived. Archival records the contracts and evidence; it does not certify full implementation or acceptance. No incomplete checkbox was changed to complete.

- `openspec/changes/archive/2026-10-10-rebuild-power-eagle/tasks.md` retains six incomplete tasks: acquisition UI integration (11.4), non-authoring workbench coverage/accessibility (11.5), release assembly (13.1), clean-install/catalog verification (13.2), packaged Eagle acceptance (13.3), and final capability audit (13.4).
- `openspec/changes/archive/2026-10-10-add-plugin-spin-offs/tasks.md` retains incomplete task 6.2 for existing-instance ownership, native ordering, and reload persistence.
- `overhaul-plugin-authoring-consistency` remains an active local, uncommitted scaffold for the explicitly deferred AI/creation work. The seven archived incomplete tasks remain unresolved; they have not been silently completed or reassigned to that authoring overhaul.

User-supplied live Eagle screenshot, received 2026-10-10, confirms these visible-state checks:

- [x] Paper Pop renders on all three workbench panels with the theme selected.
- [x] A local Untitled plugin is active at revision 1, with its empty home view and matching Agent heading/version chip.
- [x] Runtime flow copy appears in Sources, labelled persistent and off.
- [x] The submitted Agent instruction appears as a failed turn from v1; the shell and revision-1 view remain visible.

This is screenshot evidence, not an observed interaction sequence. It does not establish how the plugin/copy was created, disk persistence, independent copy contents, successful generation, or conversation isolation across selection changes. “Failed to fetch” appears twice (in history and above Send); the screenshot does not identify whether the failure came from the configured model, transport, or another integration layer. It is not a successful live AI acceptance result.

User-directed scope transfer, 2026-10-10: further AI improvements and plugin creation/duplication workflow consistency work now belong to `overhaul-plugin-authoring-consistency`. Its backlog includes Sources + creation, built-in/mixed artifact duplication, successful generation and older-base refinement, switching plugins during generation, and authored revision/history/draft reload. It also owns diagnosing Failed to fetch and revisiting duplicated failure feedback. These checks are deferred, not passed; existing implementation and evidence remain intact.

Retained task 6.2 remains open for existing instances: verify enable/promote/reorder behavior including the native menu, coherent ownership handoff, callable providers, and instance/order/enablement persistence after reload. The agent has not directly exercised Eagle or invoked its configured model; the screenshot adds user-observed host evidence to the deterministic checks above. The new change is a deferred scaffold, not a finalized overhaul design or authorization to implement it.

Powerspec could not resolve the optional computer-use skill (plugin-qualified names are unsupported). That skill step remains unresolved; visual verification used the browser tool's documented API. The required OpenSpec/Powerspec and commit-authoring steps were followed.

Generated provider diff review preserves upstream template-literal whitespace from bundled Zod code; `git diff --check` flags those generated string contents. Handwritten source has no whitespace errors. Compact provider output is enabled through the builder's explicit `minify` setting and verified through artifact-loading tests.
