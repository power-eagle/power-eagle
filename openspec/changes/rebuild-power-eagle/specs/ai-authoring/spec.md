# AI Authoring

## Purpose

Generate and refine new-format runtime documents through Eagle's AI integration with clean versioned history, exposed failures, and the installed language vocabulary.

## ADDED Requirements

### Requirement: Registry-aware generation
The Agent SHALL generate canonical runtime documents using the new language schema and the effective widget, action, service, and styling catalog. Prompts SHALL include relevant type contracts and examples and respect the Eagle API and Web API context toggles. Disabled or failed exports MUST NOT be advertised as available. The initial Agent workflow MUST NOT execute generated TypeScript/CommonJS or install dependencies automatically; new executable providers SHALL enter through the compiled package workflow.

#### Scenario: Generate with a custom installed widget
- **WHEN** an enabled custom widget is relevant to a requested extension
- **THEN** the model receives its public contract and can generate a document referencing that qualified type

#### Scenario: Request an unavailable implementation
- **WHEN** generation references a widget that is not available in the registry
- **THEN** validation explains the missing provider and does not execute invented implementation code

### Requirement: Validate before selecting generated output
Generated documents SHALL pass the same language, package-reference, and activation checks as authored documents before becoming a successful stage version. A failed generation, invalid document, or failed activation SHALL be recorded with its cause and MUST NOT replace the last valid view. Busy state SHALL prevent duplicate submissions for the active turn.

#### Scenario: Reject invalid output
- **WHEN** a model response contains an invalid property or unsupported type
- **THEN** the turn is recorded as failed with a useful diagnostic and the previous valid version stays on stage

#### Scenario: Model request fails
- **WHEN** the model call fails before producing a document
- **THEN** the attempted instruction and failure remain in the conversation and the composer becomes available again

### Requirement: Refinement follows the selected version
A conversation SHALL support a first generated version and subsequent versions based on the version selected on stage. Refinement SHALL receive that version's actual document and instruction. Successful stored versions SHALL remain immutable; selecting or refining an earlier version MUST NOT overwrite it or silently use the newest version as the base.

#### Scenario: Refine an earlier version
- **WHEN** a conversation contains versions 1 and 2 and the user selects version 1 before sending a revision
- **THEN** the next version records version 1 as its base and both existing versions remain unchanged

### Requirement: Persistent noncolliding history
New-format conversations SHALL persist under the versioned clean Power Eagle state root with explicit format identity, monotonic version allocation, turn status, instruction, and base-version identity. Reload SHALL restore compatible new-format conversations and their available versions. Removing a turn from visible history MUST NOT cause its version id or existing payload path to be reused. Legacy conversation records SHALL be removed by the one-time data reset and MUST NOT be loaded, migrated, or converted.

#### Scenario: Delete and create a new turn
- **WHEN** the latest turn is deleted and another turn is submitted
- **THEN** the new turn receives a never-used higher version id and does not overwrite an existing version directory

#### Scenario: Start after a legacy reset
- **WHEN** the revised application opens after legacy conversation data existed
- **THEN** Agent begins with empty new-format history and no legacy executable record is available to load

### Requirement: Source and stage integration
Successful generated packages SHALL appear under `ai generated` and use normal package/activation semantics. Agent version selection SHALL update the shared shell selection. A user SHALL be able to create/select conversations, select stored versions, delete failed turns, and see whether a version is on stage.

#### Scenario: Select a generated package through Sources
- **WHEN** a user chooses a generated package/version from Sources
- **THEN** Stage displays that version and Agent identifies its corresponding conversation and selected version

### Requirement: AI availability and storage errors
An unavailable model, missing Eagle AI integration, or failed history write SHALL produce a clear error without disabling unrelated workbench functions. The Agent MUST NOT report a version as durably saved when persistence fails. Changing selection while a turn is running MUST NOT redirect the result into another conversation.

#### Scenario: Change conversations while generating
- **WHEN** a turn started in conversation A completes after the user selects conversation B
- **THEN** its result is recorded under A without overwriting B or unexpectedly replacing B's stage selection

#### Scenario: Fail to persist a version
- **WHEN** a successful model response cannot be saved
- **THEN** the Agent displays the storage failure and does not present it as a successfully saved version
