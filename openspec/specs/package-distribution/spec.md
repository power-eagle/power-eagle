# Package Distribution

## Purpose

Reset legacy Power Eagle-owned data and distribute, acquire, discover, and release new-format packages through Saucepan's current central-store contract.

## Requirements

### Requirement: One-time legacy data reset
The first revised launch SHALL remove the complete legacy Power Eagle-owned `~/.powereagle` tree and obsolete Power Eagle browser-storage keys before creating a sentinel-marked versioned state root. The reset SHALL include legacy conversations, theme and enablement state, cached binaries, old Saucepan workspace files, managed package copies, and generated packages inside that root. It MUST reject an unsafe or unexpected deletion target, MUST be idempotent after the new sentinel exists, MUST NOT remove external local source directories, and MUST NOT remove or rewrite the shared `~/.saucepan` store. Tests SHALL use injected disposable roots rather than live user data.

#### Scenario: Reset a legacy installation
- **WHEN** the exact legacy root contains old package, configuration, theme, and conversation data and has no new-format sentinel
- **THEN** Power Eagle removes that root, creates an empty versioned state root with the sentinel, and begins with no migrated package or conversation records

#### Scenario: Preserve data outside Power Eagle ownership
- **WHEN** the legacy configuration referenced an external local source and the shared Saucepan store already contains content used by another application
- **THEN** reset removes neither location

#### Scenario: Keep new data on later launches
- **WHEN** the versioned sentinel already exists
- **THEN** Power Eagle retains the new-format state and does not repeat the legacy reset

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

### Requirement: New-format installation validation
An acquired package SHALL be discovered from static manifest metadata and validated against the new package and contribution contracts before activation. Installation SHALL support runtime-only, provider-only, and mixed packages while rejecting unsupported formats, missing declared files or dependencies, escaping paths, and incompatible runtime/platform targets. Discovery MUST NOT execute provider code, run author build steps, install missing npm dependencies, or attempt legacy conversion. A failed refresh MUST NOT replace a previously usable new-format package with partial state.

#### Scenario: Acquire a mixed package
- **WHEN** scoped acquisition succeeds for a valid package containing runtime and compiled providers
- **THEN** discovery refreshes its declared contributions and makes the package available for activation

#### Scenario: Reject a legacy package
- **WHEN** an acquired directory contains an old `main` entry without the new package format
- **THEN** validation reports an unsupported format and does not load or convert its code

#### Scenario: Install without development tools
- **WHEN** a prebuilt supported package is acquired on a machine without its authoring toolchain
- **THEN** its compiled entries, assets, and packaged production dependencies can load without compiling source or fetching npm dependencies

#### Scenario: Reject an unsupported native target
- **WHEN** a provider requires a native dependency build incompatible with the host platform/runtime
- **THEN** the package reports the compatibility failure while other supported packages remain usable

### Requirement: Eagle host release package
The application SHALL build an installable `.eagleplugin` containing the root Eagle manifest, `dist/index.html` and its assets, icon, localization resources, and required local fonts/licenses. Release assets MUST resolve without the source repository or a development server. The release SHALL retain the established manifest role and window entry and MUST NOT ship stale legacy application bundles.

#### Scenario: Launch a clean release
- **WHEN** a release artifact is installed in a supported Eagle environment without the development checkout
- **THEN** the new shell and bundled tools load from packaged files and do not depend on source-repo assets or remote font requests
