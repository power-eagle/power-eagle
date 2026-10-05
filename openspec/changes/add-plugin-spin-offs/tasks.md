# Tasks

Each group is a coherent checkpoint with its own verification and documentation. Preserve unrelated work and use validated zmem commit messages. This plan is not implementation evidence.

## 1. Establish instance and namespace contracts

- [x] 1.1 Reconcile the active rebuild's workbench-shell, contribution-activation, contribution-packages, and ai-authoring planning contracts with this follow-on; verify both changes pass strict OpenSpec validation and contain no conflicting group-label, duplicate-identity, or conversation-ownership requirements.
- [x] 1.2 Define versioned workspace/instance/revision/conflict/order records and instance-based selection and preference keys; verify unique blank identities, same-namespace clones, revision ownership, duplicate record rejection, and explicit incompatible-format diagnostics. Document namespace versus instance identity with an original/clone example.
- [x] 1.3 Implement deterministic whole-namespace arbitration before dependency graph construction; test list ordering, disabled owners, multiple clones, missing original with retained provenance, invalid/undeclared collisions, disabled export holes, incompatible winning versions, and dependency cycles without silently choosing another owner.
- [x] 1.4 Integrate instance-owned activation registrations and coherent claim handoff; verify old handles revoke, consumers dispose before providers, changed-owner instances do not share lifecycle state, failed activation exposes no partial registrations, and unrelated runtime/service instances remain alive. Checkpoint the complete contract slice.

Foundation checkpoint: versioned instance/catalog/preference contracts, declared lineage arbitration, dependency-respecting priority, and instance/revision activation ownership are implemented. Ten focused workspace/activation tests, typecheck, lint, and strict validation of both changes pass. Dynamic app/catalog wiring follows in later tasks.

## 2. Make plugin artifacts independently materializable

- [x] 2.1 Assemble built-in runtime/provider artifacts through the existing builder, preserving host capability injection and startup behavior in the common artifact/runtime contract; test File Creator, Recent Libraries startup, Asset Browser startup, service-only Clipboard, action-only Eagle Widget Actions, Runtime flow, and styling-only Paper Pop through normal discovery/loading. Document the startup contract and rebuild release assets.
- [ ] 2.2 Replace package-ID-specific runtime startup with effective instance-owned catalogs/calls; test a built-in artifact at a relocated root and a consumer of a promoted same-namespace copy, while retaining existing built-in behavior tests and no automatic compiler/npm requirement.
- [x] 2.3 Implement bounded full-artifact snapshot copying with independent roots and private dependency resolution; test mixed/private-dependency packages, relative assets, licenses/metadata, source immutability, exclusion of conversation/runtime data, escaping links, missing files, cancellation, and partial-write cleanup. Document external-state isolation limits and checkpoint this slice.

## 3. Persist and publish local plugin workspaces

- [ ] 3.1 Implement durable atomic workspace/revision/catalog storage beneath the existing owned state root; verify restart recovery, failed writes preserving previous state, concurrent ID allocation, safe path boundaries, and no mutation of source directories or shared Saucepan data.
- [ ] 3.2 Implement blank creation and selected-revision duplication with the specified defaults, names, provenance, order placement, and fresh conversation identity; test valid empty home screens, provider-only clones without fake runtimes, disabled copies, cancellation, and exactly-once publication.
- [ ] 3.3 Replace the app's static package list with a single catalog that merges shipped, acquired, local, and Agent-owned revisions by instance identity and retains user order; test refresh stability, dependency/claim reconciliation, filtered selection, reload, and failure containment. Document the common catalog API for pending rebuild acquisition and Agent tasks; checkpoint this slice.

## 4. Expose creation and explicit priority in Sources

- [ ] 4.1 Remove visible group headings and retain searchable origin details in the single ordered list; verify no headings remain, filtering preserves order and current runtime state, and Blueprint/Paper Pop defaults remain unchanged.
- [ ] 4.2 Add the Sources-header New plugin menu and inline name/progress/error form; verify keyboard opening/selection/cancellation, focus restoration, correct captured source revision, duplicate-submit prevention, clear-filter-on-success, and selection of the durably created plugin.
- [ ] 4.3 Add accessible reorder controls, namespace-owner explanations, and Move above owner; verify desired enablement versus conflict suppression, search-time reorder prevention, promotion/disable handoff, and inspection of losing clones without activation. Document the workflow and inspect 910x750 and compact layouts in both themes; checkpoint the complete Sources slice.

## 5. Bind real Agent authoring to plugin instances

- [ ] 5.1 Implement instance-owned conversation persistence, drafts, selected bases, monotonic immutable revisions, and fresh clone history using the same contracts as rebuild tasks 12.1–12.4; verify original/clone separation, restoration after selection/reload, provenance, older-version refinement, and deletion without version-ID reuse.
- [ ] 5.2 Integrate registry-aware model calls and canonical runtime validation into the selected plugin's Agent context; test successful blank-plugin generation, custom provider references, unsupported implementation requests, invalid output, model errors, and failed saves retaining the last usable revision. Document provider-only editing limits; no generated executable code is run.
- [ ] 5.3 Protect asynchronous ownership during plugin/version changes and namespace handoff; test background completion stays with its captured instance/base, does not steal selection or claim priority, and publishes one new revision to the existing plugin row. Checkpoint the integrated Agent slice and update only genuinely completed rebuild tasks.

## 6. Verify the integrated workflow

- [ ] 6.1 Run relevant unit/BDD suites, lint, typecheck, production build, built-in artifact assembly, and strict validation of both changes; inspect the final diff against every plugin-spin-offs scenario and record actual results.
- [ ] 6.2 In Eagle, create a blank plugin, refine it through Agent, duplicate a built-in and a mixed package, enable/promote/reorder copies, switch conversations during a turn, and reload; record namespace owners, state/history isolation, retained artifacts, and any unavailable live checks without marking them complete.

