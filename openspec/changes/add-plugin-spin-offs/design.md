# Design

## Context

See proposal.md for scope and motivation. Current evidence:

- `src/app/App.tsx` constructs a static list; `workbench-selection.ts` identifies entries by package ID plus conversation/version and sorts groups alphabetically.
- `dependency-graph.ts` rejects every repeated qualified export; `enablement.ts` persists choices by package ID; controller registration groups also use package ID. None can independently identify two copies of the same namespace.
- `RuntimeStage` chooses built-in calls/startup hooks by manifest ID. Some built-ins are in-memory adapters rather than independently loadable artifacts. File Creator has qualified targets embedded in its authored document.
- The provider SDK exposes package ID and a package-local root/require. The builder already packages compiled entries, assets, and private dependencies; the loader checks paths and isolates cache invalidation by root.
- Agent is currently a placeholder. The active rebuild plans model access, immutable versions, and race-safe history, but those pending features must consume the instance model below rather than introduce a competing catalog.
- `Panel` already supports header actions; no new panel architecture is required. There are no published main specs yet. This is a follow-on to the active rebuild, with explicit reconciliation before archive.

## Goals / Non-Goals

**Goals:** Make copies independently editable and selectable while keeping qualified references stable; make namespace replacement intentional; keep Sources, Stage, and Agent on one plugin identity; deliver creation through durable, validated artifacts.

**Non-Goals:** Simultaneous implementations of the same public namespace, per-export mixing between competing copies, source rewriting/decompilation, an in-app npm/compiler workflow, or independent global conversations. Existing provider authoring remains a compiled-package workflow.

## Decisions

### 1. Separate instance identity from namespace

Introduce a versioned host-owned workspace record with `instanceId`, display name, artifact revision/root, origin, optional `forkOf` (source instance and revision), and optional `namespaceConflict` (claimed namespace and source instance). Keep `manifest.id` as the public namespace used by compiled code and dependencies. A clone preserves it, and its conflict declaration explicitly equals that namespace. A blank plugin allocates both a new instance ID and a new valid namespace.

Selection, enablement, export preferences, conversations, and activation ownership use instance ID. External calls still use `namespace/export`. Built-ins have stable instance IDs; acquired instances use a persisted identity independent of changing artifact content paths. Revisions belong to an instance and are not additional namespace claimants.

Rejected: renaming manifest IDs and rewriting strings inside CJS or node_modules. Arbitrary code can embed or compute references, making such rewrites unreliable. An identity wrapper allows a complete artifact copy without altering its public API.

### 2. Persist user order, then resolve dependencies

Use one global ordered list of instance IDs. Earlier means higher priority. Append newly discovered instances deterministically; preserve relative order across refreshes. Filtering produces a view of this order and never changes precedence. Remove visible group headings; origin remains in details and searchable metadata.

For each namespace, select the first desired-enabled eligible claimant. A declared fork participates in the source's conflict set; unintended duplicate packages without a recognized declaration remain validation errors. A known source can be absent without invalidating a fork's recorded namespace/provenance. Validate declarations statically; never execute a provider just to decide its claim.

Ownership covers the whole namespace, not individual exports. An enabled winner with an individual export disabled still owns the namespace; lower copies do not fill its holes. Validate dependency kinds/versions/cycles on the winners, then activate topologically. Instance order breaks ties between independent nodes but cannot override required dependency order. A winning provider that fails validation/activation is reported failed; do not silently promote another implementation. Explicit disablement or reorder changes the candidate owner.

Preserve the current active/off/failed vocabulary: losing enabled instances show `off` plus “Namespace owned by <name>” and the owner's instance identity. The desired enable switch remains on; the explanation distinguishes conflict suppression from user disablement.

Rejected: last-loaded wins, alphabetical/discovery priority, and combining exports from source and clone. These produce accidental or incoherent implementations.

### 3. Reconcile ownership as a lifecycle change

Build an immutable claim result and effective graph before publishing. Registration identity includes owner instance/revision as well as qualified export so equal public names cannot hide a handoff. Revoke old handles and dispose affected consumers before their provider, then activate the new owner and its valid consumers. Remount affected runtime sessions; preserve unrelated sessions, services, caches, and conversation drafts. Superseded asynchronous work may not publish into the new owner.

Never activate the losing copy merely because it is selected for inspection or conversation. Its Stage explains the conflict and offers “Move above owner”; keyboard-accessible move-up/down controls expose normal ordering. Disable ordering while a search is active, with a clear-filter action, so hidden rows cannot change precedence unexpectedly.

### 4. Create durable local snapshots

Store host-owned workspaces and immutable revisions under the sentinel-protected Power Eagle state root, separate from Saucepan's central store. Persist an ordered catalog envelope and per-instance records, staging writes and publishing atomically. Do not claim success until validation and durable publication succeed. Use instance IDs for paths, never display names. Reject escaping symlinks/reparse paths and incomplete artifacts; never execute lifecycle hooks while copying.

Blank creation asks only for a name, suggests Untitled plugin, and emits a valid runtime-only package: one home screen, empty state/actions/dependencies, and an empty Column. The shell provides the empty-view invitation to describe the plugin in Agent. It is enabled, appended, selected, and given a fresh conversation after save succeeds.

Duplication snapshots the selected immutable artifact revision, not live widget state. Copy the full supported package artifact, including its runtime, declared providers, assets, package metadata/licenses, and self-contained production dependencies. Keep relative layout and namespace strings unchanged; do not copy conversation history, runtime caches, activation state, or external application data. Name it '<source name> copy', assign a fresh instance ID, record the namespace conflict, and insert immediately after its source with desired enablement off. Clear a hiding filter after successful creation and select the new instance. The user enables and promotes it deliberately.

Before offering duplication for shipped plugins, materialize all built-ins as release artifacts with their host capabilities supplied through the existing host boundary. Extract registered calls and startup behavior from `RuntimeStage`'s package-ID special case into the common runtime/provider path; preserve startup semantics in the artifact/runtime contract. A mixed built-in copy must work without borrowing a hidden in-memory implementation from the original instance. This is a required implementation slice, not a silent exclusion of built-ins.

External state written by arbitrary provider code is outside package isolation: if a provider hardcodes an external database/path, cloning files cannot automatically isolate it. Do not invent code rewrites or promise independent external side effects; package-owned roots, caches, state, and dependencies must be isolated.

### 5. Plugin-owned Agent context

Each instance owns one conversation with immutable versions, a selected refinement base, draft prompt, and in-flight request ownership. Selecting another plugin restores its history and draft. A clone has a fresh history seeded by its copied revision and provenance; its source conversation is untouched. Selecting a stored version stays within the same plugin instance and does not create another claimant.

Initial/updated Agent output remains canonical runtime JSON, validated against the effective catalog. Refinement of shipped/acquired artifacts writes local revisions without modifying the origin. Changing selection while a request runs must not redirect its output or steal selection on completion. Publishing a new version updates that instance's revision through the common catalog; it must not create duplicate source rows or additional namespace claims. A failed model call, invalid document, or failed save retains the last usable revision and records a recoverable failure. For provider-only instances, explain runtime-generation versus separately compiled implementation changes.

Share this implementation with rebuild tasks 12.1–12.4. Do not mark the plugin-conversation slice complete using only mocked text or the current Agent placeholder; use deterministic model-adapter tests and record live Eagle verification separately.

### 6. Creation controls

Use `Panel.actions` for a named New plugin button with a + icon at the right of the Sources header, separate from collapse. Its keyboard-operable menu offers Blank plugin and Duplicate selected plugin. A compact creation form in Sources collects the name and shows progress/errors without covering Stage. Cancel returns focus and makes no catalog changes. Duplication captures the selected instance/revision at invocation so a later selection change cannot redirect the copy. Keep search and Blueprint/Paper Pop defaults unchanged.

## Risks / Trade-offs

- [Namespace takeover affects consumers] → visible persisted priority, explicit clone promotion, full dependency validation, coherent teardown, and no silent fallback after failure.
- [Cloning mixed built-ins is larger than a UI button] → materialize their artifact/startup contracts first and verify copies of File Creator, Recent Libraries, and provider-only Paper Pop through the same loader.
- [Private dependencies increase copy cost] → asynchronous progress, cancellation, atomic staging, no concurrent duplicate submission, and bounded cleanup of owned temporary paths.
- [Instance identity cuts across unfinished Agent/catalog work] → share contracts and checkpoints with the rebuild; do not maintain parallel catalogs or conversation stores.
- [Two active OpenSpec changes describe earlier behavior] → reconcile exact affected requirements before implementation and review both changes before archive.

## Migration Plan

This remains a breaking development rebuild, with no legacy importer. Persist explicit versioned instance/order/enablement/conversation formats; incompatible old host preferences receive an actionable reset path rather than being misread or mapped ambiguously. Keep new plugin artifacts intact if preferences fail to load. Paper Pop defaults off and Blueprint remains the default. Do not rerun the existing legacy data reset or touch shared Saucepan content.

Integrate verified slices in the task order. Before release, rebuild the shipped artifacts and exercise duplicate ownership and plugin-bound Agent behavior in Eagle. If a slice is reverted during development, preserve authored snapshots for recovery; older code must not interpret newer workspace records as old package records.
