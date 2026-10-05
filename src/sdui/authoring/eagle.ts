import type { DataSchema, WidgetContract } from '../schema/model';
import { defineWidget } from './index';

const text = { type: 'string' } satisfies DataSchema;
const nonemptyText = { type: 'string', minLength: 1 } satisfies DataSchema;
const boolean = { type: 'boolean' } satisfies DataSchema;
const nonnegative = { type: 'number', minimum: 0 } satisfies DataSchema;
const stringArray = { type: 'array', items: text } satisfies DataSchema;
const selectionMode = { type: 'enum', values: ['none', 'single', 'multiple'] } satisfies DataSchema;
const assetStatus = { type: 'enum', values: ['loading', 'ready', 'error'] } satisfies DataSchema;

export const assetRecordSchema = {
  type: 'object',
  properties: {
    id: nonemptyText, name: text, extension: text, width: nonnegative, height: nonnegative,
    url: text, annotation: text, tags: stringArray, folderIds: stringArray, rating: nonnegative,
    fileUrl: text, thumbnailUrl: text, modifiedAt: nonnegative,
  },
  required: [
    'id', 'name', 'extension', 'width', 'height', 'url', 'annotation', 'tags', 'folderIds',
    'rating', 'fileUrl', 'thumbnailUrl', 'modifiedAt',
  ],
} satisfies DataSchema;

export const assetListSchema = { type: 'array', items: assetRecordSchema } satisfies DataSchema;

const exampleAsset = {
  id: 'asset-one', name: 'Design reference', extension: 'png', width: 1280, height: 720,
  url: '', annotation: 'Blueprint shell', tags: ['design'], folderIds: ['references'], rating: 4,
  fileUrl: '', thumbnailUrl: 'assets/gallery.svg', modifiedAt: 1,
};
const secondExampleAsset = {
  ...exampleAsset, id: 'asset-two', name: 'Runtime diagram', extension: 'svg', width: 800, height: 600,
  tags: ['runtime'], rating: 0, thumbnailUrl: 'assets/preview.svg', modifiedAt: 2,
};

export const AssetCard = defineWidget('AssetCard', {
  properties: { type: 'object', properties: {
    asset: assetRecordSchema, selected: boolean, disabled: boolean, failureText: text,
  }, required: ['asset'] },
  defaults: { selected: false, disabled: false, failureText: 'Preview unavailable' },
  slots: {}, events: { select: nonemptyText, activate: nonemptyText, imageError: nonemptyText },
  themeHooks: ['eagle', 'asset', 'card'],
  example: { type: 'AssetCard', props: { asset: exampleAsset, selected: true } },
});

export const AssetGrid = defineWidget('AssetGrid', {
  properties: { type: 'object', properties: {
    label: nonemptyText, assets: assetListSchema, selection: stringArray, selectionMode,
    status: assetStatus, emptyText: text, errorText: text, failureText: text,
    columns: { type: 'number', minimum: 1, integer: true }, gap: nonnegative,
    height: { type: 'number', minimum: Number.MIN_VALUE }, disabled: boolean,
  }, required: ['label', 'assets'] },
  defaults: {
    selection: [], selectionMode: 'single', status: 'ready', emptyText: 'No Eagle assets',
    errorText: 'Unable to load Eagle assets', failureText: 'Preview unavailable', columns: 3, gap: 8, disabled: false,
  },
  slots: {}, events: {
    selectionChange: stringArray, activate: nonemptyText, retry: { type: 'null' }, imageError: nonemptyText,
  },
  themeHooks: ['eagle', 'asset', 'grid'],
  example: { type: 'AssetGrid', props: {
    label: 'Eagle assets', assets: [exampleAsset, secondExampleAsset], selection: ['asset-one'], columns: 2,
  } },
});

export const AssetPicker = defineWidget('AssetPicker', {
  properties: { type: 'object', properties: {
    label: nonemptyText, assets: assetListSchema, selection: stringArray,
    selectionMode: { type: 'enum', values: ['single', 'multiple'] }, status: assetStatus,
    emptyText: text, errorText: text, failureText: text, confirmLabel: nonemptyText,
    cancelLabel: nonemptyText, columns: { type: 'number', minimum: 1, integer: true },
    gap: nonnegative, height: { type: 'number', minimum: Number.MIN_VALUE }, disabled: boolean,
  }, required: ['label', 'assets'] },
  defaults: {
    selection: [], selectionMode: 'multiple', status: 'ready', emptyText: 'No Eagle assets',
    errorText: 'Unable to load Eagle assets', failureText: 'Preview unavailable', confirmLabel: 'Use selection',
    cancelLabel: 'Cancel', columns: 3, gap: 8, disabled: false,
  },
  slots: {}, events: {
    selectionChange: stringArray, confirm: stringArray, cancel: { type: 'null' },
    activate: nonemptyText, retry: { type: 'null' }, imageError: nonemptyText,
  },
  themeHooks: ['eagle', 'asset', 'picker'],
  example: { type: 'AssetPicker', props: {
    label: 'Choose Eagle assets', assets: [exampleAsset, secondExampleAsset], selection: ['asset-two'], columns: 2,
  } },
});

export const eagleWidgets = { AssetCard, AssetGrid, AssetPicker } as const;
export const eagleContracts: Record<string, WidgetContract> = Object.fromEntries(
  Object.entries(eagleWidgets).map(([type, widget]) => [type, widget.contract]),
);
