## MODIFIED Requirements

### Requirement: Explicit resource profile expansion
Power Eagle SHALL expose the manager's read-only profile preview and explicit catalog registration through the public SDK with Saucepan >=0.10.0 in numeric major 0, subject to required command availability. Profile expansion and stage overrides SHALL remain manager-owned. Registration SHALL NOT adopt policies on existing applications or claims; callers SHALL explicitly attach returned immutable UUIDs. Resource profiles SHALL NOT opt into managed-app setup, credentials, scope widening or executable shims. Retained previews SHALL retain managed outputs rather than silently substituting temporary retrieval.

#### Scenario: Preview before initialization
- **WHEN** a caller previews a managed profile before creating a store
- **THEN** the expansion is returned without creating store or application state

#### Scenario: Override and adoption boundaries
- **WHEN** a caller explicitly registers a profile with acquisition-stage overrides
- **THEN** the manager returns the validated flat policy references and existing claim intent remains unchanged until explicit adoption
