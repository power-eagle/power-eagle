import type { DataSchema, WidgetContract } from '../schema/model';
import { defineWidget } from './index';

const text = { type: 'string' } satisfies DataSchema;
const nonnegativeInteger = { type: 'number', minimum: 0, integer: true } satisfies DataSchema;
const positiveInteger = { type: 'number', minimum: 1, integer: true } satisfies DataSchema;
const positiveNumber = { type: 'number', minimum: Number.MIN_VALUE } satisfies DataSchema;
const boolean = { type: 'boolean' } satisfies DataSchema;
const fieldDefaults = { disabled: false, required: false };
const common = {
  id: { type: 'string', minLength: 1, pattern: '^[A-Za-z][A-Za-z0-9_.-]*$' },
  label: { type: 'string', minLength: 1 },
  description: text,
  error: text,
  disabled: boolean,
  required: boolean,
  requiredMessage: text,
} satisfies Record<string, DataSchema>;

export const Form = defineWidget('Form', {
  properties: {
    type: 'object',
    properties: {
      id: common.id,
      validationMode: { type: 'enum', values: ['submit', 'change', 'always'] },
    },
    required: ['id'],
  },
  defaults: { validationMode: 'submit' },
  slots: { children: { cardinality: 'many', required: true } },
  events: { submit: { type: 'json' }, invalid: { type: 'json' }, reset: { type: 'json' } },
  themeHooks: ['form'],
  example: {
    type: 'Form', props: { id: 'profile' }, slots: { children: [
      { type: 'TextField', props: { id: 'displayName', label: 'Display name', value: 'Ada', required: true } },
      { type: 'Switch', props: { id: 'updates', label: 'Product updates', value: true } },
    ] },
  },
});

const textFieldProperties = {
  ...common,
  value: text,
  initialValue: text,
  placeholder: text,
  readOnly: boolean,
  minLength: nonnegativeInteger,
  maxLength: nonnegativeInteger,
  pattern: text,
  minLengthMessage: text,
  maxLengthMessage: text,
  patternMessage: text,
} satisfies Record<string, DataSchema>;

export const TextField = defineWidget('TextField', {
  properties: {
    type: 'object',
    properties: {
      ...textFieldProperties,
      inputType: { type: 'enum', values: ['text', 'email', 'password', 'search', 'tel', 'url'] },
    },
    required: ['id', 'label', 'value'],
  },
  defaults: { ...fieldDefaults, readOnly: false, inputType: 'text' }, slots: {},
  events: { change: { type: 'string' } }, themeHooks: ['form', 'field', 'text'],
  example: { type: 'TextField', props: { id: 'name', label: 'Name', value: 'Power Eagle', required: true } },
});

export const TextArea = defineWidget('TextArea', {
  properties: {
    type: 'object',
    properties: { ...textFieldProperties, rows: positiveInteger },
    required: ['id', 'label', 'value'],
  },
  defaults: { ...fieldDefaults, readOnly: false, rows: 4 }, slots: {},
  events: { change: { type: 'string' } }, themeHooks: ['form', 'field', 'text'],
  example: { type: 'TextArea', props: { id: 'notes', label: 'Notes', value: 'Declarative and typed.', rows: 3 } },
});

export const NumberField = defineWidget('NumberField', {
  properties: {
    type: 'object',
    properties: {
      ...common,
      value: { type: 'number' },
      initialValue: { type: 'number' },
      placeholder: text,
      readOnly: boolean,
      minimum: { type: 'number' },
      maximum: { type: 'number' },
      step: positiveNumber,
      integer: boolean,
      minimumMessage: text,
      maximumMessage: text,
      stepMessage: text,
      integerMessage: text,
    },
    required: ['id', 'label', 'value'],
  },
  defaults: { ...fieldDefaults, readOnly: false, integer: false }, slots: {},
  events: { change: { type: 'number' } }, themeHooks: ['form', 'field', 'number'],
  example: { type: 'NumberField', props: { id: 'copies', label: 'Copies', value: 2, minimum: 1, maximum: 12, step: 1, integer: true } },
});

export const Checkbox = defineWidget('Checkbox', {
  properties: {
    type: 'object', properties: { ...common, value: boolean, initialValue: boolean }, required: ['id', 'label', 'value'],
  },
  defaults: fieldDefaults, slots: {}, events: { change: { type: 'boolean' } }, themeHooks: ['form', 'field', 'boolean'],
  example: { type: 'Checkbox', props: { id: 'terms', label: 'Accept terms', value: true, required: true } },
});

const radioOption = {
  type: 'object',
  properties: { value: { type: 'string', minLength: 1 }, label: { type: 'string', minLength: 1 }, disabled: boolean },
  required: ['value', 'label'] as ['value', 'label'],
} satisfies DataSchema;

export const RadioGroup = defineWidget('RadioGroup', {
  properties: {
    type: 'object',
    properties: {
      ...common,
      value: text,
      initialValue: text,
      options: { type: 'array', items: radioOption },
      optionMessage: text,
    },
    required: ['id', 'label', 'value', 'options'],
  },
  defaults: fieldDefaults, slots: {}, events: { change: { type: 'string' } }, themeHooks: ['form', 'field', 'choice'],
  example: { type: 'RadioGroup', props: { id: 'density', label: 'Density', value: 'compact', options: [
    { value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' },
  ] } },
});

export const Switch = defineWidget('Switch', {
  properties: {
    type: 'object', properties: { ...common, value: boolean, initialValue: boolean }, required: ['id', 'label', 'value'],
  },
  defaults: fieldDefaults, slots: {}, events: { change: { type: 'boolean' } }, themeHooks: ['form', 'field', 'boolean'],
  example: { type: 'Switch', props: { id: 'telemetry', label: 'Anonymous telemetry', value: false } },
});

export const formWidgets = { Form, TextField, TextArea, NumberField, Checkbox, RadioGroup, Switch } as const;
export const formContracts: Record<string, WidgetContract> = Object.fromEntries(
  Object.entries(formWidgets).map(([type, widget]) => [type, widget.contract]),
);
