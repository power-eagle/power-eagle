import type { WidgetContract } from '../schema/model';
import { defineWidget } from './index';

const emptyProperties = { type: 'object' as const, properties: {}, required: [] };
const child = { child: { cardinality: 'one' as const, required: true } };
const optionalChild = { child: { cardinality: 'one' as const, required: false } };
const children = { children: { cardinality: 'many' as const, required: true } };
const mainAxis = { type: 'enum' as const, values: ['start', 'end', 'center', 'spaceBetween', 'spaceAround', 'spaceEvenly'] };
const crossAxis = { type: 'enum' as const, values: ['start', 'end', 'center', 'stretch', 'baseline'] };
const alignment = {
  type: 'enum' as const,
  values: ['topLeft', 'topCenter', 'topRight', 'centerLeft', 'center', 'centerRight', 'bottomLeft', 'bottomCenter', 'bottomRight'],
};
const nonnegative = { type: 'number' as const, minimum: 0 };
const flex = { type: 'number' as const, minimum: 1, integer: true };

export const Row = defineWidget('Row', {
  properties: {
    type: 'object', properties: { gap: nonnegative, mainAxisAlignment: mainAxis, crossAxisAlignment: crossAxis }, required: [],
  },
  defaults: { gap: 0, mainAxisAlignment: 'start', crossAxisAlignment: 'center' }, slots: children, events: {}, themeHooks: ['layout'],
  example: { type: 'Row', slots: { children: [] } },
});

export const Column = defineWidget('Column', {
  properties: {
    type: 'object', properties: { gap: nonnegative, mainAxisAlignment: mainAxis, crossAxisAlignment: crossAxis }, required: [],
  },
  defaults: { gap: 12, mainAxisAlignment: 'start', crossAxisAlignment: 'stretch' }, slots: children, events: {}, themeHooks: ['layout'],
  example: { type: 'Column', slots: { children: [] } },
});

export const Stack = defineWidget('Stack', {
  properties: {
    type: 'object', properties: { alignment, overflow: { type: 'enum', values: ['visible', 'hidden', 'auto'] } }, required: [],
  },
  defaults: { alignment: 'topLeft', overflow: 'hidden' }, slots: children, events: {}, themeHooks: ['layout'],
  example: { type: 'Stack', slots: { children: [] } },
});

export const Positioned = defineWidget('Positioned', {
  properties: {
    type: 'object', properties: {
      left: { type: 'number' }, right: { type: 'number' }, top: { type: 'number' }, bottom: { type: 'number' },
      width: nonnegative, height: nonnegative,
    }, required: [],
  },
  defaults: {}, slots: child, events: {}, themeHooks: ['layout'], parents: ['Stack'],
  example: { type: 'Positioned', props: { left: 0, top: 0 }, slots: { child: { type: 'Text', props: { text: 'Positioned' } } } },
});

export const Wrap = defineWidget('Wrap', {
  properties: {
    type: 'object', properties: {
      direction: { type: 'enum', values: ['row', 'column'] }, gap: nonnegative, runGap: nonnegative,
      alignment: mainAxis, crossAxisAlignment: crossAxis,
    }, required: [],
  },
  defaults: { direction: 'row', gap: 8, runGap: 8, alignment: 'start', crossAxisAlignment: 'center' },
  slots: children, events: {}, themeHooks: ['layout'], example: { type: 'Wrap', slots: { children: [] } },
});

export const Padding = defineWidget('Padding', {
  properties: {
    type: 'object', properties: {
      all: nonnegative, horizontal: nonnegative, vertical: nonnegative,
      top: nonnegative, right: nonnegative, bottom: nonnegative, left: nonnegative,
    }, required: [],
  },
  defaults: { all: 0 }, slots: child, events: {}, themeHooks: ['layout'],
  example: { type: 'Padding', props: { all: 12 }, slots: { child: { type: 'Text', props: { text: 'Padded' } } } },
});

export const Align = defineWidget('Align', {
  properties: { type: 'object', properties: { alignment }, required: [] },
  defaults: { alignment: 'center' }, slots: child, events: {}, themeHooks: ['layout'],
  example: { type: 'Align', props: { alignment: 'bottomRight' }, slots: { child: { type: 'Text', props: { text: 'Aligned' } } } },
});

export const Center = defineWidget('Center', {
  properties: emptyProperties, defaults: {}, slots: child, events: {}, themeHooks: ['layout'],
  example: { type: 'Center', slots: { child: { type: 'Text', props: { text: 'Centered' } } } },
});

export const SizedBox = defineWidget('SizedBox', {
  properties: { type: 'object', properties: { width: nonnegative, height: nonnegative }, required: [] },
  defaults: {}, slots: optionalChild, events: {}, themeHooks: ['layout'],
  example: { type: 'SizedBox', props: { width: 120, height: 40 } },
});

export const ConstrainedBox = defineWidget('ConstrainedBox', {
  properties: {
    type: 'object', properties: { minWidth: nonnegative, maxWidth: nonnegative, minHeight: nonnegative, maxHeight: nonnegative }, required: [],
  },
  defaults: {}, slots: child, events: {}, themeHooks: ['layout'],
  example: { type: 'ConstrainedBox', props: { minWidth: 80, maxWidth: 240 }, slots: { child: { type: 'Text', props: { text: 'Constrained' } } } },
});

export const Expanded = defineWidget('Expanded', {
  properties: { type: 'object', properties: { flex }, required: [] }, defaults: { flex: 1 },
  slots: child, events: {}, themeHooks: ['layout'], parents: ['Row', 'Column'],
  example: { type: 'Expanded', slots: { child: { type: 'Text', props: { text: 'Expanded' } } } },
});

export const Flexible = defineWidget('Flexible', {
  properties: { type: 'object', properties: { flex, fit: { type: 'enum', values: ['tight', 'loose'] } }, required: [] },
  defaults: { flex: 1, fit: 'loose' }, slots: child, events: {}, themeHooks: ['layout'], parents: ['Row', 'Column'],
  example: { type: 'Flexible', slots: { child: { type: 'Text', props: { text: 'Flexible' } } } },
});

export const Spacer = defineWidget('Spacer', {
  properties: { type: 'object', properties: { flex }, required: [] }, defaults: { flex: 1 },
  slots: {}, events: {}, themeHooks: ['layout'], parents: ['Row', 'Column'], example: { type: 'Spacer' },
});

export const AspectRatio = defineWidget('AspectRatio', {
  properties: { type: 'object', properties: { aspectRatio: { type: 'number', minimum: 0.01 } }, required: ['aspectRatio'] },
  defaults: {}, slots: child, events: {}, themeHooks: ['layout'],
  example: { type: 'AspectRatio', props: { aspectRatio: 1.7777777778 }, slots: { child: { type: 'Text', props: { text: '16:9' } } } },
});

export const layoutWidgets = {
  Row, Column, Stack, Positioned, Wrap, Padding, Align, Center, SizedBox, ConstrainedBox, Expanded, Flexible, Spacer, AspectRatio,
} as const;

export const layoutContracts: Record<string, WidgetContract> = Object.fromEntries(
  Object.entries(layoutWidgets).map(([type, widget]) => [type, widget.contract]),
);
