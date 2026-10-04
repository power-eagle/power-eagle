import { defineWidget } from './index';
import type { ValidationCatalog } from '../schema/validate';

// First working preview types; the release catalog will grow at widget checkpoints.
export const Text = defineWidget('Text', {
  properties: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  defaults: {}, slots: {}, events: {}, themeHooks: ['text'], example: { type: 'Text', props: { text: 'Hello Eagle' } },
});
export const Column = defineWidget('Column', {
  properties: { type: 'object', properties: { gap: { type: 'number', minimum: 0 } }, required: [] },
  defaults: { gap: 12 }, slots: { children: { cardinality: 'many', required: true } }, events: {},
  themeHooks: ['layout'], example: { type: 'Column', slots: { children: [] } },
});
export const Button = defineWidget('Button', {
  properties: { type: 'object', properties: { label: { type: 'string' }, disabled: { type: 'boolean' } }, required: ['label'] },
  defaults: { disabled: false }, slots: {}, events: { press: { type: 'null' } }, themeHooks: ['control', 'primary'],
  example: { type: 'Button', props: { label: 'Continue' } },
});
export const foundationCatalog: ValidationCatalog = { widgets: { Text: Text.contract, Column: Column.contract, Button: Button.contract } };
