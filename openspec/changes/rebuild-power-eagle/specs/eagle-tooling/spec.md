# Eagle Tooling

## Purpose

Retain useful Eagle operations as new-language packages and typed host capabilities while reporting actual outcomes and keeping host access independent from presentation.

## ADDED Requirements

### Requirement: Typed Eagle capability adapters
Eagle operations exposed to runtime actions and providers SHALL have documented argument/result/error contracts. Missing host capabilities SHALL produce actionable errors. Host responses SHALL determine success; failures MUST NOT be replaced by fabricated success messages. UI rendering alone MUST NOT mutate Eagle data.

#### Scenario: Host operation fails
- **WHEN** a supported action requests an Eagle operation and the host rejects it
- **THEN** the action reports the host failure and its success path does not execute

#### Scenario: Preview outside Eagle
- **WHEN** a development preview lacks a real host capability
- **THEN** the affected action reports unavailability or uses an explicitly supplied development adapter without pretending to alter an Eagle library

### Requirement: New-format File Creator
The built-in File Creator SHALL be re-authored using the new runtime and action contracts. It SHALL accept a file name and extension, normalize extensions, allow adding/removing quick-create extension choices, and invoke the host file-creation operation with appropriate initial content. Missing required input SHALL prevent the operation and show guidance.

#### Scenario: Create a file
- **WHEN** a user submits a valid file name and a normalized extension
- **THEN** one host creation action runs with the requested name, extension, and initial content and its result is shown

#### Scenario: Reject missing input
- **WHEN** the user requests file creation without a required name or extension
- **THEN** validation identifies the missing input and no file is created

### Requirement: New-format Recent Libraries
The built-in Recent Libraries tool SHALL load actual available library history through the supported host adapter, filter by name/path, and request library switching explicitly. Library validity MUST be determined by documented host/filesystem evidence rather than a filename suffix heuristic. Removing entries or clearing invalid entries SHALL state whether it changes the current list or persisted history; it MUST NOT delete library contents.

#### Scenario: Filter and switch a library
- **WHEN** a user filters history and opens a selected entry
- **THEN** the requested path belongs to that entry and switch success or failure reflects the host result

#### Scenario: Clear invalid entries
- **WHEN** the user invokes clear-invalid
- **THEN** only entries verified invalid are removed from the documented history/list scope and no library directory is deleted

### Requirement: Reusable clipboard and example contributions
The host SHALL ship a new-format clipboard service with explicit read/write exports and installable examples demonstrating a runtime-only package, a provider-only package, and a mixed package with bundled dependencies. Examples SHALL use the public schema/SDK and normal loader rather than private host-only entry points.

#### Scenario: Use clipboard from another package
- **WHEN** a runtime declares the enabled clipboard write export and invokes it with valid text
- **THEN** the text is sent through the host clipboard capability and the action receives its actual result

#### Scenario: Install a documented example
- **WHEN** a user builds and installs the mixed example using its documented steps
- **THEN** its runtime uses its own widget/style exports and bundled dependency through the same contracts as any other installed package
