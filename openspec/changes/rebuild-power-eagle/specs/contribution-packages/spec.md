# Contribution Packages

## Purpose

Allow one installed package to combine declarative runtimes and compiled providers, including private dependencies and assets, through a discoverable extension contract.

## ADDED Requirements

### Requirement: Composable package manifest
A package SHALL declare the supported `power-eagle/package` format version, id, name, version, description, supported host SDK range, contribution paths, named export descriptors, and export dependencies in `manifest.json`. Runtime, widget, styling, action, and service contributions SHALL be independently optional, with at least one contribution required. The conventional entries SHALL be `run.json`, `types.cjs`, `styling.cjs`, `actions.cjs`, and `services.cjs`; declared paths, not filename scanning, SHALL determine what loads.

#### Scenario: Load a mixed package
- **WHEN** a manifest declares runtime, widget, and styling contributions
- **THEN** all three are discovered as parts of one package without an exclusive plugin-kind restriction

#### Scenario: Load a provider-only package
- **WHEN** a package declares only widget or service exports
- **THEN** it can activate without a runtime entry or preview screen

#### Scenario: Reject an empty or old package
- **WHEN** a manifest declares no contributions or uses the old single-main plugin contract
- **THEN** the package is reported as invalid or unsupported and its code is not executed

### Requirement: Static discovery and named exports
Package discovery SHALL expose contribution kinds, qualified export identities, schemas, and required dependencies without executing provider modules. Activation SHALL verify that provided exports match the manifest descriptors. Multiple exports from one entry SHALL be independently addressable. npm dependency exports MUST NOT automatically become public language exports.

#### Scenario: Discover before execution
- **WHEN** the source tree lists an installed package whose provider has not been activated
- **THEN** its declared contributions and exports can be inspected without running that provider

#### Scenario: Detect mismatched exports
- **WHEN** a provider omits an export required by its manifest
- **THEN** activation reports the mismatch and does not publish a partially valid contribution

### Requirement: Compiled providers and private dependencies
Compiled provider entries SHALL be loadable with production dependencies included in that package's own `node_modules`. Resolution MUST originate from the owning package. Two packages requiring different versions of the same dependency SHALL resolve their own versions. Installed payloads MUST be self-contained and MUST NOT require the author's workspace, package cache, TypeScript compiler, or a runtime dependency install.

#### Scenario: Resolve independent dependency versions
- **WHEN** two installed packages each include a different supported version of the same library
- **THEN** each provider uses the version shipped with its own package

#### Scenario: Report an absent dependency
- **WHEN** a declared provider cannot resolve a required dependency
- **THEN** its package fails with the dependency and entry identified while unrelated packages remain available

### Requirement: Widget provider contract
A widget provider SHALL publish each type's property schema, child slots, events, defaults, and executable renderer adapter. A runtime document SHALL be able to reference an enabled installed type without rebuilding the host. Providers rendered in the host SHALL use its shared rendering runtime under the SDK contract.

#### Scenario: Render a newly installed type
- **WHEN** a compiled widget provider is installed and enabled and a valid runtime document references its qualified type
- **THEN** the stage renders that implementation without a Power Eagle application rebuild

#### Scenario: Render a stateful dependency widget
- **WHEN** a provider wraps a supported third-party stateful UI component
- **THEN** its state and events work under the host rendering runtime without duplicate-runtime failures

### Requirement: Package-relative assets and entry validation
Contribution entries and runtime assets SHALL resolve relative to their package root independently of the host working directory. Missing files, unsupported host SDK ranges, escaping entry paths, and unsupported platform/runtime dependencies MUST produce actionable package diagnostics. Entry paths MUST remain within the package after canonical path resolution.

#### Scenario: Load a relocated package asset
- **WHEN** a valid installed package is located at a different absolute path from its build environment
- **THEN** its declared images, fonts, styles, and other shipped assets still resolve

#### Scenario: Reject an escaping entry
- **WHEN** a contribution path resolves outside the package root
- **THEN** validation rejects it before loading the entry

### Requirement: Reproducible package output
The package build SHALL emit the manifest, runtime documents, compiled provider entries, assets, and needed production dependencies and validate their references. Unsupported dependency targets MUST fail with a build diagnostic. Public authoring documentation SHALL describe the compiled target and supported runtime/platform combinations.

#### Scenario: Install a built artifact independently
- **WHEN** a package artifact is copied to a clean supported environment without the author's source or dependency cache
- **THEN** its declared contributions and dependencies can load using only the artifact and the host SDK
