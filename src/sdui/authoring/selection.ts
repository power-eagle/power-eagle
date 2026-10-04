import type { DataSchema, WidgetContract } from '../schema/model';
import { defineWidget } from './index';

const text = { type: 'string' } satisfies DataSchema;
const boolean = { type: 'boolean' } satisfies DataSchema;
const number = { type: 'number' } satisfies DataSchema;
const positiveNumber = { type: 'number', minimum: Number.MIN_VALUE } satisfies DataSchema;
const nonnegativeInteger = { type: 'number', minimum: 0, integer: true } satisfies DataSchema;
const fieldDefaults = { disabled: false, required: false, readOnly: false };
const common = {
  id: { type: 'string', minLength: 1, pattern: '^[A-Za-z][A-Za-z0-9_.-]*$' },
  label: { type: 'string', minLength: 1 },
  description: text,
  error: text,
  disabled: boolean,
  readOnly: boolean,
  required: boolean,
  requiredMessage: text,
} satisfies Record<string, DataSchema>;
const option = {
  type: 'object',
  properties: { value: { type: 'string', minLength: 1 }, label: { type: 'string', minLength: 1 }, disabled: boolean },
  required: ['value', 'label'] as ['value', 'label'],
} satisfies DataSchema;
const optionProperties = {
  ...common,
  value: text,
  initialValue: text,
  options: { type: 'array', items: option },
  placeholder: text,
  optionMessage: text,
} satisfies Record<string, DataSchema>;

export const Select = defineWidget('Select', {
  properties: { type: 'object', properties: optionProperties, required: ['id', 'label', 'value', 'options'] },
  defaults: fieldDefaults,
  slots: {}, events: { change: { type: 'string' } }, themeHooks: ['form', 'field', 'selection'],
  example: { type: 'Select', props: { id: 'channel', label: 'Release channel', value: 'stable', options: [
    { value: 'stable', label: 'Stable' }, { value: 'preview', label: 'Preview' },
  ] } },
});

export const Autocomplete = defineWidget('Autocomplete', {
  properties: {
    type: 'object',
    properties: { ...optionProperties, allowCustom: boolean, maxSuggestions: nonnegativeInteger },
    required: ['id', 'label', 'value', 'options'],
  },
  defaults: { ...fieldDefaults, allowCustom: false, maxSuggestions: 8 },
  slots: {}, events: { change: { type: 'string' }, select: { type: 'string' } }, themeHooks: ['form', 'field', 'selection'],
  example: { type: 'Autocomplete', props: { id: 'city', label: 'City', value: '', placeholder: 'Find a city', options: [
    { value: 'vancouver', label: 'Vancouver' }, { value: 'victoria', label: 'Victoria' }, { value: 'vernon', label: 'Vernon' },
  ] } },
});

export const Slider = defineWidget('Slider', {
  properties: {
    type: 'object', properties: {
      ...common, value: number, initialValue: number, minimum: number, maximum: number, step: positiveNumber,
      minimumMessage: text, maximumMessage: text, stepMessage: text, valueLabel: text,
    }, required: ['id', 'label', 'value', 'minimum', 'maximum'],
  },
  defaults: { ...fieldDefaults, step: 1 },
  slots: {}, events: { change: { type: 'number' } }, themeHooks: ['form', 'field', 'range'],
  example: { type: 'Slider', props: { id: 'opacity', label: 'Opacity', value: 70, minimum: 0, maximum: 100, step: 5, valueLabel: '%' } },
});

export const DatePicker = defineWidget('DatePicker', {
  properties: {
    type: 'object', properties: {
      ...common, value: text, initialValue: text, minimum: text, maximum: text,
      formatMessage: text, minimumMessage: text, maximumMessage: text,
    }, required: ['id', 'label', 'value'],
  },
  defaults: fieldDefaults,
  slots: {}, events: { change: { type: 'string' } }, themeHooks: ['form', 'field', 'date'],
  example: { type: 'DatePicker', props: { id: 'releaseDate', label: 'Release date', value: '2026-10-04', minimum: '2026-01-01', maximum: '2026-12-31' } },
});

export const ColorPicker = defineWidget('ColorPicker', {
  properties: {
    type: 'object', properties: { ...common, value: text, initialValue: text, formatMessage: text },
    required: ['id', 'label', 'value'],
  },
  defaults: fieldDefaults,
  slots: {}, events: { change: { type: 'string' } }, themeHooks: ['form', 'field', 'color'],
  example: { type: 'ColorPicker', props: { id: 'accent', label: 'Accent color', value: '#ffae2b' } },
});

const fileFilter = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    extensions: { type: 'array', items: { type: 'string', minLength: 1 } },
  },
  required: ['name', 'extensions'] as ['name', 'extensions'],
} satisfies DataSchema;
const paths = { type: 'array', items: { type: 'string', minLength: 1 } } satisfies DataSchema;

export const FilePicker = defineWidget('FilePicker', {
  properties: {
    type: 'object', properties: {
      ...common, value: paths, initialValue: paths, selectionType: { type: 'enum', values: ['file', 'directory'] },
      multiple: boolean, title: text, initialPath: text, buttonLabel: text, filters: { type: 'array', items: fileFilter },
    }, required: ['id', 'label', 'value'],
  },
  defaults: { ...fieldDefaults, selectionType: 'file', multiple: false, buttonLabel: 'Choose' },
  slots: {}, events: { change: paths, cancel: { type: 'null' }, error: { type: 'string' } }, themeHooks: ['form', 'field', 'file'],
  example: { type: 'FilePicker', props: { id: 'source', label: 'Source files', value: [], multiple: true, buttonLabel: 'Choose files', filters: [
    { name: 'Images', extensions: ['png', 'jpg', 'webp'] },
  ] } },
});

export const selectionWidgets = { Select, Autocomplete, Slider, DatePicker, ColorPicker, FilePicker } as const;
export const selectionContracts: Record<string, WidgetContract> = Object.fromEntries(
  Object.entries(selectionWidgets).map(([type, widget]) => [type, widget.contract]),
);
