import { describe, expect, it, vi } from 'vitest';
import type { Action, Json, RuntimeDocument } from '../schema/model';
import { StateScope } from '../state/store';
import { ActionDispatcher, type ActionContext, type ActionNavigator, type RuntimeAdapters } from './actions';
import { ActivationScope } from './lifecycle';

const tagged = (value: unknown) => value as Json;
const document: RuntimeDocument = {
  format: 'power-eagle/runtime', formatVersion: 1, start: 'home', dependencies: [], components: {},
  state: { count: { schema: { type: 'number' }, initial: 0 }, message: { schema: { type: 'string' }, initial: '' } },
  screens: { home: { params: { type: 'object', properties: {}, required: [] }, state: {}, body: { type: 'Text', props: { text: 'x' } } } },
  actions: {},
};
const navigator: ActionNavigator = { navigate: vi.fn(async () => {}), back: vi.fn(async () => true) };
function setup(adapters: RuntimeAdapters = {}) {
  const state = new StateScope('actions', document.state);
  const activation = new ActivationScope('actions');
  const context: ActionContext = { state, activation };
  return { state, activation, context, dispatcher: new ActionDispatcher(document, navigator, adapters) };
}
describe('declarative action dispatch', () => {
  it('executes conditions and sequences with the previous typed result', async () => {
    const invoke = vi.fn(async (args: Json) => Number(args) + 1);
    const { dispatcher, context, state } = setup({ calls: { 'test.api/increment': { input: { type: 'number' }, output: { type: 'number' }, invoke } } });
    const action: Action = { kind: 'sequence', steps: [
      { kind: 'call', target: 'test.api/increment', args: 4 },
      { kind: 'if', condition: tagged({ $expr: { op: 'eq', args: [tagged({ $ref: { scope: 'result', path: [] } }), 5] } }), then: { kind: 'set', path: ['count'], value: tagged({ $ref: { scope: 'result', path: [] } }) } },
    ] };
    await expect(dispatcher.dispatch(action, context)).resolves.toBe(5);
    expect(state.read(['count'])).toBe(5);
  });

  it('stops a sequence on unhandled failure', async () => {
    const { dispatcher, context, state } = setup({ calls: { 'test.api/fail': { input: { type: 'null' }, output: { type: 'null' }, invoke: async () => { throw new Error('failure'); } } } });
    const action: Action = { kind: 'sequence', steps: [
      { kind: 'set', path: ['count'], value: 1 }, { kind: 'call', target: 'test.api/fail', args: null }, { kind: 'set', path: ['count'], value: 2 },
    ] };
    await expect(dispatcher.dispatch(action, context)).rejects.toThrow('failure');
    expect(state.read(['count'])).toBe(1);
  });

  it('runs an explicit error branch with a structured error binding', async () => {
    const { dispatcher, context, state } = setup({ request: async () => { throw new Error('offline'); } });
    const action: Action = { kind: 'request', method: 'GET', url: 'https://example.invalid', error: {
      kind: 'set', path: ['message'], value: tagged({ $ref: { scope: 'error', path: ['message'] } }),
    } };
    await dispatcher.dispatch(action, context);
    expect(state.read(['message'])).toBe('offline');
  });

  it('keeps parallel results isolated and returns them in declaration order', async () => {
    const resolvers = new Map<number, (value: Json) => void>();
    const invoke = (args: Json) => new Promise<Json>(resolve => resolvers.set(Number(args), resolve));
    const { dispatcher, context } = setup({ calls: { 'test.api/wait': { input: { type: 'number' }, output: { type: 'number' }, invoke } } });
    const pending = dispatcher.dispatch({ kind: 'parallel', steps: [
      { kind: 'call', target: 'test.api/wait', args: 1 }, { kind: 'call', target: 'test.api/wait', args: 2 },
    ] }, context);
    await Promise.resolve();
    resolvers.get(2)!(20); resolvers.get(1)!(10);
    await expect(pending).resolves.toEqual([10, 20]);
  });

  it('validates registered call arguments and results', async () => {
    const invoke = vi.fn(async () => 'wrong type');
    const { dispatcher, context } = setup({ calls: { 'test.api/number': { input: { type: 'number' }, output: { type: 'number' }, invoke } } });
    await expect(dispatcher.dispatch({ kind: 'call', target: 'test.api/number', args: 'wrong' }, context)).rejects.toThrow('/action/args');
    expect(invoke).not.toHaveBeenCalled();
    await expect(dispatcher.dispatch({ kind: 'call', target: 'test.api/number', args: 1 }, context)).rejects.toThrow('/action/result');
  });

  it('passes evaluated requests through the controlled adapter', async () => {
    const request = vi.fn(async () => ({ status: 200 }));
    const { dispatcher, context } = setup({ request });
    await expect(dispatcher.dispatch({ kind: 'request', method: 'POST', url: 'https://example.test', headers: { accept: 'application/json' }, body: { ok: true } }, context)).resolves.toEqual({ status: 200 });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', body: { ok: true }, signal: expect.any(AbortSignal) }));
  });

  it('publishes named action loading and success state for bindings', async () => {
    let finish!: (value: Json) => void;
    const withAction = { ...document, actions: { named: { kind: 'call' as const, target: 'test.api/wait', args: null } } };
    const state = new StateScope('status', document.state);
    const context: ActionContext = { state, activation: new ActivationScope('status'), action: {} };
    const changed = vi.fn();
    const dispatcher = new ActionDispatcher(withAction, navigator, { calls: {
      'test.api/wait': { input: { type: 'null' }, output: { type: 'string' }, invoke: () => new Promise<Json>(resolve => { finish = resolve; }) },
    } }, changed);
    const pending = dispatcher.dispatch({ kind: 'run', action: 'named' }, context);
    await Promise.resolve();
    expect(context.action?.named).toEqual({ status: 'loading', result: null, error: null });
    finish('done');
    await expect(pending).resolves.toBe('done');
    expect(context.action?.named).toEqual({ status: 'success', result: 'done', error: null });
    expect(changed).toHaveBeenCalledTimes(2);
  });
});
