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

export const collectionWidgets = { ScrollView, ListView, GridView, VirtualList, VirtualGrid } as const;
export const collectionContracts: Record<string, WidgetContract> = Object.fromEntries(
  Object.entries(collectionWidgets).map(([type, widget]) => [type, widget.contract]),
);
