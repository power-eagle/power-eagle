# Widget catalog

Power Eagle publishes the built-in catalog as [catalog/builtins.json](catalog/builtins.json). Regenerate it from the same contracts used by validation and rendering:

```sh
npm run language -- catalog
```

Each entry contains its public type spelling, family, origin, effective availability, property schema, defaults, slots, events, theme hooks, authoring example, and a runnable example. The runnable form supplies required structural parents for Positioned, Expanded, Flexible, and Spacer. The application gallery renders that runnable example through the same runtime registry used by packages.

All built-in constructors are re-exported from `src/sdui/authoring/foundation`; focused modules are available at `authoring/layout`, `authoring/content`, `authoring/forms`, `authoring/selection`, `authoring/desktop`, `authoring/collections`, `authoring/feedback`, and `authoring/media`. Each constructor derives its TypeScript property, slot, and event names from the published contract and emits an ordinary runtime node.

The current built-in groups are:

- Layout: Align, AspectRatio, Center, Column, ConstrainedBox, Expanded, Flexible, Padding, Positioned, Row, SizedBox, Spacer, Stack, Wrap.
- Content: Badge, Card, CodeBlock, Divider, Icon, Image, Markdown, RichText, SelectableText, Text, Tooltip.
- Form and selection controls: Autocomplete, Checkbox, ColorPicker, DatePicker, FilePicker, Form, NumberField, RadioGroup, Select, Slider, Switch, TextArea, TextField.
- Desktop interaction: Accordion, Breadcrumbs, Button, ContextMenu, IconButton, Menu, SegmentedControl, SplitPane, Tabs.
- Collections: DataTable, GridView, ListView, PropertyGrid, ReorderableList, ScrollView, TreeView, VirtualGrid, VirtualList.
- Feedback: Banner, Dialog, EmptyState, ErrorState, ProgressIndicator, Skeleton, Toast.
- Media: AudioPlayer, ImageGallery, VideoPlayer, ZoomableImage.

The installable [`examples/control-widgets`](../examples/control-widgets) runtime references every form, selection, and desktop-interaction type. Its behavior test compiles the TypeScript source to canonical JSON, validates every referenced public contract, renders each implementation, and completes required form submission plus breadcrumb navigation with keyboard input only.

The installable [`examples/collection-feedback-media`](../examples/collection-feedback-media) runtime references every collection, feedback, and media type. Its acceptance test compiles and validates the package, renders all twenty implementations through `RuntimeSession`, changes keyed collection and gallery selection, opens and closes stage-scoped feedback, and updates controlled zoom state.

`origin.kind` is `builtin` for host types and `package` for installed contributions. Package origins also name the owning package, version, and export. `availability` is `active`, `off`, or `failed`; failed entries can carry a raw diagnostic. Catalog discovery must show disabled and failed installed contracts without registering a placeholder renderer as working behavior.

Content rendering follows the [language content safety policy](language.md#content-safety-policy). Layout sizing and parent restrictions are part of each JSON contract and are enforced by semantic validation.

Use [widget-template.md](widget-template.md) when documenting a compiled custom widget. A custom type is ready to advertise only when its schema, implementation, example, behavior tests, accessibility notes, theme hooks, and failure behavior describe the same public contract.
