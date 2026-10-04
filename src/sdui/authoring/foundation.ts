import { defineWidget } from './index';
import type { ValidationCatalog } from '../schema/validate';
import { contentContracts } from './content';
import { formContracts } from './forms';
import { layoutContracts } from './layout';
import { selectionContracts } from './selection';

export * from './content';
export * from './forms';
export * from './layout';
export * from './selection';

// First working preview types; the release catalog will grow at widget checkpoints.
export const Button = defineWidget('Button', {
  properties: { type: 'object', properties: { label: { type: 'string' }, disabled: { type: 'boolean' } }, required: ['label'] },
  defaults: { disabled: false }, slots: {}, events: { press: { type: 'null' } }, themeHooks: ['control', 'primary'],
  example: { type: 'Button', props: { label: 'Continue' } },
});
export const foundationCatalog: ValidationCatalog = { widgets: { ...layoutContracts, ...contentContracts, ...formContracts, ...selectionContracts, Button: Button.contract } };
