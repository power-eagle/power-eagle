# Declarative Language

## Purpose

Define the new Power Eagle language that turns typed authoring into validated, serializable interfaces and actions with predictable runtime behavior.

## ADDED Requirements

### Requirement: New versioned document format
The runtime SHALL accept only supported versions of the `power-eagle/runtime` document format. Documents SHALL describe initial state, named screens, a start screen, reusable components, bindings, and named actions as serializable data. Unsupported formats, malformed documents, unknown types, and invalid references MUST produce diagnostics identifying the document location and cause before the affected view executes. Legacy v2/v3 payloads MUST NOT be converted or executed.

#### Scenario: Load a supported document
- **WHEN** a valid document names an available start screen and registered types
- **THEN** the runtime initializes its state and renders that screen

#### Scenario: Reject legacy or malformed input
- **WHEN** a document is a legacy payload or contains an unknown widget type or invalid property
- **THEN** activation fails with a format or property-path diagnostic and no legacy execution path is attempted

### Requirement: Typed authoring produces canonical data
The authoring API SHALL provide typed constructors for supported widgets, actions, values, and reusable components and emit documents conforming to the runtime schema. Equivalent authored models SHALL produce equivalent canonical documents. Runtime JSON MUST NOT depend on authoring closures, React elements, or TypeScript source execution. Compilation failures MUST identify the offending construct and MUST NOT publish a partial package.

#### Scenario: Compile a reusable component
- **WHEN** an author composes two instances of a typed component with different inputs and child slots
- **THEN** the emitted document preserves both instances and validates without requiring the authoring code at runtime

#### Scenario: Reject a nonserializable event handler
- **WHEN** an author supplies an executable closure where an action description is required
- **THEN** authoring or build validation reports the unsupported value and produces no runnable artifact

### Requirement: Scoped bindings and expressions
Bindings SHALL preserve the types of values read from local state, component inputs, repeated-item context, event payloads, and action results. The language SHALL support documented property lookup, formatting, conditionals, boolean/comparison/arithmetic operations, and collection transforms through serializable expressions. Unknown references and invalid operations MUST be diagnosed rather than evaluated as JavaScript. Component instances MUST have independent local state.

#### Scenario: Bind typed values in separate instances
- **WHEN** one component updates its numeric state and a sibling has the same local state key
- **THEN** only the first component's bindings change and the value remains numeric

#### Scenario: Report an invalid expression
- **WHEN** an expression references a missing binding or applies an incompatible operator
- **THEN** the runtime reports the expression path and cause without executing expression text as code

### Requirement: Composable rendering and identity
The renderer SHALL honor registered property schemas, declared single/multiple child slots, conditional visibility, and stable instance keys. Keyed collection updates MUST retain state for surviving items and dispose removed instances. Empty collections SHALL render their declared empty content. Rendering MUST NOT itself invoke Eagle operations or action side effects.

#### Scenario: Reorder keyed items
- **WHEN** a bound list changes order while retaining item keys
- **THEN** each surviving item's local state follows its key rather than its old position

#### Scenario: Remove all items
- **WHEN** the collection becomes empty
- **THEN** removed item scopes are disposed and the declared empty view is shown

### Requirement: Declarative action execution
The language SHALL provide state updates, conditional branching, sequential and parallel action composition, registered action/service calls, network requests, navigation, form operations, and feedback actions. Arguments/results SHALL be validated against the action contract. Sequential actions SHALL expose prior results to explicitly scoped bindings and stop on unhandled failure. Parallel actions SHALL use isolated result bindings and report failures; they MUST NOT imply an execution order.

#### Scenario: Use a service result in a sequence
- **WHEN** a sequence calls a registered service and then assigns a returned field to local state
- **THEN** the state update occurs after the successful call using its validated result

#### Scenario: Handle an action failure
- **WHEN** an action rejects and has a declared error branch
- **THEN** the branch receives a structured error and the success branch does not run

### Requirement: Async scopes and cleanup
Each active view SHALL own its asynchronous actions and subscriptions. Replacing or disabling that view MUST cancel cancellable work, dispose its resources, and prevent late results from writing into another view. Loading and failure states SHALL be available to declarative bindings.

#### Scenario: Navigate during a request
- **WHEN** a request completes after its originating view has been replaced
- **THEN** its result does not modify the replacement view and the old scope remains disposed

### Requirement: Runtime navigation
Documents SHALL support named-screen navigation with validated parameters, a view-local back stack, and replace/reset operations. Navigation MUST remain within the selected runtime export unless an explicit host action requests otherwise.

#### Scenario: Navigate and return
- **WHEN** a document pushes a detail screen with valid parameters and invokes back
- **THEN** the previous screen is restored according to its documented state lifetime without changing the selected package

### Requirement: Public language contract
The language SHALL publish its versioned schema, typed authoring API, expression/action reference, validation diagnostics, and runnable examples together. Built-in, installed, and AI-created documents MUST follow the same validation rules.

#### Scenario: Validate the same document from different sources
- **WHEN** identical invalid documents are supplied as a built-in example, installed runtime, and generated version
- **THEN** each reports the same language violation without source-specific acceptance rules
