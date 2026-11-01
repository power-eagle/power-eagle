# Remaining work after Git recovery

Incremental implementation checkpoints now preserve the recovered work. The temporary `test` commit
`72698c8` and its objects survived the reset; the original recovery comparison
matched the saved work. Subsequent package extraction changes are newer work.
The recovery started at `c3db7cf`; no branch reset, push or replacement history was performed.

On 2026-11-01, separate commits recorded Saucepan compatibility (`d0b0cc4`),
reusable Agent packages (`6416da4`), Agent integration (`ccbc5fe`) and the already
completed bridge archive (`c5a23d0`). Release assembly and verification are a
separate checkpoint. Every message passed the TypeScript zmem computed check,
with staged diff review and `pspec check commit` before committing. Active
OpenSpec planning stays local; implementation commits do not clear live gates.

## Current changes

| Change | Verified progress | Remaining work |
| --- | --- | --- |
| `complete-baseline-release-verification` | 5/7 tasks; reproducible 50-file Eagle archive, clean dependency build, workbench BDD, normal/narrow production theme inspection, acquisition reconciliation, 19 real-manager integration tests and 75-widget/eight-capability audit | Install the actual archive in Eagle; verify runtime/provider/mixed packages, ownership, native ordering and reload |
| `extract-reusable-agent-packages` | 22/23 tasks; two packages, app adapters, 49 package tests, 349 app tests, external packed consumers, native synthetic providers, standalone browser UI, lint/typecheck/build and strict change validation | Task 5.3: packaged build in real Eagle, including Node 16 loading, local providers, contextual follow-up, Stage/settings restoration and reload |
| `redesign-agent-conversation-and-settings` | 22/23 tasks; earlier live Claude/Codex results remain historical | Task 6.2: successful Eagle-supplied generation and contextual follow-up; configured localhost:1234 was offline. The package acceptance gate also remains |
| `overhaul-plugin-authoring-consistency` | Deferred scope ledger only | Decide creation/duplication consistency design, then create implementation artifacts; do not treat the backlog README as an approved design |
| Archived `support-forward-compatible-bridges` | All four tasks done; all five delta requirements match main specs; recovered archive committed in `c5a23d0` | No remaining archive checkpoint |

See [package evidence](agent-packages.md) for commands and limitations. The
standalone consumer uses synthetic responses, not authenticated model inference.
The current zmem TypeScript runtime successfully queried computed memory with
complete HEAD coverage; older unsupported annotation types were reported.
This supersedes the historical runtime-availability note in the October 21
acceptance report without rewriting its original evidence.

## Older archived tasks still open

The computed zmem decision `26ba49a:1`, verified against archived task files,
records that the user deliberately archived the baselines with unresolved checks.
Archival did not waive them. Later implementation is relevant evidence, but it
does not automatically complete every part of an old checkbox.

| Archived task | Current evidence | Remaining gap |
| --- | --- | --- |
| Rebuild 11.4: acquisition integration | Follow-up reconciles footer, labels, whole-operation progress, keyboard submission, scoped refresh and failures; 19 real-manager tests pass | Native current-release traversal/reload; historical Eagle lifecycle evidence remains separate |
| Rebuild 11.5: non-authoring workbench coverage | Three BDD scenarios/13 steps, UI coverage, interaction docs and normal/narrow Blueprint/Paper Pop production inspection pass | Native Eagle and complete assistive-technology acceptance are not established by browser inspection |
| Rebuild 13.1: release assembly | Reproducible 50-file archive, explicit roots, local asset references, font licenses, built-ins, four archive tests and external extraction verified | Actual archive installation is covered by 13.3 |
| Rebuild 13.2: clean build and catalog audit | Independent npm ci/build/tests/lint/typecheck pass; all 75 widgets mapped to contracts, examples, documentation and behavior evidence | Actual host behavior remains in real Eagle gates |
| Rebuild 13.3: installed release in Eagle | Historical provider and Saucepan fixture reports cover portions in real Eagle | Install/test the actual release archive across all required package types and built-ins; record failures honestly |
| Rebuild 13.4: final baseline audit | Eight-capability evidence matrix now includes owned reset, external/shared protections, legacy rejection and explicit remaining gaps | Resolve the recorded real-Eagle and Agent/authoring acceptance gaps |
| Spin-offs 6.2: native ownership/order/reload | Catalog and UI fixtures cover ownership handoff and reorder; older screenshot evidence was partial | Real Eagle enable/promote/native-menu reorder/reload with original and copy identities and retained artifacts |

Creation/duplication and authoring-specific live acceptance were explicitly
transferred to the deferred authoring change. The original task lists remain
historical records; none of their incomplete checks has been marked passed by
this recovery audit. Resolve the implementation/acceptance gaps before creating
release or archive claims, then review eligible code and artifact commits using
zmem and the index-path check.

The [release verification record](release-verification.md) distinguishes the
clean snapshot, later focused checks, real-manager launcher issue, historical
host evidence and pending live acceptance. No active change has been newly
archived. The current manifest localization edit is separate from these
checkpoints and remains in the working tree.
