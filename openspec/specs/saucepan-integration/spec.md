# Saucepan Integration

## Purpose

Enable Power Eagle to acquire, validate and retain shared package resources through the current Saucepan contract without coupling built-in functionality to native tooling.

## Requirements

### Requirement: Workbench acquisition lifecycle
The workbench SHALL expose explicit store setup, Git/URL/local installation, session preview, source refresh and removal. Startup SHALL only inspect manager availability. Persistent installation SHALL publish a complete independent workspace revision with stable instance identity and acquisition provenance. Repeated installation of the same slot SHALL update that instance without duplicating it. Refresh SHALL preserve previous revisions and SHALL reject replacing a selected local edit. Failure SHALL retain the previous usable revision and report recovery information. Removing an installation SHALL preserve its independent duplicates and other applications' resources.

#### Scenario: Restart an installed workspace
- **WHEN** the application restarts after successful installation
- **THEN** it restores the same instance, order, selected local revision and acquisition provenance without fetching or initializing the manager

#### Scenario: Refresh after local editing
- **WHEN** a selected installed instance has a local revision newer than its acquired revision
- **THEN** source refresh reports the conflict without changing that revision or its conversation

#### Scenario: Close a session preview
- **WHEN** the user closes a preview or the application disposes it
- **THEN** providers are disposed before its reader and retention are released, and no installed workspace remains

### Requirement: Host-compatible resource access
Power Eagle SHALL use a tested current Saucepan executable through its host process boundary with literal arguments, bounded requests/responses and structured errors. Loading the application or browser preview SHALL NOT require Node-only transport modules or initialize a store. Missing or incompatible native tooling SHALL disable dependent acquisition controls with actionable diagnostics while built-ins remain usable. The shipped integration SHALL work in the declared Eagle runtime; passing tests on a newer standalone Node runtime SHALL NOT establish that support.

#### Scenario: Supported Eagle runtime
- **WHEN** the packaged application runs in its declared Eagle host with a compatible executable
- **THEN** resource operations succeed through the host bridge without requiring an Eagle Node upgrade

#### Scenario: Browser preview
- **WHEN** native host modules are absent
- **THEN** built-ins load and acquisition reports the missing host capability without an import-time crash

### Requirement: Explicit claim ownership and independent protection
Persistent installation SHALL opt into a stable registered application UUID and explicit installation scope. Identical or covered requests in one scope SHALL reuse the manager's claim/view result; independently scoped requests SHALL remain independently updateable. Credentials, native keyring integrity, path/content verification, source restrictions and claim visibility SHALL remain separate choices. A credential-free claim SHALL NOT thereby become publicly discoverable. Session preview SHALL NOT create a persistent application claim or installed catalog entry.

#### Scenario: Repeated persistent installation
- **WHEN** the same or covered package selection is requested again in the same scope
- **THEN** the existing manager claim is reused and the returned relative view identifies the requested package without duplicate installations

#### Scenario: No native keyring
- **WHEN** the user selects ordinary unprotected acquisition with basic store integrity
- **THEN** installation works without requiring a credential file or native keyring

#### Scenario: Scoped operation is denied
- **WHEN** the manager rejects an app-scoped operation
- **THEN** Power Eagle reports the denial without retrying through unrestricted local access

### Requirement: Resource provenance and policy references
Git, URL and local package inputs SHALL resolve through the manager's source and output identities, selectors and returned paths. Exact commits, subpaths and copied-local-content semantics SHALL be preserved. Refresh, update, revision history and retention policies SHALL be independently represented by immutable policy references; adopting a changed policy SHALL be explicit. Power Eagle SHALL NOT read private manager metadata or infer output directories.

#### Scenario: Exact Git subpath
- **WHEN** a user selects a folder at an exact Git commit
- **THEN** package validation uses the returned selected view and records the actual commit and output identity

#### Scenario: Local input
- **WHEN** local acquisition succeeds
- **THEN** Power Eagle reads the acquired copy and leaves the original directory unchanged

### Requirement: Explicit resource profile expansion
Power Eagle SHALL expose the manager's read-only profile preview and explicit catalog registration through SDK 0.2.0 with Saucepan 0.10. Profile expansion and stage overrides SHALL remain manager-owned. Registration SHALL NOT adopt policies on existing applications or claims; callers SHALL explicitly attach returned immutable UUIDs. Resource profiles SHALL NOT opt into managed-app setup, credentials, scope widening or executable shims. Retained previews SHALL retain managed outputs rather than silently substituting temporary retrieval.

#### Scenario: Preview before initialization
- **WHEN** a caller previews a managed profile before creating a store
- **THEN** the expansion is returned without creating store or application state

#### Scenario: Override and adoption boundaries
- **WHEN** a caller explicitly registers a profile with acquisition-stage overrides
- **THEN** the manager returns the validated flat policy references and existing claim intent remains unchanged until explicit adoption

### Requirement: Active resources remain retained
Before reading or loading an acquired package, Power Eagle SHALL hold explicit retention over its exact output. Publication of a replacement SHALL preserve the prior active output until the replacement is validated and prior readers have finished. Failed acquisition, validation or activation SHALL preserve the previous usable package. Updating a claim or obtaining a path SHALL NOT alone count as retention.

#### Scenario: Concurrent cache cleanup
- **WHEN** cache reclamation runs while a provider still uses an acquired output
- **THEN** that output remains available until its last Power Eagle reader finishes and the corresponding retention is explicitly released

#### Scenario: Failed replacement
- **WHEN** a replacement package fails static validation or activation
- **THEN** the previous usable package and its retention remain intact and the replacement failure is reported

#### Scenario: Independent editable copy
- **WHEN** Power Eagle duplicates an acquired package for editing
- **THEN** retention covers the complete copy and the resulting owned workspace can change independently without writing into the shared output

### Requirement: Mutation uncertainty preserves ownership
A lost or invalid response after a mutating call SHALL be reported as potentially committed. Recovery SHALL inspect or reconcile the original operation identity before starting a different mutation. Preview closure and uninstall SHALL release only Power Eagle-owned references when their readers finish and SHALL NOT delete shared output directories.

#### Scenario: Lost preparation response
- **WHEN** preparation may have committed but its response is lost
- **THEN** retry uses the original operation identity or inspection rather than creating another generation or compensating with shared-content deletion

#### Scenario: Preview closes
- **WHEN** preview validation and all preview readers finish
- **THEN** its retention can be released without creating a persistent application installation or affecting another reader

### Requirement: Explicit protocol transition
Power Eagle SHALL reject unsupported old manager protocols and old token records with actionable diagnostics. It SHALL NOT reset a shared store, convert encrypted records, or silently select a legacy transport. The application distribution SHALL include its client code and SHALL use a separately installed compatible executable.

#### Scenario: Existing old executable
- **WHEN** the selected executable implements only the 0.6 protocol
- **THEN** package acquisition stops before state mutation and built-ins remain usable
