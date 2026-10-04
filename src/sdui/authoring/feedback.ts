import type { DataSchema, WidgetContract } from '../schema/model';
import { defineWidget } from './index';

const boolean = { type: 'boolean' } satisfies DataSchema;
const text = { type: 'string' } satisfies DataSchema;
const positive = { type: 'number', minimum: Number.MIN_VALUE } satisfies DataSchema;
const nonnegative = { type: 'number', minimum: 0 } satisfies DataSchema;
const tone = { type: 'enum', values: ['info', 'success', 'warning', 'error'] } satisfies DataSchema;
const closeEvent = {
  type: 'object', properties: {
    reason: { type: 'enum', values: ['button', 'escape', 'backdrop', 'timeout', 'action'] },
  }, required: ['reason'] as ['reason'],
} satisfies DataSchema;

export const ProgressIndicator = defineWidget('ProgressIndicator', {
  properties: { type: 'object', properties: {
    label: { type: 'string', minLength: 1 }, status: text, value: { type: 'number', minimum: 0, maximum: 100 },
    indeterminate: boolean, tone,
  }, required: ['label'] },
  defaults: { status: '', value: 0, indeterminate: false, tone: 'info' }, slots: {}, events: {},
  themeHooks: ['feedback', 'progress'],
  example: { type: 'ProgressIndicator', props: { label: 'Installing package', status: '3 of 5 files', value: 60 } },
});

export const Skeleton = defineWidget('Skeleton', {
  properties: { type: 'object', properties: {
    label: { type: 'string', minLength: 1 }, lines: { type: 'number', minimum: 1, integer: true },
    width: positive, height: positive, animated: boolean,
  }, required: ['label'] },
  defaults: { lines: 1, animated: true }, slots: {}, events: {}, themeHooks: ['feedback', 'skeleton'],
  example: { type: 'Skeleton', props: { label: 'Loading package details', lines: 3, animated: true } },
});

export const EmptyState = defineWidget('EmptyState', {
  properties: { type: 'object', properties: {
    title: { type: 'string', minLength: 1 }, message: text, actionLabel: text,
  }, required: ['title'] },
  defaults: { message: '', actionLabel: '' }, slots: {}, events: { action: { type: 'null' } },
  themeHooks: ['feedback', 'empty'],
  example: { type: 'EmptyState', props: { title: 'No packages', message: 'Install a package to begin.', actionLabel: 'Install package' } },
});

export const ErrorState = defineWidget('ErrorState', {
  properties: { type: 'object', properties: {
    title: { type: 'string', minLength: 1 }, message: text, retryLabel: text, retrying: boolean,
  }, required: ['title'] },
  defaults: { message: '', retryLabel: 'Retry', retrying: false }, slots: {}, events: { retry: { type: 'null' } },
  themeHooks: ['feedback', 'error'],
  example: { type: 'ErrorState', props: { title: 'Package failed', message: 'The provider could not be loaded.', retryLabel: 'Retry' } },
});

export const Banner = defineWidget('Banner', {
  properties: { type: 'object', properties: {
    title: { type: 'string', minLength: 1 }, message: text, tone, actionLabel: text,
    dismissible: boolean,
  }, required: ['title'] },
  defaults: { message: '', tone: 'info', actionLabel: '', dismissible: false }, slots: {},
  events: { action: { type: 'null' }, dismiss: { type: 'null' } }, themeHooks: ['feedback', 'banner'],
  example: { type: 'Banner', props: { title: 'Package updated', message: 'Reload to use the new provider.', tone: 'success', actionLabel: 'Reload' } },
});

export const Toast = defineWidget('Toast', {
  properties: { type: 'object', properties: {
    id: { type: 'string', minLength: 1 }, message: { type: 'string', minLength: 1 }, tone,
    duration: nonnegative, dismissible: boolean, open: boolean,
  }, required: ['id', 'message'] },
  defaults: { tone: 'info', duration: 5000, dismissible: true, open: false }, slots: {},
  events: { close: closeEvent, action: { type: 'null' } }, themeHooks: ['feedback', 'toast', 'overlay'],
  example: { type: 'Toast', props: { id: 'catalog-toast', message: 'Package installed', tone: 'success', duration: 0, open: true } },
});

export const Dialog = defineWidget('Dialog', {
  properties: { type: 'object', properties: {
    id: { type: 'string', minLength: 1 }, title: { type: 'string', minLength: 1 }, description: text,
    modal: boolean, closeOnEscape: boolean, dismissible: boolean, open: boolean,
  }, required: ['id', 'title'] },
  defaults: { description: '', modal: true, closeOnEscape: true, dismissible: true, open: false },
  slots: {
    children: { cardinality: 'many', required: true }, actions: { cardinality: 'many', required: false },
  }, events: { close: closeEvent }, themeHooks: ['feedback', 'dialog', 'overlay'],
  example: { type: 'Dialog', props: {
    id: 'catalog-dialog', title: 'Install package?', description: 'Review the package before continuing.', open: true,
  }, slots: {
    children: [{ type: 'Text', props: { text: 'example.package/widgets' } }],
    actions: [{ type: 'Button', props: { label: 'Install' } }],
  } },
});

export const feedbackWidgets = { ProgressIndicator, Skeleton, EmptyState, ErrorState, Banner, Toast, Dialog } as const;
export const feedbackContracts: Record<string, WidgetContract> = Object.fromEntries(
  Object.entries(feedbackWidgets).map(([type, widget]) => [type, widget.contract]),
);
