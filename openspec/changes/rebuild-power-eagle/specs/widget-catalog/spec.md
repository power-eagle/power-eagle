# Widget Catalog

## Purpose

Provide a broad, documented vocabulary of working widgets for declarative Eagle extensions, with consistent binding, layout, accessibility, and extension behavior.

## ADDED Requirements

### Requirement: Discoverable and complete widget contracts
Every supported widget SHALL publish its type identity, property types/defaults, child slots, events and payloads, binding behavior, theme hooks, and a runnable example. The catalog SHALL distinguish built-in and installed types and effective availability. Registered placeholders without the advertised behavior MUST NOT count as supported widgets. The following families define the required release vocabulary; public type spellings SHALL be consistent between schemas, authoring helpers, documentation, and AI context.

#### Scenario: Discover an installed widget
- **WHEN** a valid package enables a custom widget type
- **THEN** its schema, origin, example, and events appear alongside built-in types and can be used to validate runtime documents

#### Scenario: Check catalog completeness
- **WHEN** a release catalog claims a widget is supported
- **THEN** its example renders and its documented interactive behavior is verifiable rather than displaying a placeholder

### Requirement: Layout primitives
The catalog SHALL include Row, Column, Stack, Positioned, Wrap, Padding, Align, Center, SizedBox, ConstrainedBox, Expanded, Flexible, Spacer, and AspectRatio. Layouts SHALL document their web sizing/overflow semantics, support typed dimensions and alignment, and validate parent-child restrictions such as Positioned within Stack and Expanded/Flexible within a flex layout. Valid layouts MUST fit their declared constraints without unintended window scrolling.

#### Scenario: Combine flexible and fixed content
- **WHEN** a Row contains a fixed-width child and an Expanded child
- **THEN** the expanded child receives the remaining permitted width and obeys declared minimum/maximum constraints

#### Scenario: Reject an invalid layout relationship
- **WHEN** a Positioned widget is used outside a Stack
- **THEN** validation identifies the child location and required parent instead of silently ignoring positioning

### Requirement: Content and presentation widgets
The catalog SHALL include Text, RichText, SelectableText, Markdown, CodeBlock, Image, Icon, Badge, Divider, Card, and Tooltip. Textual widgets SHALL render data as content rather than executable markup. Images SHALL expose loading/failure behavior and accessible descriptions. Markdown SHALL follow a documented non-executing rendering policy. Tooltips SHALL be reachable through keyboard focus as well as pointer interaction.

#### Scenario: Display untrusted text
- **WHEN** a text or markdown input contains script-like content
- **THEN** it is displayed or filtered according to the documented content policy and is not executed

#### Scenario: Handle a missing image
- **WHEN** an image source fails to load
- **THEN** the widget exposes its failure state and declared alternative content without failing the surrounding view

### Requirement: Forms and input controls
The catalog SHALL include Form, TextField, TextArea, NumberField, Checkbox, RadioGroup, Switch, Select, Autocomplete, Slider, DatePicker, ColorPicker, and FilePicker. Controls SHALL have labels, typed values/events, disabled/read-only behavior where applicable, and validation messages. Form submission SHALL validate its fields before executing its submit action and provide structured values. Number and boolean controls MUST preserve their value types; file selection SHALL use the supported host selection contract.

#### Scenario: Submit invalid values
- **WHEN** a form with required text and bounded numeric fields is submitted with invalid values
- **THEN** field errors are associated with the controls and the submit action does not execute

#### Scenario: Submit corrected values
- **WHEN** invalid form values are corrected and the form is resubmitted
- **THEN** the submit action receives the validated typed values

#### Scenario: Cancel a file selection
- **WHEN** a user cancels the FilePicker dialog
- **THEN** no new file selection is committed and the control remains usable

### Requirement: Collections and data views
The catalog SHALL include ScrollView, ListView, GridView, VirtualList, VirtualGrid, ReorderableList, TreeView, DataTable, and PropertyGrid. Collections SHALL support bound data, stable item identity, empty content, and documented selection events. Virtual collections SHALL limit rendered items to a viewport-related working set. Reordering SHALL emit stable identities and support keyboard operation. DataTable SHALL support typed columns, selection, and declared sorting; PropertyGrid SHALL render named values with optional typed editors.

#### Scenario: Scroll a large collection
- **WHEN** VirtualList or VirtualGrid receives thousands of keyed items
- **THEN** it renders a viewport-related subset while scrolling reveals the correct items and retains keyed selection

#### Scenario: Reorder without a pointer
- **WHEN** a keyboard user moves a selected ReorderableList item
- **THEN** the displayed order changes and the reorder event identifies the resulting item order

#### Scenario: Sort and inspect data
- **WHEN** a user sorts a sortable numeric DataTable column
- **THEN** rows follow numeric ordering and retained selection still refers to the same row identities

### Requirement: Navigation and desktop interaction
The catalog SHALL include Button, IconButton, SegmentedControl, Tabs, Accordion, Menu, ContextMenu, Breadcrumbs, and SplitPane. Controls SHALL expose documented activation/selection events and keyboard behavior. SplitPane SHALL respect minimum sizes and keyboard resizing. Menus and tabs SHALL manage focus predictably. Runtime navigation SHALL use the language's navigation contract rather than changing host selection implicitly.

#### Scenario: Use keyboard navigation
- **WHEN** a keyboard user changes a tab and activates a menu item
- **THEN** selection/focus and action events follow the documented control semantics

#### Scenario: Resize a split pane
- **WHEN** a user resizes a SplitPane beyond a child's minimum size
- **THEN** resizing stops at that bound and both panes remain operable

### Requirement: Feedback and media widgets
The catalog SHALL include ProgressIndicator, Skeleton, EmptyState, ErrorState, Banner, Toast, Dialog, ImageGallery, ZoomableImage, AudioPlayer, and VideoPlayer. Feedback SHALL distinguish loading, empty, error, and success conditions through text as well as visual styling. Dialog focus SHALL enter the dialog, remain within it while modal, and return to its invoker on close. Extension overlays SHALL remain scoped to the stage. Media SHALL expose playback/loading/error controls and dispose resources when removed; unsupported media MUST produce a readable state.

#### Scenario: Recover from a failed load
- **WHEN** a data view presents ErrorState with a retry action
- **THEN** activating retry starts the declared action and updates loading/error content from its result

#### Scenario: Close an extension dialog
- **WHEN** a user closes a modal Dialog
- **THEN** focus returns to its invoking stage control and the host Sources and Agent panels have not been covered by the dialog

#### Scenario: Replace playing media
- **WHEN** the selected view containing an active media player is replaced
- **THEN** the player stops and releases its media resources

### Requirement: Eagle-specific widgets
The catalog SHALL include AssetGrid, AssetCard, AssetPicker, FolderTree, TagPicker, LibraryPicker, MetadataEditor, and ImportQueue. These widgets SHALL use typed host data and actions, expose loading/empty/error states, and report actual Eagle results. Metadata changes and imports MUST use the supported Eagle operations rather than editing library metadata files directly. Selection and destructive/overwriting operations SHALL be explicit user interactions or declared actions, not rendering side effects.

#### Scenario: Select and edit assets
- **WHEN** a user selects an asset and submits a supported metadata edit
- **THEN** the correct asset identity is sent to the host operation and the UI reflects the operation's success or failure

#### Scenario: Track an import queue
- **WHEN** several requested imports complete with mixed outcomes
- **THEN** ImportQueue shows each item's outcome and allows the declared recovery action without marking failures as successful

### Requirement: Shared accessibility and themes
Interactive widgets SHALL provide semantic roles, accessible names, visible focus, and keyboard interaction appropriate to their control type. Status MUST NOT rely on color alone. Built-ins SHALL use the supplied design tokens by default while permitting explicit supported variants and scoped themes. Custom widgets SHALL publish the same interaction and theme contract.

#### Scenario: Use a themed form with a keyboard
- **WHEN** a user traverses and submits a themed form without a pointer
- **THEN** labels, focus, errors, and enabled actions remain perceivable and operable
