# Widget catalog

Power Eagle publishes the built-in catalog as [catalog/builtins.json](catalog/builtins.json). Regenerate it from the same contracts used by validation and rendering:

```sh
npm run language -- catalog
```

Each entry contains its public type spelling, family, origin, effective availability, property schema, defaults, slots, events, theme hooks, authoring example, and a runnable example. The runnable form supplies required structural parents for Positioned, Expanded, Flexible, and Spacer. The application gallery renders that runnable example through the same runtime registry used by packages.

The current built-in groups are:

- Layout: Align, AspectRatio, Center, Column, ConstrainedBox, Expanded, Flexible, Padding, Positioned, Row, SizedBox, Spacer, Stack, Wrap.
- Content: Badge, Card, CodeBlock, Divider, Icon, Image, Markdown, RichText, SelectableText, Text, Tooltip.
- Form and selection controls: Autocomplete, Checkbox, ColorPicker, DatePicker, FilePicker, Form, NumberField, RadioGroup, Select, Slider, Switch, TextArea, TextField.
- Desktop interaction: Accordion, Breadcrumbs, Button, ContextMenu, IconButton, Menu, SegmentedControl, SplitPane, Tabs.

`origin.kind` is `builtin` for host types and `package` for installed contributions. Package origins also name the owning package, version, and export. `availability` is `active`, `off`, or `failed`; failed entries can carry a raw diagnostic. Catalog discovery must show disabled and failed installed contracts without registering a placeholder renderer as working behavior.

Content rendering follows the [language content safety policy](language.md#content-safety-policy). Layout sizing and parent restrictions are part of each JSON contract and are enforced by semantic validation.

Use [widget-template.md](widget-template.md) when documenting a compiled custom widget. A custom type is ready to advertise only when its schema, implementation, example, behavior tests, accessibility notes, theme hooks, and failure behavior describe the same public contract.
