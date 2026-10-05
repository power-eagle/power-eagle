# Plugin Spin-offs

## Purpose

Let users create independent plugin workspaces from scratch or from existing packages, control exclusive namespace ownership through plugin order, and refine each plugin in its own Agent conversation.

## ADDED Requirements

### Requirement: Independent instance identity
Each plugin instance SHALL have a unique persistent identity independent of its public package namespace. Selection, enablement, conversation history, and revision ownership SHALL distinguish instances even when their namespaces match. A spin-off SHALL retain its source namespace and declare its namespace conflict and source revision provenance.

#### Scenario: Distinguish an original and copy
- **WHEN** a plugin is duplicated
- **THEN** its copy has a different instance identity, independent preferences and conversation, and the same declared public namespace without rewriting compiled code references

### Requirement: Unified ordered plugin list
Sources SHALL show one ordered searchable list without visible source-group headings. Origin information SHALL remain available in plugin details and searchable metadata. Earlier instances SHALL have higher namespace claim priority. Reordering SHALL persist and be keyboard operable; filtering and selection SHALL NOT change precedence.

#### Scenario: Filter without reordering
- **WHEN** the user filters the list, then clears the filter
- **THEN** the full list retains its order and namespace owners, and the current runtime state is unchanged

#### Scenario: Explicit priority change
- **WHEN** an enabled spin-off is moved above its enabled source in the unfiltered list
- **THEN** the spin-off becomes the selected namespace claimant and the order survives restart

### Requirement: Creation controls
A New plugin menu at the right of the Sources header SHALL offer Blank plugin and Duplicate selected plugin. Creation SHALL support a display name, cancellation, progress, and recoverable errors without covering Stage. Duplicate SHALL be unavailable when there is no valid selected artifact. Successful creation SHALL reveal and select the new instance and its own Agent context.

#### Scenario: Create a blank plugin
- **WHEN** the user confirms Blank plugin with a valid name
- **THEN** a durable runtime-only plugin with a fresh namespace, valid empty home screen, and fresh conversation appears at the end of the list and becomes selected

#### Scenario: Cancel creation
- **WHEN** the user cancels the creation form
- **THEN** no plugin or conversation is published and focus returns to the invoking control

### Requirement: Complete artifact duplication
Duplication SHALL snapshot the selected revision's supported artifact, including declared runtime/provider contributions, assets, metadata/licenses, and private production dependencies, into an independent owned location. Built-in, acquired, local, and Agent-created plugin artifacts SHALL be supported. The original artifact and conversation MUST remain unchanged. The copy SHALL start disabled immediately after its source, with a distinct name and explicit namespace conflict. Current runtime state and conversation history MUST NOT be copied.

#### Scenario: Duplicate a mixed built-in
- **WHEN** File Creator is duplicated and later enabled as the winning claimant
- **THEN** its copied runtime and action provider operate through the normal host boundary and have independent package-owned state without relying on the original instance's active registrations

#### Scenario: Duplicate a provider-only package
- **WHEN** Paper Pop is duplicated
- **THEN** the new instance contains its styling contribution and namespace conflict without a fabricated runtime document

#### Scenario: Copy fails or is cancelled
- **WHEN** a copy encounters an invalid artifact, escaping path, cancellation, or storage failure
- **THEN** no partial successful plugin is published, the source stays intact, and the user receives a specific failure or cancellation result

### Requirement: Exclusive namespace claims
For a namespace with declared conflicting instances, the first desired-enabled instance in persisted plugin order SHALL own the entire namespace. Later claimants SHALL remain inspectable with an off status and an explanation identifying the owner. Unintended duplicate identities without a recognized conflict declaration SHALL remain errors. Selecting a losing instance SHALL NOT activate it. Disabled exports in a winning instance SHALL NOT be supplied by lower-priority copies.

#### Scenario: Original wins over a later clone
- **WHEN** both the source and its declared clone are enabled and the source precedes the clone
- **THEN** only the source publishes the namespace, and the clone identifies the source as its owner conflict

#### Scenario: Disable the owner
- **WHEN** the winning instance is disabled
- **THEN** the next desired-enabled declared claimant is selected and the old owner's resources are revoked before the new implementation is exposed

#### Scenario: Do not combine export sets
- **WHEN** a winning instance has an export disabled or absent and a lower-priority clone supplies it
- **THEN** consumers report that export unavailable rather than mixing implementations from two owners

### Requirement: Dependency-safe ownership handoff
Namespace claims SHALL resolve before dependency validation and activation. Required dependencies SHALL activate before consumers regardless of list position. Ownership changes SHALL revoke old service handles, dispose affected consumers before providers, and publish coherent replacements without disrupting unrelated instances. A failed winner SHALL produce diagnostics rather than silently activating a lower claimant.

#### Scenario: List priority differs from dependency order
- **WHEN** a winning consumer precedes its winning dependency in Sources
- **THEN** the dependency still activates first while namespace priority remains determined by Sources order

#### Scenario: Replacement fails
- **WHEN** a promoted clone fails dependency validation or activation
- **THEN** the failure is visible, partial registrations are removed, and the original is not silently substituted

### Requirement: Plugin-bound Agent conversation
Agent SHALL display the selected instance's conversation, draft prompt, selected version, and generation state. A clone SHALL start a fresh conversation based on its copied revision. Successful generated revisions SHALL update the same plugin instance and preserve prior immutable versions; they SHALL NOT become competing namespace claimants or duplicate plugin rows. Switching instances during generation SHALL NOT redirect completion or steal selection.

#### Scenario: Switch between original and clone
- **WHEN** the user selects a clone after writing a draft in its source's Agent conversation
- **THEN** Agent shows the clone's own context, and returning to the source restores its draft and history

#### Scenario: Complete in the background
- **WHEN** a turn begun for plugin A completes after the user selects plugin B
- **THEN** its version is saved only to A and B's conversation and Stage selection remain unchanged

#### Scenario: Refine an earlier version
- **WHEN** the user selects an older revision of the current plugin and asks Agent for a refinement
- **THEN** a new immutable revision records that base, preserves all existing revisions, and remains owned by the same plugin instance

### Requirement: Durable validated workspaces
Creation, duplication, revision updates, and plugin order SHALL use versioned durable records under Power Eagle's owned state boundary. A successful write SHALL be atomic from the catalog's perspective; failed records SHALL not replace the last usable revision. Reload SHALL restore instance identities, order, desired enablement, conversations, and provenance. External source directories and shared Saucepan content MUST NOT be mutated by local editing.

#### Scenario: Reload independent instances
- **WHEN** the app reloads after a clone was created and reordered
- **THEN** both instances, their order, distinct conversations, and namespace conflict are restored without copying or registering them again

#### Scenario: Refine an acquired artifact
- **WHEN** Agent produces a valid revision of an acquired plugin
- **THEN** it is stored as that instance's local revision while the acquired source remains unchanged
