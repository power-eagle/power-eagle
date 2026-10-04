import type { DataSchema, Json, RuntimeDocument } from '../schema/model';
import { LanguageError, validateData } from '../schema/validate';

export type StateDeclarations = RuntimeDocument['state'];
export type StateListener = () => void;
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const clone = <T,>(value: T): T => structuredClone(value);

/** A typed state namespace. Child scopes shadow document state by top-level key. */
export class StateScope {
  readonly id: string;
  readonly declarations: StateDeclarations;
  readonly parent?: StateScope;
  #values: Record<string, Json>;
  #listeners = new Set<StateListener>();
  #disposed = false;

  constructor(id: string, declarations: StateDeclarations, parent?: StateScope) {
    this.id = id;
    this.declarations = declarations;
    this.parent = parent;
    this.#values = Object.fromEntries(Object.entries(declarations).map(([key, entry]) => [key, clone(entry.initial)]));
  }

  get disposed(): boolean { return this.#disposed; }

  schema(key: string): DataSchema | undefined {
    return this.declarations[key]?.schema ?? this.parent?.schema(key);
  }

  has(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.declarations, key) || Boolean(this.parent?.has(key));
  }

  read(path: Array<string | number> = []): Json {
    this.assertActive();
    if (!path.length) return this.snapshot();
    const [head, ...tail] = path;
    if (typeof head !== 'string') throw new LanguageError([{ path: '/state', code: 'state-path', message: 'State paths begin with a declared name' }]);
    let value: Json;
    if (Object.prototype.hasOwnProperty.call(this.declarations, head)) value = this.#values[head];
    else if (this.parent) return this.parent.read(path);
    else throw new LanguageError([{ path: `/state/${head}`, code: 'state-path', message: 'Unknown state value' }]);
    for (const part of tail) {
      if (typeof part === 'string' && forbidden.has(part)) throw new LanguageError([{ path: `/state/${path.join('/')}`, code: 'state-path', message: 'Reserved state path' }]);
      if (Array.isArray(value) && typeof part === 'number' && part < value.length) value = value[part];
      else if (value && typeof value === 'object' && !Array.isArray(value) && typeof part === 'string' && Object.prototype.hasOwnProperty.call(value, part)) value = value[part];
      else throw new LanguageError([{ path: `/state/${path.join('/')}`, code: 'state-path', message: 'State path does not exist' }]);
    }
    return clone(value);
  }

  snapshot(): Record<string, Json> {
    this.assertActive();
    return { ...(this.parent?.snapshot() ?? {}), ...clone(this.#values) };
  }

  write(path: Array<string | number>, value: Json): void {
    this.assertActive();
    if (!path.length || typeof path[0] !== 'string') throw new LanguageError([{ path: '/state', code: 'state-path', message: 'State writes require a declared top-level name' }]);
    const [head, ...tail] = path as [string, ...(string | number)[]];
    if (!Object.prototype.hasOwnProperty.call(this.declarations, head)) {
      if (this.parent?.has(head)) { this.parent.write(path, value); return; }
      throw new LanguageError([{ path: `/state/${head}`, code: 'state-path', message: 'Unknown state target' }]);
    }
    const next = clone(this.#values[head]);
    let root: Json = next;
    if (!tail.length) root = clone(value);
    else {
      let cursor: Json = next;
      for (let index = 0; index < tail.length - 1; index += 1) {
        const part = tail[index];
        if (typeof part === 'string' && forbidden.has(part)) throw new LanguageError([{ path: `/state/${path.join('/')}`, code: 'state-path', message: 'Reserved state path' }]);
        if (Array.isArray(cursor) && typeof part === 'number' && part < cursor.length) cursor = cursor[part];
        else if (cursor && typeof cursor === 'object' && !Array.isArray(cursor) && typeof part === 'string' && Object.prototype.hasOwnProperty.call(cursor, part)) cursor = cursor[part];
        else throw new LanguageError([{ path: `/state/${path.join('/')}`, code: 'state-path', message: 'State path does not exist' }]);
      }
      const last = tail[tail.length - 1];
      if (typeof last === 'string' && forbidden.has(last)) throw new LanguageError([{ path: `/state/${path.join('/')}`, code: 'state-path', message: 'Reserved state path' }]);
      if (Array.isArray(cursor) && typeof last === 'number' && last < cursor.length) cursor[last] = clone(value);
      else if (cursor && typeof cursor === 'object' && !Array.isArray(cursor) && typeof last === 'string' && Object.prototype.hasOwnProperty.call(cursor, last)) cursor[last] = clone(value);
      else throw new LanguageError([{ path: `/state/${path.join('/')}`, code: 'state-path', message: 'State path does not exist' }]);
    }
    const diagnostics = validateData(this.declarations[head].schema, root, `/state/${head}`);
    if (diagnostics.length) throw new LanguageError(diagnostics);
    this.#values[head] = root;
    this.#listeners.forEach(listener => listener());
  }

  subscribe(listener: StateListener): () => void {
    this.assertActive();
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }

  dispose(): void {
    this.#disposed = true;
    this.#listeners.clear();
  }

  private assertActive(): void {
    if (this.#disposed) throw new Error(`State scope ${this.id} is disposed`);
  }
}
