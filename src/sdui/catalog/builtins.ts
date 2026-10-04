import { foundationCatalog } from '../authoring/foundation';
import type { Node, RuntimeDocument, WidgetContract } from '../schema/model';
import type { ValidationCatalog } from '../schema/validate';

export type CatalogFamily = 'layout' | 'content' | 'control' | 'custom';
export type CatalogAvailability = 'active' | 'off' | 'failed';
export type CatalogOrigin = { kind: 'builtin' } | { kind: 'package'; package: string; version: string; export: string };
export interface CatalogMetadata {
  family?: CatalogFamily;
  origin: CatalogOrigin;
  availability: CatalogAvailability;
  diagnostic?: string;
}
export interface CatalogEntry extends CatalogMetadata {
  type: string;
  contract: WidgetContract;
  runnableExample: Node;
}
export interface WidgetCatalogDocument {
  format: 'power-eagle/widget-catalog';
  formatVersion: 1;
  entries: CatalogEntry[];
}

const layoutTypes = new Set([
  'Row', 'Column', 'Stack', 'Positioned', 'Wrap', 'Padding', 'Align', 'Center', 'SizedBox', 'ConstrainedBox',
  'Expanded', 'Flexible', 'Spacer', 'AspectRatio',
]);
const contentTypes = new Set([
  'Text', 'RichText', 'SelectableText', 'Markdown', 'CodeBlock', 'Image', 'Icon', 'Badge', 'Divider', 'Card', 'Tooltip',
]);
const controlTypes = new Set([
  'Button', 'Form', 'TextField', 'TextArea', 'NumberField', 'Checkbox', 'RadioGroup', 'Switch',
  'Select', 'Autocomplete', 'Slider', 'DatePicker', 'ColorPicker', 'FilePicker',
  'IconButton', 'SegmentedControl', 'Tabs', 'Accordion', 'Menu', 'ContextMenu', 'Breadcrumbs', 'SplitPane',
]);
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function runnableWidgetExample(type: string, input: Node): Node {
  const example = clone(input);
  if (type === 'Positioned') return { type: 'Stack', props: {}, slots: { children: [example] } };
  if (['Expanded', 'Flexible', 'Spacer'].includes(type)) return { type: 'Row', props: {}, slots: { children: [example] } };
  return example;
}

export function createCatalogEntries(
  catalog: ValidationCatalog,
  metadata: Readonly<Record<string, CatalogMetadata>> = {},
): CatalogEntry[] {
  return Object.entries(catalog.widgets).map(([type, contract]) => {
    const supplied = metadata[type];
    const family = supplied?.family ?? (layoutTypes.has(type) ? 'layout' : contentTypes.has(type) ? 'content' : controlTypes.has(type) ? 'control' : 'custom');
    return {
      type, family,
      origin: supplied?.origin ?? { kind: 'builtin' },
      availability: supplied?.availability ?? 'active',
      ...(supplied?.diagnostic ? { diagnostic: supplied.diagnostic } : {}),
      contract: clone(contract),
      runnableExample: runnableWidgetExample(type, contract.example),
    };
  }).sort((left, right) => left.type < right.type ? -1 : left.type > right.type ? 1 : 0);
}

export const builtinCatalogEntries = createCatalogEntries(foundationCatalog);
export const builtinCatalogDocument: WidgetCatalogDocument = {
  format: 'power-eagle/widget-catalog', formatVersion: 1, entries: builtinCatalogEntries,
};

export function exampleDocument(body: Node): RuntimeDocument {
  return {
    format: 'power-eagle/runtime', formatVersion: 1, start: 'example', dependencies: [], state: {}, components: {}, actions: {},
    screens: { example: { params: { type: 'object', properties: {}, required: [] }, state: {}, body } },
  };
}
