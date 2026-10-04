import { afterAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import document from '../../../examples/runtime-only/document';
import { compile, defineComponent } from './index';
import { foundationCatalog, Text } from './foundation';
import { emitRuntime } from '../tooling/emit';
import { validateRuntime } from '../schema/validate';

const directory = await mkdtemp(join(tmpdir(), 'power-eagle-authoring-'));
afterAll(async () => {
  const part = relative(tmpdir(), directory);
  if (!part.startsWith('power-eagle-authoring-') || part.includes(sep)) throw new Error('Invalid cleanup path');
  await rm(directory, { recursive: true, force: true });
});
describe('typed authoring', () => {
  it('emits deterministic canonical data accepted by the same loader', () => {
    const reordered = Object.fromEntries(Object.entries(document).reverse()) as typeof document;
    expect(compile(reordered, foundationCatalog)).toBe(compile(document, foundationCatalog));
    expect(validateRuntime(JSON.parse(compile(document, foundationCatalog)), foundationCatalog).success).toBe(true);
  });
  it('copies component instance inputs and slots independently', () => {
    const component = defineComponent('Card', { inputs: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] }, slots: {}, state: {}, body: Text.node({ text: 'x' }) });
    const inputs = { title: 'first' };
    const first = component.instance('first', inputs);
    inputs.title = 'second';
    const second = component.instance('second', inputs);
    expect(first.props?.title).toBe('first'); expect(second.props?.title).toBe('second');
    // @ts-expect-error Property types are derived from the widget contract.
    Text.node({ text: 42 });
    // @ts-expect-error Component input types are derived from its input schema.
    component.instance('invalid', { title: false });
  });
  it('does not publish invalid output or overwrite a previous valid artifact', async () => {
    const destination = join(directory, 'run.json');
    await emitRuntime(destination, document, foundationCatalog);
    const before = await readFile(destination, 'utf8');
    const invalid = { ...document, start: 'missing' };
    await expect(emitRuntime(destination, invalid, foundationCatalog)).rejects.toThrow('/start');
    expect(await readFile(destination, 'utf8')).toBe(before);
    await expect(emitRuntime(join(directory, 'bad.json'), invalid, foundationCatalog)).rejects.toThrow();
    expect(await readdir(directory)).toEqual(['run.json']);
  });
});
