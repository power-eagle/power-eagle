import { describe, expect, it } from 'vitest';
import document from '../../../examples/runtime-only/document';
import manifest from '../../../examples/runtime-only/manifest.json';
import { Column, foundationCatalog, Text } from '../authoring/foundation';
import { serializableDiagnostics, validatePackage, validateRuntime, type Validation } from './validate';
import type { PackageManifest, RuntimeDocument } from './model';

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function paths(result: Validation<unknown>) { expect(result.success).toBe(false); return result.diagnostics.map(item => item.path); }
describe('runtime contract', () => {
  it('accepts reusable components, independent inputs, and declared slots', () => {
    expect(validateRuntime(document, foundationCatalog).success).toBe(true);
  });
  it.each([
    ['legacy payload', { version: 3, main: 'index.mjs' }, '/format'],
    ['unsupported version', { ...document, formatVersion: 2 }, '/formatVersion'],
    ['unknown field', { ...document, script: 'alert(1)' }, '/script'],
    ['missing screen', { ...document, start: 'missing' }, '/start'],
  ])('rejects %s with a path', (_, input, path) => {
    expect(paths(validateRuntime(input, foundationCatalog))).toContain(path);
  });
  it.each(['UnknownWidget', 'toString', 'not.installed/widget'])('rejects unknown type %s without throwing', type => {
    const input = copy(document); input.screens.home.body = { type };
    expect(paths(validateRuntime(input, foundationCatalog))).toContain('/screens/home/body/type');
  });
  it('rejects invalid properties, slots, and cardinality', () => {
    const input = copy(document);
    input.screens.home.body = { type: 'Column', props: { gap: 'wide', unknown: true }, slots: { children: { type: 'Text', props: { text: 'x' } }, unknown: [] } };
    expect(paths(validateRuntime(input, foundationCatalog))).toEqual(expect.arrayContaining([
      '/screens/home/body/props/gap', '/screens/home/body/props/unknown', '/screens/home/body/slots/children', '/screens/home/body/slots/unknown',
    ]));
  });
  it('rejects missing props, unknown input references, and component cycles', () => {
    const input = copy(document);
    input.components.Note.body = { type: 'component:Note', props: { title: { $ref: { scope: 'input', path: ['missing'] } } } };
    const result = validateRuntime(input, foundationCatalog);
    expect(paths(result)).toContain('/components/Note/body/props/title');
    expect(result.diagnostics.some(item => item.message.includes('cycle'))).toBe(true);
  });
  it('rejects invalid state values and unavailable result bindings', () => {
    const input = copy(document);
    input.state.count = { schema: { type: 'number' }, initial: 'zero' };
    input.screens.home.body = Text.node({ text: { $ref: { scope: 'result', path: [] } } });
    expect(paths(validateRuntime(input, foundationCatalog))).toEqual(expect.arrayContaining(['/state/count/initial', '/screens/home/body/props/text']));
  });
  it('rejects undeclared dependencies and checks available export version/kind', () => {
    const input = copy(document);
    input.screens.home.body = { type: 'example.ui/text', props: { text: 'hello' } };
    const catalog = { widgets: { ...foundationCatalog.widgets, 'example.ui/text': Text.contract }, exports: { 'example.ui/text': { version: '1.0.0', descriptor: { kind: 'widget' as const, id: 'text', contract: Text.contract } } } };
    expect(paths(validateRuntime(input, catalog))).toContain('/screens/home/body/type');
    input.dependencies = [{ package: 'example.ui', export: 'text', version: '^2.0.0', kind: 'widget' }];
    expect(paths(validateRuntime(input, catalog))).toContain('/dependencies/0');
    input.dependencies[0].version = '^1.0.0';
    expect(validateRuntime(input, catalog).success).toBe(true);
    expect(paths(validateRuntime(input, { widgets: catalog.widgets }))).toContain('/dependencies/0');
  });
  it('checks layout parents and duplicate sibling keys', () => {
    const input = copy(document);
    input.screens.home.body = Column.node({}, { slots: { children: [{ type: 'Positioned', key: 'a' }, { type: 'Positioned', key: 'a' }] } });
    const catalog = { widgets: { ...foundationCatalog.widgets, Positioned: { ...Text.contract, properties: { type: 'object' as const, properties: {}, required: [] }, parents: ['Stack'] } } };
    expect(paths(validateRuntime(input, catalog))).toEqual(expect.arrayContaining(['/screens/home/body/slots/children/0/type', '/screens/home/body/slots/children/1/key']));
  });
  it('rejects expression arity and unknown expression operators', () => {
    const input = copy(document);
    input.screens.home.body = { type: 'Text', props: { text: { $expr: { op: 'if', args: [true] } } } };
    expect(paths(validateRuntime(input, foundationCatalog))).toContain('/screens/home/body/props/text');
    input.screens.home.body.props!.text = { $expr: { op: 'eval', args: ['process.exit()'] } };
    expect(validateRuntime(input, foundationCatalog).success).toBe(false);
  });
  it('checks action and navigation references before execution', () => {
    const input = copy(document);
    input.actions.invalid = { kind: 'navigate', mode: 'push', screen: 'missing', params: {} };
    input.actions.loop = { kind: 'run', action: 'loop' };
    expect(paths(validateRuntime(input, foundationCatalog))).toEqual(expect.arrayContaining(['/actions/invalid/screen', '/actions/loop/action']));
  });
  it('rejects incompatible typed bindings and escaping assets', () => {
    const input = copy(document);
    input.state.count = { schema: { type: 'number' }, initial: 0 };
    input.screens.home.body = { type: 'Text', props: { text: { $ref: { scope: 'state', path: ['count'] } } } };
    expect(paths(validateRuntime(input, foundationCatalog))).toContain('/screens/home/body/props/text');
    input.screens.home.body.props!.text = { $asset: '../outside.svg' };
    expect(validateRuntime(input, foundationCatalog).success).toBe(false);
  });
  it('accepts declarative event actions, typed state assignment, and navigation parameters', () => {
    const input = copy(document);
    input.state.count = { schema: { type: 'number' }, initial: 0 };
    input.screens.detail = { params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, state: {}, body: Text.node({ text: 'Detail' }) };
    input.screens.home.body = { type: 'TestButton', events: { click: { kind: 'sequence', steps: [
      { kind: 'set', path: ['count'], value: 1 },
      { kind: 'navigate', mode: 'push', screen: 'detail', params: { id: 'asset-id' } },
    ] } } };
    const catalog = { widgets: { ...foundationCatalog.widgets, TestButton: { ...Text.contract, properties: { type: 'object' as const, properties: {}, required: [] }, defaults: {}, events: { click: { type: 'null' as const } } } } };
    expect(validateRuntime(input, catalog).success).toBe(true);
    input.screens.home.body.events!.click = { kind: 'navigate', mode: 'push', screen: 'detail', params: { id: 42 } };
    expect(paths(validateRuntime(input, catalog))).toContain('/screens/home/body/events/click/params/id');
  });
});

describe('static package contract', () => {
  it('accepts runtime-only and mixed provider packages', () => {
    expect(validatePackage(manifest).success).toBe(true);
    const mixed: PackageManifest = {
      ...manifest as PackageManifest, contributions: { runtime: 'ui/run.json', widgets: 'compiled/types.cjs', styling: 'compiled/styling.cjs' },
      exports: [manifest.exports[0] as PackageManifest['exports'][0],
        { kind: 'widget', id: 'text', contract: { ...Text.contract, example: { type: 'example.notes/text', props: { text: 'hello' } } } },
        { kind: 'styling', id: 'dark', tokens: { type: 'object', properties: {}, required: [] }, targets: [] }],
    };
    expect(validatePackage(mixed).success).toBe(true);
    mixed.contributions = { widgets: 'types.cjs' }; mixed.exports = [mixed.exports[1]];
    expect(validatePackage(mixed).success).toBe(true);
  });
  it.each(['../escape.cjs', '/absolute.cjs', 'C:/absolute.cjs', 'nested\\types.cjs', 'a/../../b.cjs', 'types.cjs?x'])('rejects escaping or invalid entry %s', path => {
    expect(paths(validatePackage({ ...manifest, contributions: { widgets: path } }))).toContain('/contributions/widgets');
  });
  it('rejects empty/legacy contributions, missing/duplicate exports, and invalid versions', () => {
    expect(paths(validatePackage({ ...manifest, contributions: {} }))).toContain('/contributions');
    expect(paths(validatePackage({ ...manifest, main: 'old.js' }))).toContain('/main');
    expect(paths(validatePackage({ ...manifest, sdk: '^99.0.0' }))).toContain('/sdk');
    expect(paths(validatePackage({ ...manifest, version: 'next' }))).toContain('/version');
    expect(paths(validatePackage({ ...manifest, exports: [] }))).toContain('/exports');
    expect(paths(validatePackage({ ...manifest, exports: [...manifest.exports, ...manifest.exports] }))).toContain('/exports/1/id');
  });
});

describe('serialization boundary', () => {
  it.each([undefined, () => 1, NaN, Infinity, 1n, new Date(), new Map()])('rejects non-JSON values', value => {
    expect(serializableDiagnostics({ value })[0].path).toBe('/value');
  });
  it('rejects cycles and getters without invoking them', () => {
    const cyclic: unknown[] = []; cyclic.push(cyclic);
    expect(serializableDiagnostics(cyclic)).toHaveLength(1);
    let called = false;
    expect(serializableDiagnostics({ get value() { called = true; return 1; } })).toHaveLength(1);
    expect(called).toBe(false);
  });
  it('rejects a handler closure with its exact path', () => {
    const input = copy(document) as RuntimeDocument;
    (input.screens.home.body as unknown as { events: unknown }).events = { click: () => {} };
    expect(paths(validateRuntime(input, foundationCatalog))).toContain('/screens/home/body/events/click');
  });
});
