# Plugin spin-off verification

Verified implementation: `add-plugin-spin-offs`, 2026-10-04.

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

Task 6.2 is intentionally incomplete: native apps are unavailable to this session. In the rebuilt Eagle plugin, create a blank plugin through Sources +, generate a simple interface, and refine an older version. Duplicate File Creator and a mixed private-dependency plugin, enable/promote/reorder copies, then switch plugins during generation and reload. Confirm owner explanations, separate conversations, retained revisions, callable providers and persisted order. No configured Eagle model was invoked during this implementation.

Powerspec could not resolve the optional computer-use skill (plugin-qualified names are unsupported). That skill step remains unresolved; visual verification used the browser tool's documented API. The required OpenSpec/Powerspec and commit-authoring steps were followed.

Generated provider diff review preserves upstream template-literal whitespace from bundled Zod code; `git diff --check` flags those generated string contents. Handwritten source has no whitespace errors. Compact provider output is enabled through the builder's explicit `minify` setting and verified through artifact-loading tests.
