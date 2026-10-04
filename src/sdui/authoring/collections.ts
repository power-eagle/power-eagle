import type { DataSchema, WidgetContract } from '../schema/model';
import { defineWidget } from './index';

const boolean = { type: 'boolean' } satisfies DataSchema;
const nonnegative = { type: 'number', minimum: 0 } satisfies DataSchema;
const positive = { type: 'number', minimum: Number.MIN_VALUE } satisfies DataSchema;
const positiveInteger = { type: 'number', minimum: 1, integer: true } satisfies DataSchema;
const stringArray = { type: 'array', items: { type: 'string', minLength: 1 } } satisfies DataSchema;
const selectionMode = { type: 'enum', values: ['none', 'single', 'multiple'] } satisfies DataSchema;
const scrollEvent = {
  type: 'object', properties: { x: nonnegative, y: nonnegative }, required: ['x', 'y'] as ['x', 'y'],
} satisfies DataSchema;
const collectionSlots = {
  children: { cardinality: 'many' as const, required: true },
  empty: { cardinality: 'one' as const, required: false },
};
const collectionProperties = {
  label: { type: 'string', minLength: 1 }, selection: stringArray, selectionMode,
  disabled: boolean, gap: nonnegative, height: positive,
} satisfies Record<string, DataSchema>;
const collectionDefaults = { selection: [], selectionMode: 'none', disabled: false, gap: 8 };
const collectionEvents = {
  selectionChange: stringArray, activate: { type: 'string', minLength: 1 }, scroll: scrollEvent,
} satisfies Record<string, DataSchema>;

export const ScrollView = defineWidget('ScrollView', {
  properties: {
    type: 'object', properties: {
      direction: { type: 'enum', values: ['vertical', 'horizontal', 'both'] },
      height: positive, width: positive,
    }, required: [],
  },
  defaults: { direction: 'vertical' }, slots: { children: { cardinality: 'many', required: true } },
  events: { scroll: scrollEvent }, themeHooks: ['layout', 'scroll'],
  example: { type: 'ScrollView', props: { direction: 'vertical', height: 88 }, slots: { children: [
    { type: 'Text', props: { text: 'Scrollable content' } }, { type: 'Text', props: { text: 'More content' } },
  ] } },
});

export const ListView = defineWidget('ListView', {
  properties: { type: 'object', properties: collectionProperties, required: ['label'] },
  defaults: collectionDefaults, slots: collectionSlots, events: collectionEvents, themeHooks: ['collection', 'list'],
  example: { type: 'ListView', props: { label: 'Packages', selectionMode: 'single', selection: ['stable'] }, slots: {
    children: [{ type: 'Text', key: 'stable', props: { text: 'Stable keyed item' } }],
    empty: { type: 'Text', props: { text: 'No packages' } },
  } },
});

export const GridView = defineWidget('GridView', {
  properties: {
    type: 'object', properties: { ...collectionProperties, columns: positiveInteger, minimumItemWidth: positive }, required: ['label'],
  },
  defaults: { ...collectionDefaults, columns: 3 }, slots: collectionSlots, events: collectionEvents, themeHooks: ['collection', 'grid'],
  example: { type: 'GridView', props: { label: 'Widgets', columns: 2, selectionMode: 'single', selection: [] }, slots: {
    children: [
      { type: 'Text', key: 'one', props: { text: 'One' } }, { type: 'Text', key: 'two', props: { text: 'Two' } },
    ], empty: { type: 'Text', props: { text: 'No widgets' } },
  } },
});

export const VirtualList = defineWidget('VirtualList', {
  properties: {
    type: 'object', properties: { ...collectionProperties, itemExtent: positive, overscan: nonnegative },
    required: ['label', 'height', 'itemExtent'],
  },
  defaults: { ...collectionDefaults, overscan: 2 }, slots: collectionSlots, events: collectionEvents,
  themeHooks: ['collection', 'list', 'virtual'],
  example: { type: 'VirtualList', props: { label: 'Large package list', height: 88, itemExtent: 32, selectionMode: 'single', selection: [] }, slots: {
    children: [
      { type: 'Text', key: 'one', props: { text: 'Virtual item one' } },
      { type: 'Text', key: 'two', props: { text: 'Virtual item two' } },
      { type: 'Text', key: 'three', props: { text: 'Virtual item three' } },
    ], empty: { type: 'Text', props: { text: 'No items' } },
  } },
});

export const VirtualGrid = defineWidget('VirtualGrid', {
  properties: {
    type: 'object', properties: {
      ...collectionProperties, columns: positiveInteger, rowExtent: positive, overscan: nonnegative,
    }, required: ['label', 'height', 'columns', 'rowExtent'],
  },
  defaults: { ...collectionDefaults, overscan: 1 }, slots: collectionSlots, events: collectionEvents,
  themeHooks: ['collection', 'grid', 'virtual'],
  example: { type: 'VirtualGrid', props: { label: 'Large widget grid', height: 88, columns: 2, rowExtent: 32, selectionMode: 'multiple', selection: [] }, slots: {
    children: [
      { type: 'Text', key: 'one', props: { text: 'One' } }, { type: 'Text', key: 'two', props: { text: 'Two' } },
      { type: 'Text', key: 'three', props: { text: 'Three' } }, { type: 'Text', key: 'four', props: { text: 'Four' } },
    ], empty: { type: 'Text', props: { text: 'No items' } },
  } },
});

export const ReorderableList = defineWidget('ReorderableList', {
  properties: { type: 'object', properties: collectionProperties, required: ['label'] },
  defaults: collectionDefaults, slots: collectionSlots,
  events: { ...collectionEvents, reorder: stringArray }, themeHooks: ['collection', 'list', 'reorder'],
  example: { type: 'ReorderableList', props: { label: 'Priority order', selectionMode: 'single', selection: [] }, slots: {
    children: [
      { type: 'Text', key: 'first', props: { text: 'First task' } },
      { type: 'Text', key: 'second', props: { text: 'Second task' } },
    ], empty: { type: 'Text', props: { text: 'No tasks' } },
  } },
});

const treeItem = {
  type: 'object', properties: {
    id: { type: 'string', minLength: 1 }, label: { type: 'string', minLength: 1 },
    parentId: { type: 'string', minLength: 1 }, disabled: boolean,
  }, required: ['id', 'label'] as ['id', 'label'],
} satisfies DataSchema;

export const TreeView = defineWidget('TreeView', {
  properties: { type: 'object', properties: {
    label: { type: 'string', minLength: 1 }, items: { type: 'array', items: treeItem },
    selection: stringArray, expanded: stringArray, selectionMode, disabled: boolean, height: positive,
  }, required: ['label', 'items'] },
  defaults: { selection: [], expanded: [], selectionMode: 'single', disabled: false }, slots: {
    empty: { cardinality: 'one', required: false },
  }, events: {
    selectionChange: stringArray, expandedChange: stringArray, activate: { type: 'string', minLength: 1 },
  }, themeHooks: ['collection', 'tree'],
  example: { type: 'TreeView', props: { label: 'Package tree', selection: ['runtime'], expanded: ['root'], items: [
    { id: 'root', label: 'Package' }, { id: 'runtime', label: 'Runtime', parentId: 'root' },
    { id: 'styling', label: 'Styling', parentId: 'root' },
  ] } },
});

const tableColumn = {
  type: 'object', properties: {
    key: { type: 'string', minLength: 1 }, label: { type: 'string', minLength: 1 },
    type: { type: 'enum', values: ['string', 'number', 'boolean', 'date'] },
    sortable: boolean, align: { type: 'enum', values: ['start', 'center', 'end'] },
  }, required: ['key', 'label', 'type'] as ['key', 'label', 'type'],
} satisfies DataSchema;
const sortEvent = {
  type: 'object', properties: {
    column: { type: 'string', minLength: 1 }, direction: { type: 'enum', values: ['ascending', 'descending'] },
  }, required: ['column', 'direction'] as ['column', 'direction'],
} satisfies DataSchema;

export const DataTable = defineWidget('DataTable', {
  properties: { type: 'object', properties: {
    label: { type: 'string', minLength: 1 }, rows: { type: 'array', items: { type: 'json' } },
    columns: { type: 'array', items: tableColumn }, rowKey: { type: 'string', minLength: 1 },
    selection: stringArray, selectionMode, sortColumn: { type: 'string' },
    sortDirection: { type: 'enum', values: ['ascending', 'descending'] }, disabled: boolean, height: positive,
  }, required: ['label', 'rows', 'columns'] },
  defaults: {
    rowKey: 'id', selection: [], selectionMode: 'none', sortColumn: '', sortDirection: 'ascending', disabled: false,
  }, slots: { empty: { cardinality: 'one', required: false } },
  events: { selectionChange: stringArray, sortChange: sortEvent, activate: { type: 'string', minLength: 1 } },
  themeHooks: ['collection', 'table'],
  example: { type: 'DataTable', props: {
    label: 'Packages', rows: [{ id: 'core', name: 'Core', active: true }, { id: 'tools', name: 'Tools', active: false }],
    columns: [
      { key: 'name', label: 'Name', type: 'string', sortable: true },
      { key: 'active', label: 'Active', type: 'boolean' },
    ], selectionMode: 'single', selection: ['core'], sortColumn: 'name', sortDirection: 'ascending',
  } },
});

const propertyOption = {
  type: 'object', properties: { value: { type: 'string' }, label: { type: 'string', minLength: 1 } },
  required: ['value', 'label'] as ['value', 'label'],
} satisfies DataSchema;
const propertyItem = {
  type: 'object', properties: {
    id: { type: 'string', minLength: 1 }, label: { type: 'string', minLength: 1 }, value: { type: 'json' },
    editor: { type: 'enum', values: ['text', 'number', 'boolean', 'select', 'date', 'color'] },
    editable: boolean, options: { type: 'array', items: propertyOption }, description: { type: 'string' },
  }, required: ['id', 'label', 'value'] as ['id', 'label', 'value'],
} satisfies DataSchema;
const propertyChange = {
  type: 'object', properties: { id: { type: 'string', minLength: 1 }, value: { type: 'json' } },
  required: ['id', 'value'] as ['id', 'value'],
} satisfies DataSchema;

export const PropertyGrid = defineWidget('PropertyGrid', {
  properties: { type: 'object', properties: {
    label: { type: 'string', minLength: 1 }, items: { type: 'array', items: propertyItem },
    disabled: boolean, columns: { type: 'enum', values: [1, 2] },
  }, required: ['label', 'items'] },
  defaults: { disabled: false, columns: 1 }, slots: { empty: { cardinality: 'one', required: false } },
  events: { change: propertyChange }, themeHooks: ['collection', 'propertyGrid', 'field'],
  example: { type: 'PropertyGrid', props: { label: 'Package properties', items: [
    { id: 'name', label: 'Name', value: 'Power Eagle', editor: 'text', editable: true },
    { id: 'active', label: 'Active', value: true, editor: 'boolean', editable: true },
    { id: 'version', label: 'Version', value: '1.0.0' },
  ] } },
});

export const collectionWidgets = {
  ScrollView, ListView, GridView, VirtualList, VirtualGrid, ReorderableList, TreeView, DataTable, PropertyGrid,
} as const;
export const collectionContracts: Record<string, WidgetContract> = Object.fromEntries(
  Object.entries(collectionWidgets).map(([type, widget]) => [type, widget.contract]),
);
