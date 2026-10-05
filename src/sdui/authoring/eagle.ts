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

export const folderNodeSchema = {
  type: 'object', properties: { id: nonemptyText, name: text, description: text, parentId: text },
  required: ['id', 'name', 'description', 'parentId'],
} satisfies DataSchema;
export const folderListSchema = { type: 'array', items: folderNodeSchema } satisfies DataSchema;

export const tagRecordSchema = {
  type: 'object', properties: { name: nonemptyText, count: nonnegative, color: text, groups: stringArray },
  required: ['name', 'count', 'color', 'groups'],
} satisfies DataSchema;
export const tagListSchema = { type: 'array', items: tagRecordSchema } satisfies DataSchema;

export const libraryHistorySchema = {
  type: 'object', properties: {
    id: nonemptyText, name: text, path: nonemptyText,
    status: { type: 'enum', values: ['available', 'missing', 'inaccessible'] }, reason: text,
  }, required: ['id', 'name', 'path', 'status', 'reason'],
} satisfies DataSchema;
export const libraryHistoryListSchema = { type: 'array', items: libraryHistorySchema } satisfies DataSchema;

export const metadataSubmissionSchema = {
  type: 'object', properties: {
    id: nonemptyText, name: text, annotation: text, tags: stringArray, folderIds: stringArray,
    rating: { type: 'number', minimum: 0, maximum: 5, integer: true },
  }, required: ['id', 'name', 'annotation', 'tags', 'folderIds', 'rating'],
} satisfies DataSchema;

export const importRequestSchema = {
  type: 'object', properties: {
    id: nonemptyText, source: nonemptyText, kind: { type: 'enum', values: ['path', 'url'] },
  }, required: ['id', 'source', 'kind'],
} satisfies DataSchema;
export const importRequestListSchema = { type: 'array', items: importRequestSchema } satisfies DataSchema;
export const importResultSchema = {
  type: 'object', properties: {
    id: nonemptyText, source: nonemptyText, kind: { type: 'enum', values: ['path', 'url'] },
    status: { type: 'enum', values: ['queued', 'importing', 'success', 'error', 'cancelled'] },
    assetId: text, message: text,
  }, required: ['id', 'source', 'kind', 'status', 'assetId', 'message'],
} satisfies DataSchema;
export const importResultListSchema = { type: 'array', items: importResultSchema } satisfies DataSchema;

const exampleFolders = [
  { id: 'projects', name: 'Projects', description: 'Project assets', parentId: '' },
  { id: 'runtime', name: 'Runtime', description: 'Runtime references', parentId: 'projects' },
];
const exampleTags = [
  { name: 'design', count: 12, color: '#ffad32', groups: ['topic'] },
  { name: 'runtime', count: 8, color: '#7aa2f7', groups: ['topic'] },
];
const exampleLibraries = [
  { id: 'current', name: 'Reference', path: 'C:\\Reference.library', status: 'available', reason: '' },
  { id: 'missing', name: 'Archive', path: 'D:\\Archive.library', status: 'missing', reason: 'Directory does not exist' },
];

export const FolderTree = defineWidget('FolderTree', {
  properties: { type: 'object', properties: {
    label: nonemptyText, folders: folderListSchema, selection: text, expanded: stringArray,
    status: assetStatus, emptyText: text, errorText: text, disabled: boolean,
  }, required: ['label', 'folders'] },
  defaults: { selection: '', expanded: [], status: 'ready', emptyText: 'No folders', errorText: 'Unable to load folders', disabled: false },
  slots: {}, events: {
    selectionChange: nonemptyText, expandedChange: stringArray, open: nonemptyText, retry: { type: 'null' },
  },
  themeHooks: ['eagle', 'folder', 'tree'],
  example: { type: 'FolderTree', props: { label: 'Eagle folders', folders: exampleFolders, selection: 'runtime', expanded: ['projects'] } },
});

export const TagPicker = defineWidget('TagPicker', {
  properties: { type: 'object', properties: {
    label: nonemptyText, tags: tagListSchema, selection: stringArray, status: assetStatus,
    emptyText: text, errorText: text, confirmLabel: nonemptyText, cancelLabel: nonemptyText, disabled: boolean,
  }, required: ['label', 'tags'] },
  defaults: {
    selection: [], status: 'ready', emptyText: 'No tags', errorText: 'Unable to load tags',
    confirmLabel: 'Use tags', cancelLabel: 'Cancel', disabled: false,
  },
  slots: {}, events: {
    selectionChange: stringArray, confirm: stringArray, cancel: { type: 'null' }, retry: { type: 'null' },
  },
  themeHooks: ['eagle', 'tag', 'picker'],
  example: { type: 'TagPicker', props: { label: 'Tags', tags: exampleTags, selection: ['design'] } },
});

export const LibraryPicker = defineWidget('LibraryPicker', {
  properties: { type: 'object', properties: {
    label: nonemptyText, libraries: libraryHistoryListSchema, selection: text, status: assetStatus,
    emptyText: text, errorText: text, confirmLabel: nonemptyText, cancelLabel: nonemptyText, disabled: boolean,
  }, required: ['label', 'libraries'] },
  defaults: {
    selection: '', status: 'ready', emptyText: 'No libraries', errorText: 'Unable to load libraries',
    confirmLabel: 'Open library', cancelLabel: 'Cancel', disabled: false,
  },
  slots: {}, events: {
    selectionChange: nonemptyText, confirm: nonemptyText, cancel: { type: 'null' }, retry: { type: 'null' },
  },
  themeHooks: ['eagle', 'library', 'picker'],
  example: { type: 'LibraryPicker', props: { label: 'Libraries', libraries: exampleLibraries, selection: 'C:\\Reference.library' } },
});

export const MetadataEditor = defineWidget('MetadataEditor', {
  properties: { type: 'object', properties: {
    assetId: nonemptyText, name: text, annotation: text, tags: stringArray, folderIds: stringArray,
    rating: { type: 'number', minimum: 0, maximum: 5, integer: true },
    status: { type: 'enum', values: ['ready', 'saving', 'success', 'error'] }, message: text, disabled: boolean,
  }, required: ['assetId', 'name'] },
  defaults: { annotation: '', tags: [], folderIds: [], rating: 0, status: 'ready', message: '', disabled: false },
  slots: {}, events: { submit: metadataSubmissionSchema, cancel: { type: 'null' } },
  themeHooks: ['eagle', 'asset', 'metadata', 'form'],
  example: { type: 'MetadataEditor', props: {
    assetId: 'asset-one', name: 'Design reference', annotation: 'Blueprint shell', tags: ['design'],
    folderIds: ['references'], rating: 4,
  } },
});

export const ImportQueue = defineWidget('ImportQueue', {
  properties: { type: 'object', properties: {
    label: nonemptyText, items: importResultListSchema, emptyText: text, disabled: boolean,
  }, required: ['label', 'items'] },
  defaults: { emptyText: 'No imports', disabled: false },
  slots: {}, events: { import: importRequestSchema, retry: importRequestSchema, cancel: nonemptyText },
  themeHooks: ['eagle', 'asset', 'import', 'queue'],
  example: { type: 'ImportQueue', props: { label: 'Imports', items: [
    { id: 'one', source: 'C:\\assets\\one.png', kind: 'path', status: 'success', assetId: 'asset-one', message: '' },
    { id: 'two', source: 'https://example.test/two.png', kind: 'url', status: 'error', assetId: '', message: 'Network failed' },
  ] } },
});

export const eagleWidgets = {
  AssetCard, AssetGrid, AssetPicker, FolderTree, TagPicker, LibraryPicker, MetadataEditor, ImportQueue,
} as const;
export const eagleContracts: Record<string, WidgetContract> = Object.fromEntries(
  Object.entries(eagleWidgets).map(([type, widget]) => [type, widget.contract]),
);
