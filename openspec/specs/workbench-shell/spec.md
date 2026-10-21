# Workbench Shell

## Purpose

Present package sources, live runtime views, contribution controls, and AI conversations in the supplied Power Eagle design language with one coherent selection.

## Requirements

Scope note (2026-10-10): further AI/creation workflow consistency work and live authoring acceptance are deferred to `overhaul-plugin-authoring-consistency`. The current shared-selection, theme, layout, accessibility, acquisition, and activation contracts remain in force. The follow-on owns interaction changes to creation forms, Agent feedback/composer, and authoring/version flows; it must reconcile the baseline below rather than silently overriding it. Non-authoring shell verification remains part of this change.

### Requirement: Three-panel design system
The shell SHALL retain the supplied Sources, Stage, and Agent arrangement with selectable styling plugins. Sources and Agent SHALL collapse to accessible rails; the middle region SHALL remain visible and SHALL temporarily replace Stage with a closable Plugin details panel during inspection. Panels SHALL scroll independently and the window SHALL not scroll. The initial 910 by 750 window SHALL follow the scaffold's source/agent proportions and flexible stage. Resizing SHALL retain access to panel controls and stage content. Typography and visual assets SHALL be packaged locally.

#### Scenario: Render the default window
- **WHEN** the workbench opens at 910 by 750
- **THEN** the three framed panels retain their reference proportions and use the selected theme without remote asset dependencies

#### Scenario: Collapse a side panel
- **WHEN** Sources or Agent is collapsed and restored
- **THEN** it becomes an operable rail and returns without losing selection, conversation, or enablement state

### Requirement: Unified selection
The workbench SHALL maintain a live selection identifying a plugin instance, its revision, and runtime screen, with an optional transient inspection target identifying a plugin and contribution. Sources, the middle panel and Agent SHALL consistently identify the currently displayed target. Closing inspection SHALL restore the live selection. Selecting a source entry SHALL exit inspection and update the live selection; AI version changes SHALL resolve against the current catalog revision. Merely inspecting a package MUST NOT enable it, start its runtime, or execute its view's actions.

#### Scenario: Select an AI version
- **WHEN** a user selects an older generated version in Agent
- **THEN** Sources and Stage identify that version consistently and subsequent refinement uses it as the base

#### Scenario: Inspect a disabled provider
- **WHEN** a user inspects an off widget provider
- **THEN** its exports and off state appear without enabling or executing them

### Requirement: Source tree and package controls
Sources SHALL present built-ins, canonical sources from Power Eagle's scoped Saucepan view, local/Agent-created instances, and session-only artifacts in one persisted ordered searchable list without visible group headings, and SHALL render compact plugin rows without nested contribution, screen or export navigation. Each row SHALL offer Inspect plugin through its context menu, alongside ordering commands. Contribution categories SHALL be exposed in Plugin details. Origin metadata SHALL remain available in details. Package rows SHALL show version, persistence mode, and active/off/failed state, with a new badge for packages generated in the current session. Selecting a runtime SHALL offer its view; selecting a provider-only plugin SHALL show a concise summary with an inspection entry. Recipe acquisition SHALL be reachable from the source footer with unambiguous persistent and session-only controls and validation.

#### Scenario: Select a mixed package
- **WHEN** a package contains runtime, widgets, and styling contributions
- **THEN** Sources shows one compact plugin row and Plugin details exposes all three categories, with explicit screen-opening controls to return to a runnable view

#### Scenario: Filter plugins across origins
- **WHEN** the user enters a plugin filter
- **THEN** names, identifiers, descriptions, and source groups are matched without changing selection, activation, or the running tool's state; clearing the filter restores the list
- **AND** shipped and Agent-created plugins appear in the same ordered list with origin metadata in details rather than visible group headings

#### Scenario: Acquire from the footer
- **WHEN** a user supplies a supported recipe, chooses persistent acquisition, and the operation succeeds
- **THEN** the ordered plugin list refreshes with canonical source metadata from Power Eagle's scoped view without navigating to an old installation tab

#### Scenario: Stage an unscoped artifact
- **WHEN** a user chooses session-only acquisition and validation succeeds
- **THEN** Sources marks the artifact as session-only and does not claim it will return after restart

### Requirement: Stage states and activation inspector
The middle region SHALL display a runtime view, concise package summary, or temporary Plugin details as appropriate and distinguish empty, loading, ready, off, and error conditions with explanatory text. Plugin details SHALL expose only declared contribution categories and their named exports, schemas or concise descriptions, enablement, dependency usage, and failures. Package failures SHALL show the raw error and an appropriate recovery action rather than only a red indicator.

#### Scenario: Inspect a failed export
- **WHEN** an enabled export is unavailable because a required provider is off
- **THEN** its row shows `failed`, identifies the required provider, and explains how to recover

#### Scenario: Open a provider-only package
- **WHEN** a selected package has no runtime contribution
- **THEN** the stage shows a concise activation summary and an Inspect plugin entry rather than a broken or fabricated preview

#### Scenario: Inspect and return to a running tool
- **WHEN** a user opens Plugin details for the current or another plugin and then closes it
- **THEN** the middle region returns to the previous live tool with its local state and screen preserved, without starting the inspected plugin's runtime
- **AND** the hidden runtime is excluded from keyboard focus and the accessibility tree during inspection

#### Scenario: Leave inspection deliberately
- **WHEN** a user selects a source or explicitly opens a runtime screen in Plugin details
- **THEN** inspection closes and the chosen plugin or screen becomes the live selection

#### Scenario: Invalidate a retained runtime
- **WHEN** the live plugin is disabled, removed, or its revision changes while details is open
- **THEN** normal activation and revision lifecycle rules invalidate the old runtime; closing details does not resurrect an obsolete session

### Requirement: Visual and keyboard consistency
The shell SHALL use theme tokens, outlined selection, visible focus, lowercase terse chrome, and textual active/off/failed states. Activity, selection, and primary actions SHALL remain distinguishable in every theme. Send SHALL be the shell's primary action. Source selection, inspection entry and exit, export toggles, panel collapse, version selection, and the composer SHALL be keyboard operable with accessible names. Plugin details SHALL replace the visible middle panel and provide a named close control. Other host shell dialogs/drawers MUST NOT obscure Stage; extension overlays SHALL follow the widget catalog's stage-scoping rules.

#### Scenario: Navigate the workbench by keyboard
- **WHEN** a user selects a source, toggles an export, chooses a version, and sends a prompt using the keyboard
- **THEN** every focused control is visible, named, and operable and status remains understandable without color

#### Scenario: Drag across navigation labels
- **WHEN** a user drags across source entries, panel headers, or control labels
- **THEN** app chrome does not create a text selection, while editable fields and readable tool content remain selectable

#### Scenario: Inspect by keyboard
- **WHEN** a user presses Shift+F10 or ContextMenu on a source row and chooses Inspect plugin
- **THEN** details opens with visible focus and the same commands available from right-click
- **AND** Escape within details or its close control restores focus to the live source row, or the filter if that row is not visible

### Requirement: Selectable theme plugins
Styling exports explicitly targeting `power-eagle/shell` SHALL supply supported scoped tokens for the workbench and inheriting runtime controls. Paper Pop SHALL ship as a compiled styling-only package and a bundled built-in with warm paper, pastel panels, and bold ink outlines. Blueprint SHALL be the initial theme, and Paper Pop SHALL be disabled by default unless the user has explicitly enabled it. Users SHALL be able to select Blueprint or an available theme and retain that choice across reloads. Theme changes SHALL preserve runtime state and layout. Package and export disablement SHALL remove the selected styling layer and retain the choice for re-enablement.

#### Scenario: Switch appearance while using a tool
- **WHEN** the user changes from Paper Pop to Blueprint with a runtime open
- **THEN** the shell and inheriting controls change appearance without losing tool state or selection

#### Scenario: Disable a selected theme
- **WHEN** the user disables Paper Pop's package or styling export
- **THEN** Blueprint supplies the base appearance with an unavailable-theme explanation and re-enabling restores Paper Pop

### Requirement: Recoverable host state
Failures in installation, a runtime view, a contribution, or an AI turn SHALL remain contained to the relevant surface. The workbench SHALL retain other available sources, controls, and conversations and SHALL not replace the whole window with the failed view.

#### Scenario: A widget fails during rendering
- **WHEN** the selected runtime encounters a widget rendering failure
- **THEN** Stage displays the error while Sources and Agent remain usable to choose another package or refine the document
