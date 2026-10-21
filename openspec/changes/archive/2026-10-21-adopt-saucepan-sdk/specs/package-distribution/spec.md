## MODIFIED Requirements

### Requirement: Current Saucepan central-store bridge
The host SHALL use the public Saucepan SDK 0.2 and compatible 0.10 manager through an independently installed executable at `~/.saucepan/bin/saucepan[.exe]` or an explicit override. It SHALL inject an Eagle Node16-compatible transport using asynchronous literal argument arrays, temporary request files, and no shell. The SDK SHALL remain in the packaged CommonJS host bundle, isolated from browser imports. The application MUST NOT read or rewrite the encrypted manager index, reconstruct central content paths, use removed workspace/TOML/bucket commands, or download a private binary. Missing tooling and store failures SHALL produce clear package-management diagnostics without preventing built-in functionality from loading. Startup probing MUST be read-only; store initialization SHALL require an explicit setup action.

#### Scenario: Resolve a shared executable
- **WHEN** the configured compatible executable and initialized central store are available
- **THEN** Power Eagle invokes public SDK operations through the injected transport and consumes returned output paths and UUID metadata without inspecting the encrypted index

#### Scenario: Package manager unavailable
- **WHEN** Saucepan is missing, incompatible, or its store cannot open
- **THEN** acquisition controls report the failed operation and recovery while built-in runtime views remain usable

### Requirement: Scoped and unscoped acquisition
Power Eagle SHALL support app-scoped acquisition for persistent installations and unscoped acquisition for session-only preview or validation. Persistent operations SHALL use stable application UUID registration, explicit library scope, app-domain bindings, policy UUID references and retained generation receipts. Preview SHALL omit application identity, hold its output while consumers are active, and MUST NOT appear as a durable installation. Acquisition SHALL never initialize a missing Saucepan store implicitly. Successful installation SHALL publish an independently owned immutable workspace revision and its matching receipt. Refresh failure SHALL preserve the previous workspace and retained output; refresh MUST reject a separately selected local revision. Removal SHALL deactivate consumers before releasing retention, preserving independent copies and original sources. Uncertain publication or disposal SHALL retain inspectable recovery state.

#### Scenario: Acquire a persistent package
- **WHEN** a user adds a valid package through a supported source
- **THEN** Power Eagle retains its exact output, publishes a workspace instance with receipt identity, and rediscovers it after restart

#### Scenario: Preview without app scope
- **WHEN** Power Eagle acquires a source in unscoped preview mode
- **THEN** the package is staged for the current session without durable installation or app registration, and its reader closes before explicit release after consumers dispose

### Requirement: Recipe source discovery
Users SHALL be able to acquire Git, URL, and local sources through the workbench. Discovery SHALL identify sources using manager-returned source UUIDs and full descriptors, obtain directories from retained acquisition results, and execute no provider code. Git reference/commit selection and subfolders, URL ZIP/raw selection, and local copied-content semantics SHALL use public manager contracts. Power Eagle MUST NOT assume that local inputs remain referenced in place.

#### Scenario: Distinguish two sources
- **WHEN** two acquired requests use the same provider type but have different canonical sources
- **THEN** their packages retain distinct source UUIDs and acquisition identities

#### Scenario: Acquire a local package
- **WHEN** a local source acquisition succeeds
- **THEN** Power Eagle inspects the returned retained directory, snapshots it into the owned workspace, and leaves the original input unchanged
