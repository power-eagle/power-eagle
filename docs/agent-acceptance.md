# Agent redesign acceptance

Verified on 2026-10-21. [Machine-readable results](agent-acceptance.json) retain the actual Eagle host versions and the unpassed Eagle-provider check. This is not whole-change acceptance: task 6.2 remains open because Eagle's configured `http://localhost:1234/v1/chat/completions` endpoint refused connections.

## Verified execution

- Actual Eagle: Node 16.17.1, Electron 22.3.7, Chrome 108.0.5359.215, Windows x64.
- Native providers: Codex 0.162.0-alpha.17.2 and Claude 2.1.266. Discovery returned eight Codex and five Claude model entries without inference. Both generated a synthetic runtime document directly from Eagle. No SDK or external runtime was installed.
- `scripts/agent-eagle-acceptance.ts` exercised the production host Agent, store, registry validation, and native adapters in disposable workspace state. Each local provider saved a valid first revision, then refined the earlier blank base using a requirement supplied only by conversation history. Both outputs retained `Lighthouse` and added `Harbor`. Reloading the Agent restored settings and transcript.
- `scripts/agent-ui-acceptance.tsx` rendered the real workbench against isolated persisted fixtures. An Eagle request failed once; selecting Codex and retrying produced a linked successful attempt while keeping the original failure. Switching to Runtime flow during generation did not redirect the result or steal selection. The runtime remained operable. Reload restored Codex, both attempts, the generated revision and an unsent draft.
- In the production Paper Pop window, opening settings hid the live tool, loaded model/effort controls, and Escape returned focus to the Agent button with `Count: 1` intact. The original provider preference was restored after testing.
- In the isolated Blueprint window, settings replaced Plugin details and Escape restored details with focus on the Agent trigger. At a requested 740 by 750 outer window, side panels collapsed into rails; expanding Agent left settings usable beside it with independent scrolling. Temporary fixture navigation was returned to the production page after verification.
- Process-boundary tests exercise timeout, output limits, malformed catalogs, response parsing and cleanup with controlled child processes. Live successful CLI invocations also released their task-owned temporary directories. The actual 120-second timeout was not allowed to run out against a paid model merely to repeat the controlled timeout test.

## Automated checks

`npm test -- --reporter=dot`: **319 passed, 19 skipped**, across 61 passing and two skipped test files. The skipped cases were not treated as evidence. `npm run typecheck`, `npm run build`, focused ESLint for all changed application/host TypeScript, `git diff --check`, and strict OpenSpec validation passed. Vite still reports its bundle-size advisory.

## Requirement coverage

| Delta requirement | Evidence |
| --- | --- |
| Refinement follows the selected version | Host Agent tests; both local providers' earlier-base follow-up in Eagle |
| Persistent noncolliding history | Version-1 migration/recovery fixture, monotonic ids, hidden exclusions and immutable revision tests; live reload |
| Source and stage integration | Workspace/app tests, successful revision links, live background result isolation |
| AI availability and storage errors | Pending-record write failure, output/storage/activation failures, single-error UI tests; live Eagle failure |
| Recoverable conversation requests | Linked retry, provider snapshot, draft replacement and interruption tests; live switch-and-retry |
| Bounded conversation context | Full/partial history, UTF-8 estimation, boundary overflow, hidden/pending exclusion and stored-history immutability tests; live historical requirement retained |
| Three provider choices | UI/provider tests and actual Eagle/Codex/Claude selection/discovery |
| Discovered models and effort | Catalog mapping/pagination/coalescing/refresh/failure tests; live dynamic model/effort controls |
| Immutable request settings | Pending settings/base changes, retry original flags/base, instance isolation tests |
| Constrained local generation | Native invocation argument tests, shell-disabled stdin transport, timeout/output/error cleanup tests; live Node 16 generation |
| Three-panel design system | Existing layout tests and live Paper Pop/Blueprint/narrow-window checks |
| Stage states and activation inspector | Existing activation/inspection tests; live details/settings return |
| Visual and keyboard consistency | Named controls/focus/close tests; live Escape and focus; improved theme-aware button contrast |
| Agent settings companion panel | Provider settings UI and independent preferences tests; live Stage/details entry and exit |
| Retained runtime during Agent configuration | Runtime state, pending work, disabled-session invalidation tests; live counter preservation |

## Remaining acceptance

Successful Eagle-supplied generation and its context-dependent follow-up cannot be accepted while the configured endpoint is offline. Its failure handling is verified; mocked Eagle adapter success is not a substitute for that live check. Start the configured service or select a working default chat model in Eagle, then rerun the Eagle portion of the host fixture. Do not archive the change as fully accepted until task 6.2 is satisfied or its acceptance scope is explicitly revised.

Changes are uncommitted. The installed `zmem` executable is the legacy Python product rather than the skill's TypeScript engine; its available `check --file` accepted the proposed checkpoint subject with no diagnostics. No new-engine memory verification or commit creation is claimed.
