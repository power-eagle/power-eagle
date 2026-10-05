# Plugin workspaces

A package namespace is its public `manifest.id` (for example `power-eagle.file-creator`). A plugin instance is one independently managed copy. Its instance ID owns selection, revisions, enablement, and eventually its Agent conversation. Calls still use `namespace/export`.

`src/host/workspaces/model.ts` defines versioned instance, revision, and ordered catalog records. `preferences.ts` stores per-instance package/export choices without importing legacy namespace-only settings. Failed persistence does not alter the in-memory preference.

A clone retains the original namespace and records both `forkOf` and `namespaceConflict`. Namespace arbitration in `claims.ts` validates the conflict lineage and picks the first enabled instance in the explicit catalog order. Clones default off. Undeclared collisions remain failures. The original may be absent; recorded lineage still identifies the conflict set.

The winner owns its entire namespace. An absent/disabled export does not fall through to a lower-priority copy. Dependency kind, version, and cycle validation runs against the winners. Independent activation ties follow plugin order, while dependencies always activate before consumers.

`instanceRegistrations` binds activation groups to instance ID and revision. Replacing an owner revokes old service handles and recreates affected consumers without disposing unrelated providers. A failed replacement is reported; it does not silently restore another owner.

These are host contracts. The app's dynamic workspace catalog, artifact copying, creation controls, and Agent integration are delivered in later checkpoints of `add-plugin-spin-offs`; their completion must be verified separately.

Built-ins are assembled with `npm run builtins:build` (also part of production build) into `public/builtins`, then copied to `dist/builtins` by Vite. The same builder compiles shipped and third-party providers. `ProviderSdk.host.eagle` supplies the host boundary; artifacts include implementation code and do not resolve the original instance. Optional runtime `initialize` lists named actions run in order when a new view opens. This is independent of manifest identity.

Artifact snapshots copy the complete package tree into an independent owned root, including production node_modules, licenses and assets. Host records live outside artifact roots; `.git` and `.power-eagle-workspace` are excluded. Links/junctions, special files, depth over 128, more than 100,000 files or more than 1 GiB are rejected. Cancellation or validation failure removes only the newly created destination. This isolates package files and module caches; arbitrary provider code can still address shared external state.

The common runtime environment uses active instance registrations, validates service method contracts, and rejects stale action results after ownership changes. App catalog wiring follows in the next checkpoint.

`WorkspaceStore` requires the existing state sentinel and never resets state. Its authoritative catalog contains ordered instance/revision records; artifacts are stored under `workspaces/instances/<instanceId>/revisions/<number>`. Catalog writes use a flushed temporary file and atomic rename. A write lock prevents overlapping publication; a busy caller can retry. Display names never enter filesystem paths. Copy failures leave the previous catalog and source artifact intact.

`register` snapshots a shipped/acquired artifact once per stable identity; `create` publishes a blank or captured-revision copy; `reorder` validates exact membership; `revise` validates canonical JSON and writes a new immutable artifact before catalog publication. Origin data is never edited. Instances themselves provide fresh conversation identity; conversation content is stored separately in the Agent slice.
