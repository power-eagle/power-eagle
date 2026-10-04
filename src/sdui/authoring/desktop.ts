import type { DataSchema, WidgetContract } from '../schema/model';
import { iconNames } from './content';
import { defineWidget } from './index';

const text = { type: 'string' } satisfies DataSchema;
const boolean = { type: 'boolean' } satisfies DataSchema;
const percentage = { type: 'number', minimum: 0, maximum: 100 } satisfies DataSchema;
const positivePercentage = { type: 'number', minimum: Number.MIN_VALUE, maximum: 100 } satisfies DataSchema;
const icon = { type: 'enum', values: [...iconNames] } satisfies DataSchema;
const variant = { type: 'enum', values: ['default', 'secondary', 'outline', 'ghost', 'destructive'] } satisfies DataSchema;
const controlOption = {
  type: 'object',
  properties: { value: { type: 'string', minLength: 1 }, label: { type: 'string', minLength: 1 }, disabled: boolean },
  required: ['value', 'label'] as ['value', 'label'],
} satisfies DataSchema;
const controlOptions = { type: 'array', items: controlOption } satisfies DataSchema;

export const Button = defineWidget('Button', {
  properties: {
    type: 'object', properties: {
      label: { type: 'string', minLength: 1 }, variant,
      size: { type: 'enum', values: ['small', 'default', 'large'] },
      buttonType: { type: 'enum', values: ['button', 'submit', 'reset'] },
      disabled: boolean, busy: boolean, autofocus: boolean, tooltip: text,
    }, required: ['label'],
  },
  defaults: { variant: 'default', size: 'default', buttonType: 'button', disabled: false, busy: false, autofocus: false },
  slots: {}, events: { press: { type: 'null' }, focus: { type: 'boolean' } }, themeHooks: ['control', 'button'],
  example: { type: 'Button', props: { label: 'Continue', variant: 'default' } },
});

export const IconButton = defineWidget('IconButton', {
  properties: {
    type: 'object', properties: {
      icon, selectedIcon: icon, label: { type: 'string', minLength: 1 }, tooltip: text, selected: boolean,
      variant, size: { type: 'enum', values: ['small', 'default', 'large'] }, disabled: boolean, autofocus: boolean,
    }, required: ['icon', 'label'],
  },
  defaults: { selected: false, variant: 'ghost', size: 'default', disabled: false, autofocus: false },
  slots: {}, events: { press: { type: 'null' }, focus: { type: 'boolean' } }, themeHooks: ['control', 'button', 'icon'],
  example: { type: 'IconButton', props: { icon: 'plus', label: 'Add item', variant: 'outline' } },
});

const selectionProperties = {
  label: { type: 'string', minLength: 1 }, value: text, options: controlOptions, disabled: boolean,
} satisfies Record<string, DataSchema>;

export const SegmentedControl = defineWidget('SegmentedControl', {
  properties: { type: 'object', properties: selectionProperties, required: ['label', 'value', 'options'] },
  defaults: { disabled: false }, slots: {}, events: { change: { type: 'string' } }, themeHooks: ['control', 'segmented'],
  example: { type: 'SegmentedControl', props: { label: 'Density', value: 'compact', options: [
    { value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' },
  ] } },
});

export const Tabs = defineWidget('Tabs', {
  properties: {
    type: 'object', properties: {
      label: { type: 'string', minLength: 1 }, value: text, tabs: controlOptions,
      disabled: boolean,
    }, required: ['label', 'value', 'tabs'],
  },
  defaults: { disabled: false }, slots: { children: { cardinality: 'many', required: true } },
  events: { change: { type: 'string' } }, themeHooks: ['control', 'tabs'],
  example: { type: 'Tabs', props: { label: 'Package view', value: 'preview', tabs: [
    { value: 'preview', label: 'Preview' }, { value: 'activation', label: 'Activation' },
  ] }, slots: { children: [
    { type: 'Text', props: { text: 'Preview content' } }, { type: 'Text', props: { text: 'Activation content' } },
  ] } },
});

const accordionItem = {
  type: 'object',
  properties: { id: { type: 'string', minLength: 1 }, label: { type: 'string', minLength: 1 }, disabled: boolean },
  required: ['id', 'label'] as ['id', 'label'],
} satisfies DataSchema;
const stringArray = { type: 'array', items: { type: 'string', minLength: 1 } } satisfies DataSchema;

export const Accordion = defineWidget('Accordion', {
  properties: {
    type: 'object', properties: {
      label: { type: 'string', minLength: 1 }, value: stringArray,
      items: { type: 'array', items: accordionItem }, multiple: boolean, disabled: boolean,
    }, required: ['label', 'value', 'items'],
  },
  defaults: { multiple: false, disabled: false }, slots: { children: { cardinality: 'many', required: true } },
  events: { change: stringArray }, themeHooks: ['control', 'accordion'],
  example: { type: 'Accordion', props: { label: 'Package details', value: ['details'], items: [
    { id: 'details', label: 'Details' }, { id: 'dependencies', label: 'Dependencies' },
  ] }, slots: { children: [
    { type: 'Text', props: { text: 'Package metadata' } }, { type: 'Text', props: { text: 'No dependencies' } },
  ] } },
});

const menuItem = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 }, label: { type: 'string', minLength: 1 },
    shortcut: text, disabled: boolean, destructive: boolean, separatorBefore: boolean,
  },
  required: ['id', 'label'] as ['id', 'label'],
} satisfies DataSchema;
const menuItems = { type: 'array', items: menuItem } satisfies DataSchema;

export const Menu = defineWidget('Menu', {
  properties: {
    type: 'object', properties: {
      label: { type: 'string', minLength: 1 }, items: menuItems, disabled: boolean,
      placement: { type: 'enum', values: ['bottomStart', 'bottomEnd', 'topStart', 'topEnd'] },
    }, required: ['label', 'items'],
  },
  defaults: { disabled: false, placement: 'bottomStart' }, slots: {},
  events: { select: { type: 'string' }, open: { type: 'null' }, close: { type: 'null' } }, themeHooks: ['control', 'menu'],
  example: { type: 'Menu', props: { label: 'Package actions', items: [
    { id: 'open', label: 'Open' }, { id: 'remove', label: 'Remove', destructive: true, separatorBefore: true },
  ] } },
});

export const ContextMenu = defineWidget('ContextMenu', {
  properties: {
    type: 'object', properties: { label: { type: 'string', minLength: 1 }, items: menuItems, disabled: boolean },
    required: ['label', 'items'],
  },
  defaults: { disabled: false }, slots: { child: { cardinality: 'one', required: true } },
  events: { select: { type: 'string' }, open: { type: 'null' }, close: { type: 'null' } }, themeHooks: ['control', 'contextMenu'],
  example: { type: 'ContextMenu', props: { label: 'Package context actions', items: [
    { id: 'inspect', label: 'Inspect' }, { id: 'disable', label: 'Disable' },
  ] }, slots: { child: { type: 'Text', props: { text: 'Right-click or press Shift+F10' } } } },
});

const breadcrumbItem = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 }, label: { type: 'string', minLength: 1 }, current: boolean, disabled: boolean,
  },
  required: ['id', 'label'] as ['id', 'label'],
} satisfies DataSchema;

export const Breadcrumbs = defineWidget('Breadcrumbs', {
  properties: {
    type: 'object', properties: {
      label: { type: 'string', minLength: 1 }, items: { type: 'array', items: breadcrumbItem }, disabled: boolean,
    }, required: ['label', 'items'],
  },
  defaults: { disabled: false }, slots: {}, events: { select: { type: 'string' } }, themeHooks: ['control', 'breadcrumbs'],
  example: { type: 'Breadcrumbs', props: { label: 'Package location', items: [
    { id: 'sources', label: 'Sources' }, { id: 'package', label: 'Package', current: true },
  ] } },
});

export const SplitPane = defineWidget('SplitPane', {
  properties: {
    type: 'object', properties: {
      label: { type: 'string', minLength: 1 }, direction: { type: 'enum', values: ['horizontal', 'vertical'] },
      value: percentage, minimumStart: percentage, minimumEnd: percentage, step: positivePercentage, disabled: boolean,
    }, required: ['label', 'value'],
  },
  defaults: { direction: 'horizontal', minimumStart: 20, minimumEnd: 20, step: 5, disabled: false },
  slots: { start: { cardinality: 'one', required: true }, end: { cardinality: 'one', required: true } },
  events: { resizeStart: { type: 'number' }, resize: { type: 'number' }, resizeEnd: { type: 'number' } },
  themeHooks: ['layout', 'splitPane'],
  example: { type: 'SplitPane', props: { label: 'Inspector split', value: 45, minimumStart: 25, minimumEnd: 25 }, slots: {
    start: { type: 'Text', props: { text: 'Stage' } }, end: { type: 'Text', props: { text: 'Inspector' } },
  } },
});

export const desktopWidgets = { Button, IconButton, SegmentedControl, Tabs, Accordion, Menu, ContextMenu, Breadcrumbs, SplitPane } as const;
export const desktopContracts: Record<string, WidgetContract> = Object.fromEntries(
  Object.entries(desktopWidgets).map(([type, widget]) => [type, widget.contract]),
);
