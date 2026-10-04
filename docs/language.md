# Power Eagle language v1

Status: structural/semantic validation, typed authoring, canonical emission, scoped state, expression evaluation, keyed rendering, action dispatch, and view-local navigation are implemented. The release widget catalog, compiled-provider activation, workbench, and AI integration remain later checkpoints.

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

The root app runs `examples/runtime-flow`: increment/reset actions, typed bindings, keyed repeated content, and detail/back navigation. It does not load compiled providers while the Eagle host experiment is blocked.

```sh
npm run language -- example
npm run language -- validate examples/runtime-only/run.json
npm run language -- validate examples/runtime-only/manifest.json
npm run language -- validate examples/runtime-flow/run.json
npm run language -- validate examples/runtime-flow/manifest.json
npm run language -- schemas
npm run language:types
```

`examples/runtime-only/document.ts` demonstrates reusable inputs and slots. `examples/runtime-flow/document.ts` demonstrates state, expressions, keyed repetition, sequential/parallel actions, and navigation. The example command validates both and atomically replaces their `run.json` files. Invalid input never overwrites a previous valid file. Declaration files in `.artifacts/sdk-types` derive from the same TypeScript/Zod contracts used by validation. Structural JSON schemas live in `docs/schemas`; use the TypeScript validator as well for cross-reference, type availability, version, parent, and slot checks. The CLI currently validates against the foundation catalog; installed descriptors will enter through the later activation implementation.

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

Contracts use a closed descriptor vocabulary: `string` (optional `minLength`), `number` (optional `minimum`, `maximum`, `integer`), `boolean`, `null`, `json`, `enum` (`values`), `array` (`items`), and `object` (`properties`, `required`). Object values reject unknown properties; declared required keys must exist in the schema. Numbers are finite and are never coerced from strings.

Bindings are data:

```json
{ "$ref": { "scope": "input", "path": ["title"] } }
```

Scopes are `state`, `input`, `params`, `item`, `event`, `result`, `error`, and `action`. Paths are arrays of property names or nonnegative array indexes. Static references are checked against their declarations; event/result/error/item availability is checked by context. `action.<name>` exposes `{status,result,error}` for a named action, with status `idle`, `loading`, `success`, `error`, or `cancelled`. Reads return data copies. State writes target the nearest declaration, validate the complete updated value, preserve number/boolean/object types, and notify the renderer only after a valid write.

Package assets use `{ "$asset": "assets/icon.svg" }`. Paths are package-relative, use forward slashes, and forbid traversal, absolute paths, and URL syntax. Filesystem existence and canonical/symlink containment checks belong to package loading; a structural schema cannot establish them.

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

Import from `src/sdui/authoring`. `defineWidget` derives constructor property types from a widget contract; `defineComponent` derives instance inputs from its schema. `defineDocument` checks the document shape, and `compile(document, catalog)` performs validation and returns deterministic sorted-key JSON. `ref<T>` and `expression<T>` construct typed values; the schema validator still checks declared targets. `forEach`, `set`, `sequence`, `parallel`, `navigate`, `back`, `run`, `call`, and `asset` construct serializable nodes/actions. All other action variants can be authored as the exported `Action` union.

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

Every action may declare `success` and `error` branches. A success branch binds the action result; an error branch binds `{name,message}` plus validation diagnostics when available. Sequences expose each successful result to the next step and stop on unhandled failure. Parallel branches receive the same incoming result, cannot see sibling results, and return results in declaration order. Registered calls validate input before invocation and output afterward. Requests, forms, and feedback go only through injected adapters; missing adapters fail explicitly.

Each active screen has an abort signal and LIFO resource disposers. `push` deactivates the current screen but retains its typed screen/component state for `back`; returning creates a new activation scope. `replace` disposes and removes the current frame. `reset` disposes the whole stack before creating the target. All modes validate parameters first. Async adapters receive the signal, and results check that the originating scope is still active before a success branch or state write, so late completion cannot mutate a replacement view.

## Diagnostics

`validateRuntime(input, catalog)` and `validatePackage(input, sdkVersion)` return a success/data result or `{success:false, diagnostics}`. A diagnostic includes `path` (JSON Pointer), `code`, and `message`. `unwrap` throws `LanguageError` containing the same diagnostics. Example: `/screens/home/body/props/text: Expected string`.

Unknown widgets are rejected; there is no fallback renderer. The release catalog must only advertise widgets with implemented behavior. The foundation catalog currently contains working Text, Column, and Button implementations for the language examples; it is not the completed release catalog.
