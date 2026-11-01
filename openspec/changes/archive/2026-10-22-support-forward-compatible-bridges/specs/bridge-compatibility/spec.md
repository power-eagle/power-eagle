## Purpose

Keep external integrations usable across compatible releases while detecting major-version transitions and reporting actual missing capabilities.

## ADDED Requirements

### Requirement: Numeric major compatibility
Versioned external CLI bridges SHALL accept valid semantic versions within their supported numeric major, including later minor and patch releases and build metadata. Established protocol minimums SHALL still apply. The supported majors SHALL be Saucepan 0, Codex 0 and Claude 2; Saucepan SHALL require at least 0.10.0. Prereleases SHALL use semantic ordering against a minimum when one exists and SHALL NOT be excluded solely for being prereleases.

#### Scenario: Saucepan upgrade
- **WHEN** Saucepan reports 0.11.0+v0.11.0 or a later 0.x release at or above 0.10.0
- **THEN** its version is accepted without changing the client SDK or adding a release allowlist

#### Scenario: Agent provider upgrade
- **WHEN** Claude reports a later 2.x release or Codex reports a later 0.x release, including a prerelease
- **THEN** discovery and generation accept the version and continue using their normal protocols

#### Scenario: Major boundary
- **WHEN** Saucepan or Codex reports major 1, or Claude reports major 3
- **THEN** dependent operations stop before a protocol request and report that the new major needs bridge review

#### Scenario: Minimum and malformed output
- **WHEN** Saucepan reports 0.9.0 or 0.10.0-rc.1, or a CLI returns unrecognizable version output
- **THEN** its dependent operations stop with a diagnostic identifying the version problem

### Requirement: Capability and failure isolation
Version acceptance SHALL NOT suppress actual missing commands, protocol failures or host capability failures. Unversioned Eagle APIs SHALL remain capability-checked. Errors SHALL identify the failed layer and give relevant recovery without alleging another layer failed. Built-ins and unrelated providers SHALL remain usable; failures SHALL NOT silently switch providers, initialize stores or replace executables.

#### Scenario: Same-major command removal
- **WHEN** a version-compatible Saucepan executable lacks a required command
- **THEN** acquisition reports the missing command without blaming the Eagle Node bridge

#### Scenario: Missing host or executable
- **WHEN** either the native host bridge or the selected executable cannot be used
- **THEN** recovery identifies that layer and does not demand a specific minor release

#### Scenario: Recheck before use
- **WHEN** a local Agent provider changes major after a prior successful availability check
- **THEN** direct discovery and generation recheck its version before using its protocol

### Requirement: Evidence distinguishes tested and assumed support
Integration documentation SHALL distinguish tested releases from versions accepted by compatibility policy. An SDK upgrade SHALL be driven by required API or host compatibility changes, not by an executable version increase alone. Isolated acceptance SHALL use disposable roots and the public manager interface without modifying the user's shared installation.

#### Scenario: Existing SDK on a newer manager
- **WHEN** the bundled SDK passes the required profile and resource lifecycle against Saucepan 0.11 under the declared Node host runtime
- **THEN** that evidence is recorded and the existing SDK remains sufficient for those operations
