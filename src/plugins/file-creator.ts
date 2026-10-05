import type { EagleCapabilities, FileCreationResult } from '../host/eagle-capabilities';
import { call, defineDocument, expression, forEach, ref, run, sequence, set } from '../sdui/authoring';
import { Text } from '../sdui/authoring/content';
import { Button } from '../sdui/authoring/desktop';
import { EmptyState } from '../sdui/authoring/feedback';
import { Form, TextField } from '../sdui/authoring/forms';
import { Column, Row } from '../sdui/authoring/layout';
import type { CallableAdapter } from '../sdui/runtime/actions';
import type { DataSchema, Json, PackageManifest } from '../sdui/schema/model';
import type { BuiltinTool } from './builtin-tool';

const PACKAGE_ID = 'power-eagle.file-creator';
const VERSION = '1.0.0';
const normalizeTarget = `${PACKAGE_ID}/normalizeExtension`;
const createTarget = `${PACKAGE_ID}/create`;
const emptyObject = { type: 'object' as const, properties: {}, required: [] };
const string = { type: 'string' as const };
const createInput = {
  type: 'object' as const,
  properties: { fileName: string, extension: string },
  required: ['fileName', 'extension'],
} satisfies DataSchema;
const createOutput = {
  type: 'object' as const,
  properties: { status: { type: 'enum' as const, values: ['created', 'cancelled'] }, path: string },
  required: ['status'],
} satisfies DataSchema;

export function normalizeExtension(value: string): string {
  const extension = value.trim().replace(/^\.+/, '').toLowerCase();
  if (!extension) throw new Error('Enter an extension before adding or creating a file.');
  if (!/^[a-z0-9][a-z0-9._+-]*$/u.test(extension)) {
    throw new Error('Use letters, numbers, dots, plus, hyphen, or underscore in the extension.');
  }
  return extension;
}

export function normalizeFileName(value: string): string {
  const fileName = value.trim();
  if (!fileName) throw new Error('Enter a file name before creating a file.');
  const hasControlCharacter = Array.from(fileName).some(character => character.charCodeAt(0) <= 0x1f);
  if (fileName === '.' || fileName === '..' || /[<>:"/\\|?*]/u.test(fileName) || hasControlCharacter || /[. ]$/u.test(fileName)) {
    throw new Error('Enter a file name without path separators or reserved Windows characters.');
  }
  return fileName;
}

export function initialFileContent(fileName: string, extension: string): string {
  if (extension === 'json') return '{}\n';
  if (extension === 'md' || extension === 'markdown') return `# ${fileName}\n\n`;
  if (extension === 'html' || extension === 'htm') return `<!doctype html>\n<title>${fileName}</title>\n`;
  return '';
}

function object(value: Json): Record<string, Json> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object arguments');
  return value;
}

export function fileCreatorCalls(capabilities: EagleCapabilities): Readonly<Record<string, CallableAdapter>> {
  return {
    [normalizeTarget]: {
      input: string,
      output: string,
      invoke: args => normalizeExtension(String(args)),
    },
    [createTarget]: {
      input: createInput,
      output: createOutput,
      invoke: async args => {
        const input = object(args);
        const fileName = normalizeFileName(String(input.fileName));
        const extension = normalizeExtension(String(input.extension));
        return capabilities.files.createText(`${fileName}.${extension}`, initialFileContent(fileName, extension)) as Promise<FileCreationResult>;
      },
    },
  };
}

const fileName = ref<string>('state', 'fileName');
const extension = ref<string>('state', 'extension');
const savedExtensions = ref<string[]>('state', 'savedExtensions');
const result = ref('result');
const errorMessage = ref<string>('error', 'message');

export const fileCreatorDocument = defineDocument({
  format: 'power-eagle/runtime', formatVersion: 1, start: 'home', components: {},
  dependencies: [
    { package: PACKAGE_ID, version: '^1.0.0', export: 'normalizeExtension', kind: 'action' },
    { package: PACKAGE_ID, version: '^1.0.0', export: 'create', kind: 'action' },
  ],
  state: {
    fileName: { schema: string, initial: '' },
    extension: { schema: string, initial: 'txt' },
    savedExtensions: { schema: { type: 'array', items: string }, initial: ['txt', 'json', 'md'] },
    pendingExtension: { schema: string, initial: '' },
    status: { schema: string, initial: 'Enter a file name and choose an extension.' },
  },
  actions: {
    addExtension: {
      ...call(normalizeTarget, extension),
      success: sequence(
        set('extension', result),
        set('savedExtensions', expression('concat',
          expression('filter', savedExtensions, expression('ne', ref('item'), result)), [result])),
        set('status', expression('format', 'Added .{0} to this session.', ref('state', 'extension'))),
      ),
      error: set('status', errorMessage),
    },
    removeExtension: sequence(
      set('savedExtensions', expression('filter', savedExtensions,
        expression('ne', ref('item'), ref('state', 'pendingExtension')))),
      set('status', expression('format', 'Removed .{0} from this session.', ref('state', 'pendingExtension'))),
    ),
    createFile: {
      ...call(createTarget, { fileName, extension }),
      success: set('status', expression('if',
        expression('eq', expression('get', result, 'status'), 'cancelled'),
        'File creation was cancelled.',
        expression('format', 'Created {0}', expression('get', result, 'path')),
      )),
      error: set('status', errorMessage),
    },
  },
  screens: {
    home: {
      params: emptyObject, state: {},
      body: Column.node({ gap: 12 }, { slots: { children: [
        Text.node({ text: 'File Creator', variant: 'title' }),
        Form.node({ id: 'fileCreator', validationMode: 'submit' }, {
          events: { submit: run('createFile') },
          slots: { children: [
            TextField.node({ id: 'fileName', label: 'File name', value: fileName, required: true }, {
              events: { change: set('fileName', ref('event')) },
            }),
            TextField.node({ id: 'extension', label: 'Extension', value: extension, required: true }, {
              events: { change: set('extension', ref('event')) },
            }),
            Row.node({ gap: 8 }, { slots: { children: [
              Button.node({ label: 'Add extension', variant: 'outline' }, { events: { press: run('addExtension') } }),
              Button.node({ label: 'Create file', buttonType: 'submit' }),
            ] } }),
          ] },
        }),
        Text.node({ text: 'Quick create extensions', variant: 'label' }),
        forEach(Row.node({ gap: 8 }, { slots: { children: [
          Text.node({ text: expression('format', '.{0}', ref('item')) }),
          Button.node({ label: expression('format', 'Use .{0}', ref('item')), variant: 'secondary' }, {
            events: { press: set('extension', ref('item')) },
          }),
          Button.node({ label: expression('format', 'Remove .{0}', ref('item')), variant: 'ghost' }, {
            events: { press: sequence(set('pendingExtension', ref('item')), run('removeExtension')) },
          }),
        ] } }), savedExtensions, ref('item'), EmptyState.node({ title: 'No quick extensions' })),
        Text.node({ text: ref('state', 'status'), variant: 'small' }),
      ] } }),
    },
  },
});

export const fileCreatorManifest: PackageManifest = {
  format: 'power-eagle/package', formatVersion: 1, id: PACKAGE_ID, name: 'File Creator', version: VERSION,
  description: 'Create a text file through Eagle using normalized quick extensions.', sdk: '^1.0.0',
  contributions: { runtime: 'run.json', actions: 'actions.cjs' },
  exports: [
    { kind: 'runtime', id: 'main', screens: ['home'] },
    { kind: 'action', id: 'normalizeExtension', contract: { input: string, output: string } },
    { kind: 'action', id: 'create', contract: { input: createInput, output: createOutput } },
  ],
  dependencies: [], assets: [],
};

export const fileCreatorTool: BuiltinTool = {
  manifest: fileCreatorManifest,
  document: fileCreatorDocument,
  calls: fileCreatorCalls,
};
