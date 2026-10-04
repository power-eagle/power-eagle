# Package Distribution

## Purpose

Preserve Power Eagle's established installation and release organization while distributing and discovering packages using the new contribution contract.

## ADDED Requirements

### Requirement: Retained installation layout
The application SHALL continue to use `~/.powereagle` by default, with `bin/`, `saucepan.toml`, `.saucepan/index.json`, and Saucepan-managed source directories. Local packages SHALL remain referenced in place. Installed package paths SHALL be obtained from Saucepan rather than reconstructed from repository names. Tests and development verification SHALL support a separate temporary root without modifying live user packages.

#### Scenario: Resolve an existing source location
- **WHEN** Saucepan reports an installed package path
- **THEN** Power Eagle inspects the new-format manifest at that path without relocating the package or replacing Saucepan's index

#### Scenario: Use a local package
- **WHEN** a registered local package is discovered
- **THEN** its contributions resolve from that local directory rather than an automatically copied installation

### Requirement: Source and install management
Users SHALL be able to register supported sources and install packages by supported source identifiers through the workbench. Discovery SHALL retain each package's origin sufficiently to group it under its actual source, rather than collapsing all sources of the same transport type. Install/source errors SHALL identify the failed operation and recovery action. Discovery SHALL not execute provider code.

#### Scenario: Distinguish two sources
- **WHEN** two registered sources supply packages of the same transport type
- **THEN** their packages appear under distinct source identities

#### Scenario: Install a mixed package
- **WHEN** installation succeeds for a new-format package containing runtime and compiled providers
- **THEN** discovery refreshes its manifest contributions and makes the package available for activation

#### Scenario: Report an installation error
- **WHEN** the package manager reports a missing package or source failure
- **THEN** the workbench shows the failed operation without listing a successful new installation

### Requirement: Unsupported payloads remain intact
Old-format packages and generated records found at retained paths SHALL be identified as unsupported. The application MUST NOT execute, automatically convert, delete, or overwrite them to make the new format work. New records SHALL use explicit format identities and avoid collisions with existing records.

#### Scenario: Discover an old v3 package
- **WHEN** a retained installation contains a legacy `main` entry without the new format
- **THEN** it is reported as unsupported, its code is not loaded, and its files remain intact

### Requirement: Packaged dependencies and runtime compatibility
Distribution SHALL preserve the package's compiled entries, assets, and self-contained production dependencies. Packages requiring unsupported runtime/platform targets SHALL fail with a compatibility diagnostic. Installation MUST NOT silently run author build steps or install missing npm dependencies.

#### Scenario: Install without development tools
- **WHEN** a prebuilt supported package is installed on a machine without its authoring toolchain
- **THEN** its packaged contributions can load without compiling source or fetching npm dependencies

#### Scenario: Reject an unsupported native target
- **WHEN** a provider requires a native dependency build incompatible with the host platform/runtime
- **THEN** the package reports the compatibility failure while other supported packages remain usable

### Requirement: Eagle host release package
The application SHALL build an installable `.eagleplugin` containing the root Eagle manifest, `dist/index.html` and its assets, icon, localization resources, and required local fonts/licenses. Release assets MUST resolve without the source repository or a development server. The release SHALL retain the established manifest role and window entry and MUST NOT ship stale legacy application bundles.

#### Scenario: Launch a clean release
- **WHEN** a release artifact is installed in a supported Eagle environment without the development checkout
- **THEN** the new shell and bundled tools load from packaged files and do not depend on source-repo assets or remote font requests

### Requirement: Distribution tooling availability
The host SHALL obtain and reuse a verified compatible Saucepan executable through its existing cache organization. Missing tooling, failed downloads, and checksum failures SHALL produce clear install-management errors without preventing unrelated built-in functionality from loading.

#### Scenario: Package manager unavailable
- **WHEN** Saucepan cannot be provisioned or fails checksum verification
- **THEN** installation controls report the failure and built-in runtime views remain usable
