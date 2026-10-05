import type { AssetRecord, EagleCapabilities } from '../host/eagle-capabilities';
import { call, defineDocument, expression, ref, run, sequence, set } from '../sdui/authoring';
import { Text } from '../sdui/authoring/content';
import { AssetPicker, assetListSchema } from '../sdui/authoring/eagle';
import { Column } from '../sdui/authoring/layout';
import type { CallableAdapter } from '../sdui/runtime/actions';
import type { DataSchema, Json, PackageManifest } from '../sdui/schema/model';
import type { BuiltinTool } from './builtin-tool';

const PACKAGE_ID = 'power-eagle.asset-browser';
const VERSION = '1.0.0';
const target = (id: string) => `${PACKAGE_ID}/${id}`;
const emptyObject = { type: 'object' as const, properties: {}, required: [] };
const string = { type: 'string' as const };
const stringArray = { type: 'array' as const, items: string } satisfies DataSchema;

export function assetBrowserCalls(capabilities: EagleCapabilities): Readonly<Record<string, CallableAdapter>> {
  return {
    [target('list')]: {
      input: { type: 'json' }, output: assetListSchema,
      invoke: query => capabilities.assets.list(
        query && typeof query === 'object' && !Array.isArray(query) ? query as Record<string, unknown> : undefined,
      ) as unknown as Promise<Json>,
    },
    [target('select')]: {
      input: stringArray, output: { type: 'boolean' },
      invoke: ids => capabilities.assets.select(ids as string[]),
    },
  };
}

const assets = ref<AssetRecord[]>('state', 'assets');
const selection = ref<string[]>('state', 'selection');
const result = ref('result');
const errorMessage = ref<string>('error', 'message');

export const assetBrowserDocument = defineDocument({
  initialize: ['load'],
  format: 'power-eagle/runtime', formatVersion: 1, start: 'home', components: {},
  dependencies: ['list', 'select'].map(exportId => ({
    package: PACKAGE_ID, version: '^1.0.0', export: exportId, kind: 'action' as const,
  })),
  state: {
    assets: { schema: assetListSchema, initial: [] },
    selection: { schema: stringArray, initial: [] },
    status: { schema: { type: 'enum', values: ['loading', 'ready', 'error'] }, initial: 'loading' },
    message: { schema: string, initial: 'Loading Eagle assets' },
  },
  actions: {
    load: sequence(
      set('status', 'loading'),
      set('message', 'Loading Eagle assets'),
      {
        ...call(target('list'), {}),
        success: sequence(
          set('assets', result),
          set('status', 'ready'),
          set('message', expression('format', 'Loaded {0} Eagle assets.', expression('length', assets))),
        ),
        error: sequence(set('status', 'error'), set('message', errorMessage)),
      },
    ),
    select: {
      ...call(target('select'), selection),
      success: set('message', expression('format', 'Selected {0} assets in Eagle.', expression('length', selection))),
      error: set('message', errorMessage),
    },
  },
  screens: {
    home: {
      params: emptyObject, state: {},
      body: Column.node({ gap: 12 }, { slots: { children: [
        Text.node({ text: 'Eagle Asset Picker', variant: 'title' }),
        AssetPicker.node({
          label: 'Eagle assets', assets, selection, selectionMode: 'multiple',
          status: ref('state', 'status'), errorText: ref('state', 'message'), columns: 3,
        }, { events: {
          selectionChange: set('selection', ref('event')),
          confirm: run('select'),
          retry: run('load'),
        } }),
        Text.node({ text: ref('state', 'message'), variant: 'small' }, {
          visible: expression('ne', ref('state', 'status'), 'error'),
        }),
      ] } }),
    },
  },
});

export const assetBrowserManifest: PackageManifest = {
  format: 'power-eagle/package', formatVersion: 1, id: PACKAGE_ID, name: 'Asset Browser', version: VERSION,
  description: 'Load and explicitly select typed Eagle assets.', sdk: '^1.0.0',
  contributions: { runtime: 'run.json', actions: 'actions.cjs' },
  exports: [
    { kind: 'runtime', id: 'main', screens: ['home'] },
    { kind: 'action', id: 'list', contract: { input: { type: 'json' }, output: assetListSchema } },
    { kind: 'action', id: 'select', contract: { input: stringArray, output: { type: 'boolean' } } },
  ],
  dependencies: [], assets: [],
};

export const assetBrowserTool: BuiltinTool = {
  manifest: assetBrowserManifest,
  document: assetBrowserDocument,
  calls: assetBrowserCalls,
};
