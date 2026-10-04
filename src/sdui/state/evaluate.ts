import type { Json } from '../schema/model';
import { StateScope } from './store';

export interface ValueContext {
  state: StateScope;
  input?: Record<string, Json>;
  params?: Record<string, Json>;
  item?: Json;
  event?: Json;
  result?: Json;
  error?: Json;
  action?: Record<string, Json>;
  asset?: (relative: string) => string;
}

export class ExpressionError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path || '/'}: ${message}`);
    this.name = 'ExpressionError';
  }
}

const own = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);
const pointer = (path: string, key: string | number) => `${path}/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;
const isRecord = (value: unknown): value is Record<string, Json> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const equal = (left: Json, right: Json): boolean => {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, index) => equal(item, right[index]));
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left).sort(); const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && equal(left[key], right[key]));
  }
  return false;
};

function lookup(value: Json | undefined, parts: Array<string | number>, path: string): Json {
  let current = value;
  for (const part of parts) {
    if (Array.isArray(current) && typeof part === 'number' && part < current.length) current = current[part];
    else if (isRecord(current) && typeof part === 'string' && own(current, part)) current = current[part];
    else throw new ExpressionError(path, `Reference path ${parts.join('.')} does not exist`);
  }
  if (current === undefined) throw new ExpressionError(path, 'Reference scope is unavailable');
  return structuredClone(current);
}

function expectValue(condition: unknown, path: string, message: string): asserts condition {
  if (!condition) throw new ExpressionError(path, message);
}
const number = (value: Json, path: string): number => { expectValue(typeof value === 'number' && Number.isFinite(value), path, 'Expected a finite number'); return value; };

export function evaluate(value: Json, context: ValueContext, path = ''): Json {
  if (Array.isArray(value)) return value.map((item, index) => evaluate(item, context, pointer(path, index)));
  if (!isRecord(value)) return value;
  if (own(value, '$ref')) {
    const tagged = value as unknown as { $ref: { scope: keyof Omit<ValueContext, 'asset'>; path: Array<string | number> } };
    const source = tagged.$ref.scope === 'state' ? context.state.read(tagged.$ref.path) : context[tagged.$ref.scope];
    return tagged.$ref.scope === 'state' ? source as Json : lookup(source as Json | undefined, tagged.$ref.path, path);
  }
  if (own(value, '$asset')) {
    const relative = (value as unknown as { $asset: string }).$asset;
    return context.asset ? context.asset(relative) : relative;
  }
  if (own(value, '$expr')) return expression((value as unknown as { $expr: { op: string; args: Json[] } }).$expr, context, path);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, evaluate(item, context, pointer(path, key))])) as Json;
}

function expression(expr: { op: string; args: Json[] }, context: ValueContext, path: string): Json {
  const argPath = (index: number) => `${path}/$expr/args/${index}`;
  const get = (index: number) => evaluate(expr.args[index], context, argPath(index));
  const args = () => expr.args.map((_, index) => get(index));
  switch (expr.op) {
    case 'if': return get(0) ? get(1) : get(2);
    case 'and': for (let index = 0; index < expr.args.length; index += 1) if (!get(index)) return false; return true;
    case 'or': for (let index = 0; index < expr.args.length; index += 1) if (get(index)) return true; return false;
    case 'not': return !get(0);
    case 'get': {
      const subject = get(0); const key = get(1);
      expectValue((typeof key === 'string' || (typeof key === 'number' && Number.isInteger(key) && key >= 0)), argPath(1), 'Property key must be a string or nonnegative integer');
      return lookup(subject, [key], path);
    }
    case 'format': {
      const values = args(); const template = values.shift();
      expectValue(typeof template === 'string', argPath(0), 'Format template must be a string');
      return template.replace(/\{(\d+)\}/g, (_match: string, index: string) => {
        const replacement = values[Number(index)];
        if (replacement === undefined) throw new ExpressionError(path, `Missing format argument ${index}`);
        return typeof replacement === 'string' ? replacement : JSON.stringify(replacement);
      });
    }
    case 'eq': return equal(get(0), get(1));
    case 'ne': return !equal(get(0), get(1));
    case 'lt': case 'lte': case 'gt': case 'gte': {
      const left = get(0); const right = get(1);
      expectValue((typeof left === 'number' && typeof right === 'number') || (typeof left === 'string' && typeof right === 'string'), path, 'Comparison operands must have the same string or number type');
      if (expr.op === 'lt') return left < right;
      if (expr.op === 'lte') return left <= right;
      if (expr.op === 'gt') return left > right;
      return left >= right;
    }
    case 'add': return number(get(0), argPath(0)) + number(get(1), argPath(1));
    case 'subtract': return number(get(0), argPath(0)) - number(get(1), argPath(1));
    case 'multiply': return number(get(0), argPath(0)) * number(get(1), argPath(1));
    case 'divide': {
      const divisor = number(get(1), argPath(1)); expectValue(divisor !== 0, argPath(1), 'Division by zero');
      return number(get(0), argPath(0)) / divisor;
    }
    case 'length': {
      const subject = get(0); expectValue(typeof subject === 'string' || Array.isArray(subject) || isRecord(subject), argPath(0), 'Length requires a string, array, or object');
      return typeof subject === 'string' || Array.isArray(subject) ? subject.length : Object.keys(subject).length;
    }
    case 'concat': {
      const values = args();
      if (values.every(item => typeof item === 'string')) return values.join('');
      expectValue(values.every(Array.isArray), path, 'Concat requires all strings or all arrays');
      return values.flat() as Json;
    }
    case 'map': case 'filter': {
      const collection = get(0); expectValue(Array.isArray(collection), argPath(0), `${expr.op} requires an array`);
      if (expr.op === 'map') return collection.map((item, index) => evaluate(expr.args[1], { ...context, item, input: { ...(context.input ?? {}), index } }, argPath(1)));
      return collection.filter((item, index) => Boolean(evaluate(expr.args[1], { ...context, item, input: { ...(context.input ?? {}), index } }, argPath(1))));
    }
    default: throw new ExpressionError(path, `Unknown expression operator ${expr.op}`);
  }
}
