# Proposal

## Why

Users need to start a blank plugin or spin off an existing one without editing the original or registering competing implementations accidentally. The selected plugin should own the Agent conversation, making Sources, Stage, and Agent one editing context.

## What Changes

- Remove the visible source-group headings, including Included with Power Eagle, and present one ordered, searchable plugin list. Preserve origin metadata in plugin details.
- Add a creation menu at the right of the Sources header: Blank plugin and Duplicate selected plugin. This placement is the proposed default; Agent remains the conversation surface.
- Persist independent plugin instances and editable artifact snapshots with unique instance identities, names, provenance, and order. A blank plugin gets a fresh namespace; a clone retains its source namespace and explicitly declares the conflict.
- **BREAKING:** Separate workbench instance identity from package namespace. Earlier enabled instances in the user-controlled list claim namespaces before later instances. Namespace ownership is exclusive; dependency order still determines activation of the winning implementations.
- Show when a clone is blocked by another namespace owner and allow deliberate promotion through ordering. Creating a clone does not automatically displace its source.
- Bind Agent history and immutable versions to the selected plugin instance. Copies start their own conversation and carry source-version provenance rather than copying the original conversation.
- Support full artifact spin-offs, including declared compiled contributions, assets, and private dependencies. Preserve public namespace references rather than rewriting arbitrary JavaScript.

## Capabilities

### New Capabilities

- `plugin-spin-offs`: Local plugin workspaces, blank/duplicate creation, ordered exclusive namespace claims, and instance-owned Agent conversations.

### Modified Capabilities

None in the published inventory: `openspec list --specs` currently returns no main specs. The active `rebuild-power-eagle` change supplies the baseline implementation and pending contracts. This follow-on explicitly supersedes its grouped Sources presentation, unconditional cross-package duplicate rejection for declared spin-offs, package-id-only preferences, and conversation-first selection model. Implementation must reconcile those affected in-flight requirements before either change is archived; no duplicate main capability is introduced here.

## Impact

- `src/app`: source ordering/creation controls, instance selection, dynamic catalog updates, inspector explanations, and Agent context.
- `src/host/activation`: namespace arbitration before graph construction, instance-specific preferences/lifecycles, coherent ownership handoff and revocation.
- `src/host/install` and `src/sdui/tooling`: durable local snapshots, package validation, built-in artifact assembly, relocation, and private dependency isolation.
- `src/plugins`: materializable built-in packages so duplicates do not depend on an ephemeral in-memory adapter.
- Pending Agent work in `rebuild-power-eagle` tasks 12.1–12.4 must implement plugin-owned conversations against this catalog. This change does not silently claim those tasks are already complete.
- No legacy compatibility layer, automatic npm installation, or generated executable provider code. Existing compiled providers remain supported through the package workflow.
