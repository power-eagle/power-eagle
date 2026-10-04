# Power Eagle language v1

Status: structural/semantic validation, typed authoring, canonical emission, scoped state, expression evaluation, keyed rendering, action dispatch, view-local navigation, compiled-provider activation, and the layout, content, form, selection, desktop-interaction, collection, feedback, and media catalog are implemented. Package installation, the workbench, and AI integration remain later checkpoints.

## Build and inspect

Use Node 22 or newer and npm. `package-lock.json` is the sole lockfile. From the revised repository:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

Verified locally with Node 26.8.2. The inherited dependency set still reports npm audit findings; this checkpoint does not claim a release dependency/security audit. The full clean release checks remain in checkpoint 13.

The root app runs `examples/runtime-flow`: increment/reset actions, typed bindings, keyed repeated content, and detail/back navigation. Compiled providers load through the package host; the bounded Eagle host probe is documented separately.

```sh
npm run language -- example
npm run language -- validate examples/runtime-only/run.json
npm run language -- validate examples/runtime-only/manifest.json
npm run language -- validate examples/runtime-flow/run.json
npm run language -- validate examples/runtime-flow/manifest.json
npm run language -- validate examples/layout-widgets/run.json
npm run language -- validate examples/content-widgets/run.json
npm run language -- validate examples/control-widgets/run.json
npm run language -- validate examples/collection-feedback-media/run.json
npm run language -- catalog
npm run language -- schemas
npm run language:types
```

`examples/runtime-only/document.ts` demonstrates reusable inputs and slots. `examples/runtime-flow/document.ts` demonstrates state, expressions, keyed repetition, sequential/parallel actions, and navigation. The layout and content examples exercise their complete initial widget families, including a package-relative image. `examples/control-widgets/document.ts` references every form, selection, and desktop-interaction contract and provides a short keyboard path through typed form submission and declared navigation. `examples/collection-feedback-media/document.ts` composes the complete collection, feedback, and media families in one runtime-only package. The example command validates every example and atomically replaces its `run.json`. Invalid input never overwrites a previous valid file. Declaration files in `.artifacts/sdk-types` derive from the same TypeScript/Zod contracts used by validation. Structural JSON schemas live in `docs/schemas`; use the TypeScript validator as well for cross-reference, type availability, version, parent, and slot checks. The CLI validates built-ins against the foundation catalog; installed descriptors enter through provider activation.

## Document

Every field below is explicit; unknown fields are rejected:

| Field | Contract |
| --- | --- |
| `format`, `formatVersion` | Exactly `power-eagle/runtime`, `1` |
| `start` | Name of a screen that has no required navigation parameters |
| `state` | Named `{schema, initial}` state declarations |
| `screens` | Named `{params, state, body}` screen definitions |
| `components` | Named `{inputs, slots, state, body}` reusable definitions |
| `actions` | Named action descriptions |
| `dependencies` | Explicit `{package, version, export, kind}` requirements |

There is no legacy format detection/conversion beyond a rejection diagnostic. There is no runtime TypeScript compiler, closure execution, or source-string evaluation.

A node has `type` plus optional `key`, `props`, `slots`, `events`, `visible`, `style`, `repeat`, and `empty`. Properties are literals or tagged values. Slots contain one node or an array according to their contract. Event values are action descriptions. Keys must be unique among siblings. Parent restrictions are checked against the registry contract. `style` holds theme values; style application belongs to the later styling checkpoint.

`component:Note` instantiates a local component. `slot:content` inserts a declared child slot inside a component body and cannot have props, events, or its own slots. Component cycles are rejected. Every component instance has its own typed state and shadows document/screen keys with the same name. Normal component instances require a stable `key`; repeated components derive it from `repeat.key`. Authoring instances copy their supplied inputs/slots so later author-side mutation cannot alter another instance.

`repeat.items` must resolve to an array and `repeat.key` must resolve to a unique string or number for each item. The repeated node can bind `item`; `input.index` contains its current index. Reordering retains component state by the evaluated key. Removed instances are disposed. An empty array renders `empty` when declared. Rendering resolves data and attaches event dispatchers; it does not call host adapters or execute actions.

## Types and values

Contracts use a closed descriptor vocabulary: `string` (optional `minLength`, `maxLength`, and regular-expression `pattern`), `number` (optional `minimum`, `maximum`, `integer`), `boolean`, `null`, `json`, `enum` (`values`), `array` (`items`), and `object` (`properties`, `required`). Object values reject unknown properties; declared required keys must exist in the schema. Numbers are finite and are never coerced from strings.

Bindings are data:

```json
{ "$ref": { "scope": "input", "path": ["title"] } }
```

Scopes are `state`, `input`, `params`, `item`, `event`, `result`, `error`, and `action`. Paths are arrays of property names or nonnegative array indexes. Static references are checked against their declarations; event/result/error/item availability is checked by context. `action.<name>` exposes `{status,result,error}` for a named action, with status `idle`, `loading`, `success`, `error`, or `cancelled`. Reads return data copies. State writes target the nearest declaration, validate the complete updated value, preserve number/boolean/object types, and notify the renderer only after a valid write.

Package assets use `{ "$asset": "assets/icon.svg" }`. Paths are package-relative, use forward slashes, and forbid traversal, absolute paths, and URL syntax. Filesystem existence and canonical/symlink containment checks belong to package loading; a structural schema cannot establish them.

## Content safety policy

Text, SelectableText, RichText spans, and CodeBlock always become DOM text nodes. Their input is never parsed as HTML. RichText permits only its declared tone, weight, italic, decoration, and code-span fields.

Markdown supports CommonMark plus GitHub-style tables, task lists, strikethrough, and autolinks. Raw HTML is discarded. Link destinations are limited to `http`, `https`, `mailto`, and same-document fragments; other protocols and relative navigation are removed. Links open outside the plugin view with opener access disabled. Markdown image syntax renders its alternative description as text and does not fetch the image. Use the Image widget for declared image loading and failure behavior.

Image accepts a resolved package asset or source string, exposes `loading`, `ready`, or `error` through `data-state`, preserves accessible alternative text, and contains a failed load inside its fallback slot or `failureText`. Icon names come from the compiled public allowlist rather than runtime module lookup. Tooltip owns a keyboard-focusable trigger and links it to a `role="tooltip"` description with `aria-describedby`.

Expressions use `{ "$expr": { "op": "add", "args": [1, 2] } }`. Evaluation is closed and never treats strings as code:

| Operators | Semantics |
| --- | --- |
| `get` | Read one object property or array index; missing values are errors |
| `format` | Replace numbered `{0}` placeholders with JSON values |
| `if`, `not`, `and`, `or` | Conditional and short-circuit boolean operations |
| `eq`, `ne` | Structural JSON equality/inequality |
| `lt`, `lte`, `gt`, `gte` | Compare two numbers or two strings without coercion |
| `add`, `subtract`, `multiply`, `divide` | Finite-number arithmetic; division by zero is an error |
| `length` | String, array, or object member count |
| `map`, `filter` | Evaluate the second argument once per array item using `item` |
| `concat` | Concatenate all strings or all arrays; mixed kinds are errors |

Validation rejects unknown operators and wrong arity. Runtime type/path failures throw `ExpressionError` with the expression JSON Pointer. Dollar-prefixed object keys are reserved for language tags.

## Authoring

Import from `src/sdui/authoring`. `defineWidget` derives constructor property types from a widget contract; `defineComponent` derives instance inputs from its schema. `defineDocument` checks the document shape, and `compile(document, catalog)` performs validation and returns deterministic sorted-key JSON. `ref<T>` and `expression<T>` construct typed values; the schema validator still checks declared targets. `forEach`, `set`, `sequence`, `parallel`, `navigate`, `back`, `run`, `call`, `form`, and `asset` construct serializable nodes/actions. All other action variants can be authored as the exported `Action` union.

Functions, undefined, symbols, bigints, nonfinite numbers, circular objects, accessors, exotic instances, sparse arrays, and reserved prototype keys fail before serialization. A callback cannot silently disappear from output. JSON parsing followed by `validateRuntime` uses the same rules for built-in, installed, and generated input.

## Action shapes

The dispatcher implements these discriminated `kind` values:

| Kind | Required fields |
| --- | --- |
| `set` | `path`, `value` |
| `if` | `condition`, `then`; optional `else` |
| `sequence`, `parallel` | `steps` |
| `call` | qualified `target`, `args`; optional service `method` |
| `request` | `url`, HTTP `method`; optional `headers`, `body` |
| `navigate` | `mode` (`push`, `replace`, `reset`), `screen`, `params` |
| `back` | none |
| `run` | named `action` |
| `form` | `operation` (`validate`, `submit`, `reset`), `id` |
| `feedback` | `operation` (`toast`, `openDialog`, `closeDialog`), `id`; optional `value` |

Every action may declare `success` and `error` branches. A success branch binds the action result; an error branch binds `{name,message}` plus validation diagnostics when available. Sequences expose each successful result to the next step and stop on unhandled failure. Parallel branches receive the same incoming result, cannot see sibling results, and return results in declaration order. Registered calls validate input before invocation and output afterward. Requests and feedback go through injected adapters; missing adapters fail explicitly. Form actions first resolve an active `Form` in the runtime session, with an injected form adapter available for host-owned forms outside the rendered tree.

## Forms and typed fields

`Form` owns a stable identifier, a many-child slot, and `submit`, `invalid`, and `reset` events. `TextField`, `TextArea`, `NumberField`, `Checkbox`, `RadioGroup`, `Switch`, `Select`, `Autocomplete`, `Slider`, `DatePicker`, `ColorPicker`, and `FilePicker` are controlled widgets: their `value` property reads document state and their `change` event writes the next value through a declared action. Text, selection, ISO date, and hex-color events carry strings; numeric controls carry finite numbers; checkbox/switch events carry booleans; and FilePicker always carries a string array for both single and multiple selection.

Submitting through the native form path or `form(id, 'submit')` runs the same validation pass. A valid form sends one object keyed by field id to `submit`. An invalid form associates each message with its control, focuses the first invalid field, sends `{valid, values, errors}` to `invalid`, and does not run `submit`. `form(id, 'validate')` returns that result without submitting. `form(id, 'reset')` clears validation and emits each field's initial typed value through its `change` event before `reset` runs.

Disabled fields cannot change, do not validate, and are omitted from submitted values. Read-only fields cannot change but remain part of the structured values. `validationMode` is `submit`, `change`, or `always`. Fields support an externally supplied `error`; built-in rules cover required values, text length/patterns, numeric bounds/steps/integers, required booleans, declared options, ISO dates and ranges, six-digit hex colors, and required file selections.

Autocomplete exposes a combobox/listbox relationship and supports arrow-key traversal, Enter selection, and Escape dismissal. Slider implements arrow, Home, and End keys and clamps emitted numbers to its declared minimum and maximum. FilePicker is the only built-in field that opens a host surface. Its injected selection adapter receives file-or-directory mode, multiplicity, labels, an initial path, extension filters, and the active screen's abort signal. Eagle maps that request to `dialog.showOpenDialog`. A cancelled dialog returns `null`, emits `cancel`, and does not change the controlled value; a missing adapter or host failure is rendered as an associated field diagnostic.

## Desktop interaction controls

Button and IconButton use native button activation and expose `press` plus boolean focus events. SegmentedControl and Tabs keep string selection in runtime state and use roving keyboard focus; Tabs pairs each tab descriptor with the child at the same index and renders the selected child as a tab panel. Accordion similarly pairs descriptors and children, stores open ids as a string array, and supports single or multiple expansion with arrow, Home, and End focus movement.

Menu and ContextMenu emit item ids through `select`. Opening moves focus into the menu, arrow/Home/End keys move among enabled items, and Escape or selection closes the menu and restores its invoker. ContextMenu opens from a pointer context-menu event or Shift+F10. Breadcrumbs render ordinary navigation buttons and only emit an id; screen changes still occur through a declared `navigate` or `back` action.

SplitPane pairs `start` and `end` slots around a focusable separator. Its controlled `value`, `minimumStart`, and `minimumEnd` are percentages from 0 through 100. Pointer movement and direction-appropriate arrow keys emit bounded resize values; Home and End snap to the two declared bounds. `resizeStart` and `resizeEnd` identify a pointer drag's lifetime.

## Collections

ScrollView owns directional overflow and emits `{x,y}` scroll positions. ListView and GridView render ordinary keyed child nodes, keep selection as a controlled string array of child keys, and expose single, multiple, or no-selection modes. Space changes the active selection, Enter activates its key, and arrow/Home/End keys move the active item. Reordering child declarations does not change their identity.

VirtualList and VirtualGrid use the same child-node contract, selection model, and events. Their fixed item or row extent plus viewport height determines a bounded visible window with overscan; off-screen children are not materialized as React elements. This keeps thousands of declarative children usable without introducing a separate item-data language.

ReorderableList emits the complete ordered key array after Alt+Arrow movement or drag/drop; document state still owns the underlying data. TreeView accepts flat `{id,label,parentId?,disabled?}` entries and keeps expansion and selection as controlled id arrays. DataTable requires stable row identities, declares each column as string, number, boolean, or date, and emits controlled selection and sort requests without mutating source rows. PropertyGrid emits `{id,value}` edits and preserves string, number, boolean, and JSON value types; entries without an editable editor remain outputs.

## Feedback and stage-local overlays

ProgressIndicator and Skeleton always expose readable loading labels. EmptyState, ErrorState, and Banner provide explicit action, retry, dismiss, and tone semantics. Error and warning content remains textual and does not rely on color alone.

`feedback('toast', id, value)`, `feedback('openDialog', id, value)`, and `feedback('closeDialog', id)` update the current RuntimeSession feedback controller. Toast and Dialog nodes with matching ids render that state inside the active `[data-pe-runtime-stage]` boundary. Feedback entries belong to the active view signal and disappear when navigation replaces or disposes that view. Dialog moves focus inside, traps Tab while modal, supports declared close, button, Escape, and backdrop paths, and restores the invoking element.

## Media

ImageGallery uses stable item ids for controlled selection and contains a failed image to its own tile. ZoomableImage keeps scale in document state and emits values clamped to its declared minimum and maximum. Both expose load and error events with visible fallback text.

AudioPlayer and VideoPlayer use native media elements and publish visible loading, ready, playing, paused, ended, error, and unsupported states. A declared MIME type is checked before requesting an unsupported resource. Playback events preserve null, time, and structured error payloads. When a view is replaced, each player pauses active playback, detaches its source, and reloads non-empty native resource state so Electron can release the resource.

Each active screen has an abort signal and LIFO resource disposers. `push` deactivates the current screen but retains its typed screen/component state for `back`; returning creates a new activation scope. `replace` disposes and removes the current frame. `reset` disposes the whole stack before creating the target. All modes validate parameters first. Async adapters receive the signal, and results check that the originating scope is still active before a success branch or state write, so late completion cannot mutate a replacement view.

## Diagnostics

`validateRuntime(input, catalog)` and `validatePackage(input, sdkVersion)` return a success/data result or `{success:false, diagnostics}`. A diagnostic includes `path` (JSON Pointer), `code`, and `message`. `unwrap` throws `LanguageError` containing the same diagnostics. Example: `/screens/home/body/props/text: Expected string`.

Unknown widgets are rejected; there is no fallback renderer. The release catalog must only advertise widgets with implemented behavior. The foundation catalog currently contains the working layout, content, form, selection, desktop-interaction, collection, feedback, and media families; it is not the completed release catalog.
