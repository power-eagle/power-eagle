# Verification — 2026-10-21

Implemented compact Sources rows and contextual Plugin details in the existing middle region. The running RuntimeStage remains mounted and hidden during inspection. Inspection uses a separate transient target; normal navigation and activation/revision invalidation retain their existing lifecycle.

## Automated checks

- `npx vitest run src/app`: 46 tests across 11 files pass. Application tests cover native and browser menus, keyboard entry, stale callbacks and filter/reorder guards; flat mixed-plugin rows; declared category/export filtering; explicit screen navigation; cross-plugin inert inspection; screen/state preservation; pending work; Escape and focus restoration; disabled package/dependency recovery; revision replacement; unreadable artifact identity; themes and authoring regressions.
- Focused ESLint passes for all changed TypeScript/TSX files.
- `npm run build` passes, including TypeScript, bundled built-ins, Vite and the Saucepan host. Vite retains its existing large-chunk advisory.
- `openspec validate simplify-plugin-inspection --strict` and `git diff --check` pass.

## Live Eagle check

Checked the packaged app in the existing Power Eagle window using Paper Pop:

1. Sources contains only plugin rows, with no expanded Runtime/Actions children.
2. Incremented Runtime flow to Count: 1, then right-clicked File Creator. Eagle's native menu offered Inspect plugin, Move up and Move down without changing the live tool.
3. Inspect plugin replaced panel 02 with Plugin details; Sources and Agent followed File Creator. Runtime and Actions tabs rendered in the middle region; the Actions tab showed both create and normalizeExtension with their switches and consumer counts.
4. Escape returned to Runtime flow at Count: 1 and restored visible focus to its source row. Hidden runtime controls were absent from the inspection accessibility tree.
5. Shift+F10 on that focused row opened the native menu, with Move up disabled at the first position.

Visual coverage is the available desktop window and Paper Pop. Automated shell/theme tests cover the other layout and theme behavior; this is not an exhaustive visual audit at every size. Existing screen parameter validation is unchanged: parameterized screens require in-tool navigation to supply their parameters.

## Review and proposed commit

Reviewed source, regression tests, documentation, OpenSpec artifacts and rebuilt asset changes. The unrelated deferred authoring-consistency README was preserved.

Proposed subject: `feat(workbench): move plugin inspection into a closable middle panel`

The proposed message records the decision to retain the hidden runtime for state and pending-work preservation while still honoring lifecycle invalidation. The installed legacy Python zmem executable accepted the message: `ok: true`, no diagnostics, no effects, one valid DECISION entry, and no attention truncation (168 commits / 178 nodes). This is legacy-engine validation, not validation by the TypeScript/Node engine described by the current skill. No tooling was replaced. The initial implementation checkpoint was left uncommitted; the user subsequently authorized spec sync, archival and committing.
