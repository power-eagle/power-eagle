import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const catalog = JSON.parse(await readFile('docs/catalog/builtins.json', 'utf8'));
const groups = [
  ['Align AspectRatio Center Column ConstrainedBox Expanded Flexible Padding Positioned Row SizedBox Spacer Stack Wrap', ['layout'], 'layout sizing, parent restrictions and example rendering'],
  ['Badge Card CodeBlock Divider Icon Image Markdown RichText SelectableText Text Tooltip', ['content'], 'safe content, image failure, tooltip focus, theme precedence; passive wrappers have rendered-example coverage'],
  ['Checkbox Form NumberField RadioGroup Switch TextArea TextField', ['forms', 'control-example'], 'typed validation, submission/reset and keyboard example'],
  ['Autocomplete ColorPicker DatePicker FilePicker Select Slider', ['selection', 'control-example'], 'typed values, bounds, keyboard selection, read-only, cancellation and missing-host handling'],
  ['Accordion Breadcrumbs Button ContextMenu IconButton Menu SegmentedControl SplitPane Tabs', ['desktop', 'control-example'], 'activation/selection, focus, menu/tab keys, navigation and bounded split resizing'],
  ['GridView ListView ScrollView VirtualGrid VirtualList', ['collections', 'collection-feedback-media-example'], 'stable keys, empty content, scroll/selection and bounded virtualization'],
  ['DataTable PropertyGrid ReorderableList TreeView', ['advanced-collections', 'collection-feedback-media-example'], 'typed sorting/editing, keyboard reorder/tree selection and identity retention'],
  ['Banner Dialog EmptyState ErrorState ProgressIndicator Skeleton Toast', ['feedback', 'collection-feedback-media-example'], 'textual status, retry, stage-local overlay focus and lifecycle'],
  ['AudioPlayer ImageGallery VideoPlayer ZoomableImage', ['media', 'collection-feedback-media-example'], 'keyed selection, zoom bounds, media failures and resource disposal'],
  ['AssetCard AssetGrid AssetPicker', ['eagle'], 'typed host results, keyed selection, loading/empty/error and retry'],
  ['FolderTree ImportQueue LibraryPicker MetadataEditor TagPicker', ['eagle-operations'], 'typed host data, metadata/import outcomes, cancellation and late-result isolation'],
];
const evidence = new Map();
for (const [types, suites, scope] of groups) for (const type of types.split(' ')) {
  assert.ok(!evidence.has(type), `Duplicate audit entry ${type}`);
  evidence.set(type, { suites: suites.map(name => `src/sdui/runtime/${name}.test.tsx`), scope });
}
assert.equal(catalog.entries.length, evidence.size, 'Catalog and audit vocabulary differ');
const docs = ['docs/widget-catalog.md', 'docs/language.md'];
const docText = (await Promise.all(docs.map(path => readFile(path, 'utf8')))).join('\n');
const records = [];
for (const entry of catalog.entries) {
  const coverage = evidence.get(entry.type); assert.ok(coverage, `Unmapped widget ${entry.type}`);
  for (const field of ['properties', 'defaults', 'slots', 'events', 'themeHooks', 'example']) assert.ok(field in entry.contract, `${entry.type}: missing ${field}`);
  assert.ok(entry.runnableExample, `${entry.type}: no runnable example`);
  assert.ok(docText.includes(entry.type), `${entry.type}: not documented`);
  const suites = ['src/sdui/catalog/catalog.test.tsx', ...coverage.suites];
  const references = [];
  for (const path of suites) references.push({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
  records.push({ type: entry.type, family: entry.family, contract: 'docs/catalog/builtins.json', runnableExample: true,
    documentation: docs, coverage: coverage.scope, tests: references });
}
await mkdir(resolve('.artifacts/releases'), { recursive: true });
const report = { widgets: records.length, scope: 'Evidence mapping and contract/documentation inventory. Execute the referenced suites; this inventory alone does not prove interactive or real-host behavior.', records };
await writeFile(resolve('.artifacts/releases/widget-audit.json'), JSON.stringify(report, null, 2));
console.log(`Mapped ${report.widgets} widgets to contracts, examples, documentation and focused behavior suites.`);
