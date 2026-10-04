# Contribution Activation

## Purpose

Make mixed package contributions predictable through explicit dependencies, independent enablement, coherent registry updates, and observable lifecycle failures.

## ADDED Requirements

### Requirement: Explicit dependency resolution
Public exports SHALL have package-qualified identities and declare required provider versions, export ids, and kinds. Activation SHALL resolve dependencies before exposing consumers. Missing exports, incompatible versions, cycles, and duplicate identities MUST be diagnosed deterministically; unrelated valid packages MUST remain available.

#### Scenario: Combine providers from different packages
- **WHEN** a runtime declares a widget from one package and a style from another compatible enabled package
- **THEN** both dependencies are resolved before the runtime becomes available

#### Scenario: Reject a cycle
- **WHEN** required export dependencies form a cycle
- **THEN** affected exports are unavailable with the cycle identified and an unrelated runtime can still activate

### Requirement: Package and export enablement
Users SHALL be able to enable or disable a package and its individually exposed exports. Package disablement SHALL suppress all its exports without erasing their individual preferences. Desired enablement SHALL persist across reloads separately from effective status. User-disabled exports SHALL be `off`; enabled exports with failed dependencies SHALL be `failed` with a cause; available enabled exports SHALL be `active`.

#### Scenario: Restore individual preferences
- **WHEN** a user disables one widget export, disables its package, and later re-enables the package
- **THEN** that widget remains off while other valid enabled exports become active

#### Scenario: Reload enablement
- **WHEN** the workbench reloads after an export was disabled
- **THEN** it remains disabled and is not available to consumers

### Requirement: Dependency-aware revocation and recovery
Disabling or removing a required export SHALL make dependent consumers unavailable and identify the missing dependency. Previously obtained service handles MUST reject future calls after revocation. Re-enabling a valid dependency SHALL allow still-enabled consumers to recover without changing their saved preferences.

#### Scenario: Disable a service in use
- **WHEN** a service export is disabled while a dependent runtime is active
- **THEN** that runtime becomes unavailable, subsequent calls through previously obtained handles fail clearly, and unrelated runtimes remain active

#### Scenario: Restore the provider
- **WHEN** the required service is re-enabled successfully
- **THEN** enabled dependent consumers can activate again in dependency order

### Requirement: Lifecycle cleanup
Activated providers SHALL have a defined disposal lifecycle. Dependents SHALL be disposed before their required providers. View replacement SHALL dispose view-local resources without automatically stopping unrelated package services. Repeated enable/disable or replacement MUST NOT accumulate listeners, timers, or duplicate registrations.

#### Scenario: Replace the stage view
- **WHEN** the user selects a different runtime
- **THEN** the old view's subscriptions are removed and separately enabled services remain available

#### Scenario: Disable and re-enable a provider
- **WHEN** a provider is disabled and enabled repeatedly
- **THEN** each activation has one live set of resources and each completed lifetime is disposed once

### Requirement: Coherent registration and reload
A contribution's validated exports SHALL become visible together. A failed load or update MUST NOT expose a partial new contribution or silently reuse stale code as a successful update. Reload SHALL replace affected code and registrations without disturbing unrelated package dependency instances. Failures SHALL identify the owning package and export where known.

#### Scenario: Provider throws during activation
- **WHEN** a provider fails after preparing some registrations
- **THEN** none of its new registrations remain visible, prepared resources are disposed, and the failure is shown

#### Scenario: Reload changed provider code
- **WHEN** a supported provider is updated and reloaded successfully
- **THEN** new invocations and views use the updated implementation and old affected scopes are disposed

### Requirement: Declared usage inspection
Every exposed export SHALL report its direct declared consumers and their availability. The displayed `used by` count SHALL count distinct direct consuming packages, including inactive consumers, rather than observed invocation frequency. Missing providers SHALL remain identifiable in dependency diagnostics.

#### Scenario: Inspect unused and required exports
- **WHEN** the activation inspector displays one export with no dependents and another required by two packages
- **THEN** it shows `unused` for the first and `used by 2` with those package identities for the second

### Requirement: Deterministic styling composition
Styling exports SHALL supply named token sets, variants, and explicit style targets. Effective styles SHALL compose in order from host defaults through selected package theme, selected view theme, and node overrides. Same-layer ordering SHALL be explicit and MUST NOT depend on discovery order. Disabling optional styles SHALL remove their layer; disabling a required style SHALL follow dependency failure rules. Styling exports MUST NOT implicitly replace widget implementations.

#### Scenario: Disable an optional theme
- **WHEN** a view has an optional package theme and an explicit node color and the theme is disabled
- **THEN** the theme's values disappear, lower layers supply remaining defaults, and the explicit node color remains

#### Scenario: Change discovery order
- **WHEN** packages are discovered in a different filesystem order with the same selected style ordering
- **THEN** the effective style remains identical
