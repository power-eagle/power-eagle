import { describe, expect, it, vi } from 'vitest';
import type { Json, RuntimeDocument } from '../schema/model';
import { Text } from '../authoring/foundation';
import { foundationRuntimeCatalog } from './foundation';
import { DisposedScopeError } from './lifecycle';
import { RuntimeSession } from './session';

const tagged = (value: unknown) => value as Json;
const document: RuntimeDocument = {
  format: 'power-eagle/runtime', formatVersion: 1, start: 'home', dependencies: [], components: {},
  state: { status: { schema: { type: 'string' }, initial: 'idle' } },
  screens: {
    home: { params: { type: 'object', properties: {}, required: [] }, state: { count: { schema: { type: 'number' }, initial: 0 } }, body: Text.node({ text: 'home' }) },
    detail: { params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, state: {}, body: Text.node({ text: 'detail' }) },
  },
  actions: {
    load: { kind: 'request', method: 'GET', url: 'https://example.test', success: { kind: 'set', path: ['status'], value: tagged({ $ref: { scope: 'result', path: [] } }) } },
    acquire: { kind: 'call', target: 'test.service/resource', args: null },
  },
};
const catalog = { ...foundationRuntimeCatalog, exports: {
  'test.service/resource': { version: '1.0.0', descriptor: { kind: 'service' as const, id: 'resource', methods: { open: { input: { type: 'null' as const }, output: { type: 'null' as const } } } } },
} };
const configured = { ...document, dependencies: [{ package: 'test.service', export: 'resource', version: '^1.0.0', kind: 'service' as const }] };
describe('navigation and view lifetime', () => {
  it('preserves a pushed screen state for back and replaces/resets removed frames', async () => {
    const session = new RuntimeSession(configured, catalog);
    const homeState = session.navigation.current.state;
    homeState.write(['count'], 7);
    await session.navigation.navigate('push', 'detail', { id: 'one' });
    expect(session.navigation.entries.map(item => item.screen)).toEqual(['home', 'detail']);
    await session.navigation.back();
    expect(session.navigation.current.state).toBe(homeState);
    expect(session.navigation.current.state.read(['count'])).toBe(7);
    await session.navigation.navigate('replace', 'detail', { id: 'two' });
    expect(homeState.disposed).toBe(true);
    await session.navigation.navigate('reset', 'home', {});
    expect(session.navigation.entries.map(item => item.screen)).toEqual(['home']);
    await session.dispose();
  });

  it('validates navigation parameters before changing the stack', async () => {
    const session = new RuntimeSession(configured, catalog);
    await expect(session.navigation.navigate('push', 'detail', { id: 42 } as unknown as Record<string, Json>)).rejects.toThrow('/params/id');
    expect(session.navigation.current.screen).toBe('home');
    await session.dispose();
  });

  it('prevents late async results from writing into a replacement view', async () => {
    let resolve!: (value: Json) => void;
    const request = vi.fn(() => new Promise<Json>(done => { resolve = done; }));
    const session = new RuntimeSession(configured, catalog, { request });
    const pending = session.run('load');
    await Promise.resolve();
    await session.navigation.navigate('replace', 'detail', { id: 'new' });
    resolve('late');
    await expect(pending).rejects.toBeInstanceOf(DisposedScopeError);
    expect(session.globalState.read(['status'])).toBe('idle');
    await session.dispose();
  });

  it('disposes resources registered by calls when a view ends', async () => {
    const dispose = vi.fn();
    const session = new RuntimeSession(configured, catalog, { calls: {
      'test.service/resource': { input: { type: 'null' }, output: { type: 'null' }, invoke: async (_args, context) => { context.use(dispose); return null; } },
    } });
    await session.run('acquire');
    await session.navigation.navigate('push', 'detail', { id: 'next' });
    expect(dispose).toHaveBeenCalledOnce();
    await session.dispose();
  });
});
