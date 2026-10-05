import type { EagleCapabilities, LibraryHistoryRecord } from '../host/eagle-capabilities';
import { call, defineDocument, expression, forEach, ref, run, sequence, set } from '../sdui/authoring';
import { Text } from '../sdui/authoring/content';
import { Button } from '../sdui/authoring/desktop';
import { EmptyState } from '../sdui/authoring/feedback';
import { TextField } from '../sdui/authoring/forms';
import { Column, Row } from '../sdui/authoring/layout';
import type { CallableAdapter } from '../sdui/runtime/actions';
import type { DataSchema, Json, PackageManifest } from '../sdui/schema/model';
import type { BuiltinTool } from './builtin-tool';

const PACKAGE_ID = 'power-eagle.recent-libraries';
const VERSION = '1.0.0';
const target = (id: string) => `${PACKAGE_ID}/${id}`;
const emptyObject = { type: 'object' as const, properties: {}, required: [] };
const string = { type: 'string' as const };
const librarySchema = {
  type: 'object' as const,
  properties: {
    id: string, name: string, path: string,
    status: { type: 'enum' as const, values: ['available', 'missing', 'inaccessible'] },
    reason: string,
  },
  required: ['id', 'name', 'path', 'status'],
} satisfies DataSchema;
const librariesSchema = { type: 'array' as const, items: librarySchema } satisfies DataSchema;
const filterInput = {
  type: 'object' as const, properties: { libraries: librariesSchema, query: string }, required: ['libraries', 'query'],
} satisfies DataSchema;
const removeInput = {
  type: 'object' as const, properties: { libraries: librariesSchema, id: string }, required: ['libraries', 'id'],
} satisfies DataSchema;
const clearOutput = {
  type: 'object' as const,
  properties: { libraries: librariesSchema, removed: { type: 'number' as const, minimum: 0, integer: true } },
  required: ['libraries', 'removed'],
} satisfies DataSchema;
const switchInput = {
  type: 'object' as const, properties: { path: { type: 'string' as const, minLength: 1 } }, required: ['path'],
} satisfies DataSchema;

function object(value: Json): Record<string, Json> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object arguments');
  return value;
}

function libraries(value: Json): LibraryHistoryRecord[] {
  if (!Array.isArray(value)) throw new Error('Expected a library list');
  return value as unknown as LibraryHistoryRecord[];
}

export function filterLibraries(items: readonly LibraryHistoryRecord[], query: string): LibraryHistoryRecord[] {
  const needle = query.trim().toLocaleLowerCase('en-US');
  if (!needle) return [...items];
  return items.filter(item =>
    item.name.toLocaleLowerCase('en-US').includes(needle) || item.path.toLocaleLowerCase('en-US').includes(needle));
}

export function removeLibraryFromList(items: readonly LibraryHistoryRecord[], id: string): LibraryHistoryRecord[] {
  return items.filter(item => item.id !== id);
}

export function clearMissingLibraries(items: readonly LibraryHistoryRecord[]): { libraries: LibraryHistoryRecord[]; removed: number } {
  const retained = items.filter(item => item.status !== 'missing');
  return { libraries: retained, removed: items.length - retained.length };
}

function jsonResult(value: unknown): Json {
  if (value === undefined) return null;
  return value as Json;
}

export function recentLibraryCalls(capabilities: EagleCapabilities): Readonly<Record<string, CallableAdapter>> {
  return {
    [target('history')]: {
      input: { type: 'null' }, output: librariesSchema,
      invoke: () => capabilities.library.history() as unknown as Promise<Json>,
    },
    [target('filter')]: {
      input: filterInput, output: librariesSchema,
      invoke: args => {
        const input = object(args);
        return filterLibraries(libraries(input.libraries), String(input.query)) as unknown as Json;
      },
    },
    [target('remove')]: {
      input: removeInput, output: librariesSchema,
      invoke: args => {
        const input = object(args);
        return removeLibraryFromList(libraries(input.libraries), String(input.id)) as unknown as Json;
      },
    },
    [target('clearMissing')]: {
      input: librariesSchema, output: clearOutput,
      invoke: args => clearMissingLibraries(libraries(args)) as unknown as Json,
    },
    [target('switch')]: {
      input: switchInput, output: { type: 'json' },
      invoke: async (args, context) => jsonResult(await capabilities.library.switch(String(object(args).path), context.signal)),
    },
  };
}

const allLibraries = ref('state', 'libraries');
const visibleLibraries = ref('state', 'visibleLibraries');
const query = ref<string>('state', 'query');
const result = ref('result');
const errorMessage = ref<string>('error', 'message');

export const recentLibrariesDocument = defineDocument({
  format: 'power-eagle/runtime', formatVersion: 1, start: 'home', components: {},
  dependencies: ['history', 'filter', 'remove', 'clearMissing', 'switch'].map(exportId => ({
    package: PACKAGE_ID, version: '^1.0.0', export: exportId, kind: 'action' as const,
  })),
  state: {
    libraries: { schema: librariesSchema, initial: [] },
    visibleLibraries: { schema: librariesSchema, initial: [] },
    query: { schema: string, initial: '' },
    pendingId: { schema: string, initial: '' },
    pendingPath: { schema: string, initial: '' },
    clearResult: { schema: clearOutput, initial: { libraries: [], removed: 0 } },
    status: { schema: string, initial: 'Loading recent libraries…' },
  },
  actions: {
    applyFilter: {
      ...call(target('filter'), { libraries: allLibraries, query }),
      success: set('visibleLibraries', result),
      error: set('status', errorMessage),
    },
    refresh: {
      ...call(target('history'), null),
      success: sequence(
        set('libraries', result),
        set('status', expression('format', 'Loaded {0} recent libraries.', expression('length', result))),
        run('applyFilter'),
      ),
      error: set('status', errorMessage),
    },
    remove: {
      ...call(target('remove'), { libraries: allLibraries, id: ref('state', 'pendingId') }),
      success: sequence(
        set('libraries', result),
        set('status', 'Removed from this session list. Eagle history and library contents are unchanged.'),
        run('applyFilter'),
      ),
      error: set('status', errorMessage),
    },
    clearMissing: {
      ...call(target('clearMissing'), allLibraries),
      success: sequence(
        set('clearResult', result),
        set('libraries', ref('state', 'clearResult', 'libraries')),
        set('status', expression('format',
          'Removed {0} verified-missing entries from this session list. Eagle history and library contents are unchanged.',
          ref('state', 'clearResult', 'removed'))),
        run('applyFilter'),
      ),
      error: set('status', errorMessage),
    },
    open: {
      ...call(target('switch'), { path: ref('state', 'pendingPath') }),
      success: set('status', expression('format', 'Opened {0}', ref('state', 'pendingPath'))),
      error: set('status', errorMessage),
    },
  },
  screens: {
    home: {
      params: emptyObject, state: {},
      body: Column.node({ gap: 12 }, { slots: { children: [
        Text.node({ text: 'Recent Libraries', variant: 'title' }),
        TextField.node({ id: 'query', label: 'Filter by name or path', value: query, inputType: 'search' }, {
          events: { change: sequence(set('query', ref('event')), run('applyFilter')) },
        }),
        Row.node({ gap: 8 }, { slots: { children: [
          Button.node({ label: 'Refresh', variant: 'outline' }, { events: { press: run('refresh') } }),
          Button.node({ label: 'Clear verified missing', variant: 'outline' }, { events: { press: run('clearMissing') } }),
        ] } }),
        Text.node({
          text: 'Remove and Clear verified missing affect only this session list. They never rewrite Eagle history or delete a library.',
          variant: 'small',
        }),
        Text.node({ text: ref('state', 'status'), variant: 'small' }),
        forEach(Column.node({ gap: 4 }, { slots: { children: [
          Text.node({ text: ref('item', 'name'), variant: 'rowName' }),
          Text.node({ text: ref('item', 'path'), variant: 'code' }),
          Text.node({ text: expression('format', 'Status: {0}', ref('item', 'status')), variant: 'meta' }),
          Row.node({ gap: 8 }, { slots: { children: [
            Button.node({
              label: expression('format', 'Open {0}', ref('item', 'name')),
              disabled: expression('ne', ref('item', 'status'), 'available'),
            }, { events: { press: sequence(set('pendingPath', ref('item', 'path')), run('open')) } }),
            Button.node({ label: expression('format', 'Remove {0}', ref('item', 'name')), variant: 'ghost' }, {
              events: { press: sequence(set('pendingId', ref('item', 'id')), run('remove')) },
            }),
          ] } }),
        ] } }), visibleLibraries, ref('item', 'id'), EmptyState.node({ title: 'No matching libraries' })),
      ] } }),
    },
  },
});

export const recentLibrariesManifest: PackageManifest = {
  format: 'power-eagle/package', formatVersion: 1, id: PACKAGE_ID, name: 'Recent Libraries', version: VERSION,
  description: 'Inspect, filter, and switch actual Eagle library history without editing library metadata.', sdk: '^1.0.0',
  contributions: { runtime: 'run.json', actions: 'actions.cjs' },
  exports: [
    { kind: 'runtime', id: 'main', screens: ['home'] },
    { kind: 'action', id: 'history', contract: { input: { type: 'null' }, output: librariesSchema } },
    { kind: 'action', id: 'filter', contract: { input: filterInput, output: librariesSchema } },
    { kind: 'action', id: 'remove', contract: { input: removeInput, output: librariesSchema } },
    { kind: 'action', id: 'clearMissing', contract: { input: librariesSchema, output: clearOutput } },
    { kind: 'action', id: 'switch', contract: { input: switchInput, output: { type: 'json' } } },
  ],
  dependencies: [], assets: [],
};

export const recentLibrariesTool: BuiltinTool = {
  manifest: recentLibrariesManifest,
  document: recentLibrariesDocument,
  calls: recentLibraryCalls,
  initialize: ['refresh'],
};
