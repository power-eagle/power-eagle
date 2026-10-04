import { defineWidget } from './index';
import type { ValidationCatalog } from '../schema/validate';
import { layoutContracts } from './layout';

export * from './layout';

// First working preview types; the release catalog will grow at widget checkpoints.
export const Text = defineWidget('Text', {
  properties: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  defaults: {}, slots: {}, events: {}, themeHooks: ['text'], example: { type: 'Text', props: { text: 'Hello Eagle' } },
});
export const Button = defineWidget('Button', {
  properties: { type: 'object', properties: { label: { type: 'string' }, disabled: { type: 'boolean' } }, required: ['label'] },
  defaults: { disabled: false }, slots: {}, events: { press: { type: 'null' } }, themeHooks: ['control', 'primary'],
  example: { type: 'Button', props: { label: 'Continue' } },
});
export const foundationCatalog: ValidationCatalog = { widgets: { ...layoutContracts, Text: Text.contract, Button: Button.contract } };
