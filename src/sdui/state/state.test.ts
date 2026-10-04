import { describe, expect, it } from 'vitest';
import type { Json } from '../schema/model';
import { evaluate, ExpressionError } from './evaluate';
import { StateScope } from './store';

const tagged = (value: unknown) => value as Json;
const state = () => new StateScope('test', {
  count: { schema: { type: 'number', integer: true }, initial: 2 },
  active: { schema: { type: 'boolean' }, initial: true },
  items: { schema: { type: 'array', items: { type: 'number' } }, initial: [1, 2, 3] },
  profile: { schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }, initial: { name: 'Eagle' } },
});
describe('typed scoped state and expressions', () => {
  it('validates writes and isolates child scopes', () => {
    const global = state();
    const first = new StateScope('first', { count: { schema: { type: 'number' }, initial: 10 } }, global);
    const second = new StateScope('second', { count: { schema: { type: 'number' }, initial: 20 } }, global);
    first.write(['count'], 11);
    expect(first.read(['count'])).toBe(11);
    expect(second.read(['count'])).toBe(20);
    expect(() => first.write(['count'], '11')).toThrow('/state/count');
    first.write(['active'], false);
    expect(global.read(['active'])).toBe(false);
  });

  it.each([
    ['get', tagged({ $expr: { op: 'get', args: [tagged({ $ref: { scope: 'state', path: ['profile'] } }), 'name'] } }), 'Eagle'],
    ['format', tagged({ $expr: { op: 'format', args: ['{0}:{1}', 'count', tagged({ $ref: { scope: 'state', path: ['count'] } })] } }), 'count:2'],
    ['if', tagged({ $expr: { op: 'if', args: [true, 'yes', 'no'] } }), 'yes'],
    ['boolean', tagged({ $expr: { op: 'and', args: [true, tagged({ $expr: { op: 'not', args: [false] } })] } }), true],
    ['comparison', tagged({ $expr: { op: 'gte', args: [3, 2] } }), true],
    ['arithmetic', tagged({ $expr: { op: 'add', args: [2, tagged({ $expr: { op: 'multiply', args: [3, 4] } })] } }), 14],
    ['length', tagged({ $expr: { op: 'length', args: [tagged({ $ref: { scope: 'state', path: ['items'] } })] } }), 3],
    ['concat', tagged({ $expr: { op: 'concat', args: [[1], [2, 3]] } }), [1, 2, 3]],
  ])('evaluates %s without coercing value types', (_name, expression, expected) => {
    expect(evaluate(expression, { state: state() })).toEqual(expected);
  });

  it('maps and filters with a typed item scope', () => {
    const context = { state: state() };
    const item = tagged({ $ref: { scope: 'item', path: [] } });
    expect(evaluate(tagged({ $expr: { op: 'map', args: [tagged({ $ref: { scope: 'state', path: ['items'] } }), tagged({ $expr: { op: 'multiply', args: [item, 2] } })] } }), context)).toEqual([2, 4, 6]);
    expect(evaluate(tagged({ $expr: { op: 'filter', args: [tagged({ $ref: { scope: 'state', path: ['items'] } }), tagged({ $expr: { op: 'gt', args: [item, 1] } })] } }), context)).toEqual([2, 3]);
  });

  it('reports invalid operations with their expression path', () => {
    expect(() => evaluate(tagged({ $expr: { op: 'divide', args: [1, 0] } }), { state: state() }, '/value')).toThrow('/value/$expr/args/1');
    expect(() => evaluate(tagged({ $expr: { op: 'eval', args: ['danger'] } }), { state: state() }, '/value')).toThrow(ExpressionError);
    expect(() => evaluate(tagged({ $ref: { scope: 'state', path: ['missing'] } }), { state: state() }, '/value')).toThrow('/state/missing');
  });
});
