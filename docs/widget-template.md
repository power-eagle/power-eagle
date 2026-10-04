# Custom widget: `<package-id>/<export-id>`

Use this template beside a compiled widget provider. Replace every bracketed value and remove instructions that do not apply.

## Identity and ownership

- Public type: `<package-id>/<export-id>`
- Package/version: `<package-id>` / `<semver>`
- Provider entry: `<relative/path/to/types.cjs>`
- Purpose: `<one sentence describing visible behavior>`

## Contract

Paste the exact manifest widget contract. It must match the contract returned by the compiled provider.

```json
{
  "properties": {
    "type": "object",
    "properties": {},
    "required": []
  },
  "defaults": {},
  "slots": {},
  "events": {},
  "themeHooks": [],
  "example": {
    "type": "<package-id>/<export-id>",
    "props": {}
  }
}
```

## Properties and bindings

Document every property, its data type, default, accepted binding scopes, constraints, and visible effect. State whether strings are rendered as text, parsed by a closed grammar, or used as a resource identifier.

## Slots

Document every slot, whether it accepts one or many nodes, whether it is required, any parent-child restriction, empty behavior, and child identity requirements.

## Events

Document each event name, exact payload schema, activation gesture, ordering, and whether it can fire after the view is disposed. Events execute declarative actions; the widget must not accept callbacks in runtime JSON.

## Theme hooks

List each supported hook, token, and variant. State which internal element receives the composed style and how an explicit node style participates in precedence.

## Runnable example

Provide canonical runtime JSON that declares the package dependency and renders the widget under every required structural parent. The example must use only public exports and package-relative assets.

## Accessibility and input

Record semantic role, accessible name source, focus behavior, keyboard interactions, pointer interactions, status text, and focus restoration where applicable.

## Loading, failure, and cleanup

Describe loading/empty/error content, recoverable actions, unsupported-host behavior, async cancellation, listeners, handles, and resource cleanup when the view or provider is removed.

## Verification

- Contract validates from manifest discovery and runtime use.
- The runnable example renders the implementation rather than a placeholder.
- Property defaults, slots, events, bindings, and theme hooks have focused behavior coverage.
- Keyboard and accessible-name checks pass for interactive behavior.
- Failure and disposal paths leave the surrounding view usable.
- The package builds self-contained with only declared host-shared modules.
