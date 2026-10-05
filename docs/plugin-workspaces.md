# Plugin workspaces

A package namespace is its public `manifest.id` (for example `power-eagle.file-creator`). A plugin instance is one independently managed copy. Its instance ID owns selection, revisions, enablement, and eventually its Agent conversation. Calls still use `namespace/export`.

`src/host/workspaces/model.ts` defines versioned instance, revision, and ordered catalog records. `preferences.ts` stores per-instance package/export choices without importing legacy namespace-only settings. Failed persistence does not alter the in-memory preference.

A clone retains the original namespace and records both `forkOf` and `namespaceConflict`. Namespace arbitration in `claims.ts` validates the conflict lineage and picks the first enabled instance in the explicit catalog order. Clones default off. Undeclared collisions remain failures. The original may be absent; recorded lineage still identifies the conflict set.

The winner owns its entire namespace. An absent/disabled export does not fall through to a lower-priority copy. Dependency kind, version, and cycle validation runs against the winners. Independent activation ties follow plugin order, while dependencies always activate before consumers.

`instanceRegistrations` binds activation groups to instance ID and revision. Replacing an owner revokes old service handles and recreates affected consumers without disposing unrelated providers. A failed replacement is reported; it does not silently restore another owner.

These are host contracts. The app's dynamic workspace catalog, artifact copying, creation controls, and Agent integration are delivered in later checkpoints of `add-plugin-spin-offs`; their completion must be verified separately.
