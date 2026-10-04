import type { Action, DataSchema, Json, Node, ObjectContract, RuntimeDocument, WidgetContract } from '../schema/model';
import { LanguageError, serializableDiagnostics, unwrap, validateRuntime, type ValidationCatalog } from '../schema/validate';

declare const valueType: unique symbol;
export type Binding<T> = ({ $ref: { scope: 'state' | 'input' | 'params' | 'item' | 'event' | 'result' | 'error' | 'action'; path: Array<string | number> } }
  | { $expr: { op: string; args: Json[] } }) & { readonly [valueType]?: T };
export type Bound<T> = T | Binding<T>;
export type InferData<S extends DataSchema> =
  S extends { type: 'string' } ? string : S extends { type: 'number' } ? number : S extends { type: 'boolean' } ? boolean :
  S extends { type: 'null' } ? null : S extends { type: 'enum'; values: infer V extends readonly unknown[] } ? V[number] :
  S extends { type: 'array'; items: infer I extends DataSchema } ? InferData<I>[] :
  S extends { type: 'object'; properties: infer P extends Record<string, DataSchema>; required: infer R extends readonly string[] }
    ? { [K in keyof P as K extends R[number] ? K : never]: Bound<InferData<P[K]>> } & { [K in keyof P as K extends R[number] ? never : K]?: Bound<InferData<P[K]>> }
    : Json;

export function ref<T = Json>(scope: 'state' | 'input' | 'params' | 'item' | 'event' | 'result' | 'error' | 'action', ...path: Array<string | number>): Binding<T> {
  return { $ref: { scope, path } };
}
export function expression<T = Json>(op: string, ...args: Json[]): Binding<T> {
  return { $expr: { op, args } };
}
export function set(path: string | Array<string | number>, value: Json): Action {
  return { kind: 'set', path: typeof path === 'string' ? [path] : path, value };
}
export function sequence(...steps: Action[]): Action { return { kind: 'sequence', steps }; }
export function parallel(...steps: Action[]): Action { return { kind: 'parallel', steps }; }
export function navigate(screen: string, params: Record<string, Json> = {}, mode: 'push' | 'replace' | 'reset' = 'push'): Action {
  return { kind: 'navigate', mode, screen, params };
}
export function call(target: string, args: Json, method?: string): Action {
  return method === undefined ? { kind: 'call', target, args } : { kind: 'call', target, args, method };
}
export function run(action: string): Action { return { kind: 'run', action }; }
export function back(): Action { return { kind: 'back' }; }
export function forEach(node: Node, items: Json, key: Json, empty?: Node): Node {
  return empty ? { ...node, repeat: { items, key }, empty } : { ...node, repeat: { items, key } };
}
export function asset(path: string): { $asset: string } { return { $asset: path }; }
export function defineDocument(document: RuntimeDocument): RuntimeDocument { return document; }

/** Factory types derive from the exact contract published for discovery. */
export function defineWidget<const C extends WidgetContract>(type: string, contract: C) {
  type Slots = { [K in keyof C['slots']]?: C['slots'][K]['cardinality'] extends 'many' ? Node[] : Node };
  return {
    type, contract,
    node(props: InferData<C['properties']>, options: { key?: string; slots?: Slots; events?: Partial<Record<keyof C['events'], Action>> } = {}): Node {
      return { type, props: props as Record<string, Json>, ...options } as Node;
    },
  };
}
export function defineComponent<const I extends ObjectContract, const S extends RuntimeDocument['components'][string]['slots']>(
  name: string, definition: { inputs: I; slots: S; state: RuntimeDocument['state']; body: Node },
) {
  type Slots = { [K in keyof S]?: S[K]['cardinality'] extends 'many' ? Node[] : Node };
  return {
    name, definition,
    instance(key: string, inputs: InferData<I>, slots: Slots = {}): Node {
      return clone({ type: `component:${name}`, key, props: inputs, slots }) as Node;
    },
  };
}
function clone<T>(value: T): T {
  const diagnostics = serializableDiagnostics(value);
  if (diagnostics.length) throw new LanguageError(diagnostics);
  return JSON.parse(canonical(value)) as T;
}
export function canonical(value: unknown): string {
  const diagnostics = serializableDiagnostics(value);
  if (diagnostics.length) throw new LanguageError(diagnostics);
  function sort(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sort);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, sort(item)]));
    return value;
  }
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}
export function compile(document: RuntimeDocument, catalog: ValidationCatalog): string {
  return canonical(unwrap(validateRuntime(document, catalog)));
}
