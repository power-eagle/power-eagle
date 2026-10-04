# Workbench Shell

## Purpose

Present package sources, live runtime views, contribution controls, and AI conversations in the supplied Power Eagle design language with one coherent selection.

## ADDED Requirements

### Requirement: Three-panel design system
The shell SHALL implement the supplied dark blueprint design using Sources, Stage, and Agent panels in that order. Sources and Agent SHALL collapse to accessible rails; Stage SHALL remain visible. Panels SHALL scroll independently and the window SHALL not scroll. The initial 910 by 750 window SHALL follow the scaffold's source/agent proportions and flexible stage. Resizing SHALL retain access to panel controls and stage content. Typography and visual assets SHALL be packaged locally.

#### Scenario: Render the default window
- **WHEN** the workbench opens at 910 by 750
- **THEN** the three framed panels, grid, square controls, typography, and amber activity signal match the design reference without remote asset dependencies

#### Scenario: Collapse a side panel
- **WHEN** Sources or Agent is collapsed and restored
- **THEN** it becomes an operable rail and returns without losing selection, conversation, or enablement state

### Requirement: Unified selection
The workbench SHALL maintain a single selection identifying a package, runtime screen or contribution/export, and any generated conversation/version. Selecting a source entry or AI version SHALL update that same selection and stage. Merely inspecting a package MUST NOT enable it or execute its view's actions.

#### Scenario: Select an AI version
- **WHEN** a user selects an older generated version in Agent
- **THEN** Sources and Stage identify that version consistently and subsequent refinement uses it as the base

#### Scenario: Inspect a disabled provider
- **WHEN** a user selects an off widget provider
- **THEN** its exports and off state appear without enabling or executing them

### Requirement: Source tree and package controls
Sources SHALL group built-ins, canonical sources from Power Eagle's scoped Saucepan view, generated packages, and unscoped artifacts staged for the current session, and SHALL expose each package's declared contribution categories. Package rows SHALL show version, persistence mode, and active/off/failed state, with a new badge for packages generated in the current session. Selecting a runtime SHALL offer its view; selecting a provider contribution SHALL show its exports. Recipe acquisition SHALL be reachable from the source footer with unambiguous persistent and session-only controls and validation.

#### Scenario: Select a mixed package
- **WHEN** a package contains runtime, widgets, and styling contributions
- **THEN** the tree exposes all three and the stage can switch between a runnable view and contribution inspection

#### Scenario: Acquire from the footer
- **WHEN** a user supplies a supported recipe, chooses persistent acquisition, and the operation succeeds
- **THEN** the appropriate canonical source group refreshes from Power Eagle's scoped view without navigating to an old installation tab

#### Scenario: Stage an unscoped artifact
- **WHEN** a user chooses session-only acquisition and validation succeeds
- **THEN** Sources marks the artifact as session-only and does not claim it will return after restart

### Requirement: Stage states and activation inspector
Stage SHALL display preview or activation inspection as appropriate and distinguish empty, loading, ready, off, and error conditions with explanatory text. Activation inspection SHALL expose named exports, schemas or concise descriptions, enablement, dependency usage, and failures. Package failures SHALL show the raw error and an appropriate recovery action rather than only a red indicator.

#### Scenario: Inspect a failed export
- **WHEN** an enabled export is unavailable because a required provider is off
- **THEN** its row shows `failed`, identifies the required provider, and explains how to recover

#### Scenario: Open a provider-only package
- **WHEN** a selected package has no runtime contribution
- **THEN** the stage shows its activation content rather than a broken or fabricated preview

### Requirement: Visual and keyboard consistency
The shell SHALL use the scaffold's token colors, outlined selection, visible focus, lowercase terse chrome, and textual active/off/failed states. Amber SHALL denote activity and the primary action rather than general selection. Send SHALL be the shell's primary action. Source selection, export toggles, panel collapse, version selection, and the composer SHALL be keyboard operable with accessible names. Host shell dialogs/drawers MUST NOT obscure Stage; extension overlays SHALL follow the widget catalog's stage-scoping rules.

#### Scenario: Navigate the workbench by keyboard
- **WHEN** a user selects a source, toggles an export, chooses a version, and sends a prompt using the keyboard
- **THEN** every focused control is visible, named, and operable and status remains understandable without color

### Requirement: Recoverable host state
Failures in installation, a runtime view, a contribution, or an AI turn SHALL remain contained to the relevant surface. The workbench SHALL retain other available sources, controls, and conversations and SHALL not replace the whole window with the failed view.

#### Scenario: A widget fails during rendering
- **WHEN** the selected runtime encounters a widget rendering failure
- **THEN** Stage displays the error while Sources and Agent remain usable to choose another package or refine the document
