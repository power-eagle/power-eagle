import { z } from 'zod';
import { valid, validRange, satisfies } from 'semver';
import {
  packageSchema, runtimeSchema, type Action, type DataSchema, type Dependency, type ExportDescriptor,
  type Json, type Node, type ObjectContract, type PackageManifest, type RuntimeDocument, type WidgetContract,
} from './model';

export interface Diagnostic { path: string; code: string; message: string }
export type Validation<T> = { success: true; data: T; diagnostics: [] } | { success: false; diagnostics: Diagnostic[] };
export class LanguageError extends Error {
  constructor(public readonly diagnostics: Diagnostic[]) {
    super(diagnostics.map(d => `${d.path || '/'}: ${d.message}`).join('\n'));
    this.name = 'LanguageError';
  }
}
const escape = (key: string | number) => String(key).replace(/~/g, '~0').replace(/\//g, '~1');
const at = (path: string, key: string | number) => `${path}/${escape(key)}`;
const own = (object: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(object, key);

/** Check before Zod/JSON.stringify: neither may erase executable or otherwise invalid values. */
export function serializableDiagnostics(value: unknown): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const ancestors = new Set<object>();
  function walk(current: unknown, path: string, depth: number) {
    const reject = (message: string) => diagnostics.push({ path, code: 'nonserializable', message });
    if (depth > 128) { reject('Maximum document depth is 128'); return; }
    if (current === null || typeof current === 'string' || typeof current === 'boolean') return;
    if (typeof current === 'number') { if (!Number.isFinite(current)) reject('Numbers must be finite'); return; }
    if (typeof current !== 'object') { reject(`Unsupported ${typeof current} value; use serializable data`); return; }
    if (ancestors.has(current)) { reject('Circular data is not supported'); return; }
    if (!Array.isArray(current) && Object.getPrototypeOf(current) !== Object.prototype && Object.getPrototypeOf(current) !== null) {
      reject('Only plain objects and arrays are serializable'); return;
    }
    ancestors.add(current);
    if (Array.isArray(current) && Object.keys(current).length !== current.length) reject('Sparse or decorated arrays are not supported');
    for (const key of Reflect.ownKeys(current)) {
      if (Array.isArray(current) && key === 'length') continue;
      if (typeof key !== 'string') { reject('Symbol properties are not supported'); continue; }
      const descriptor = Object.getOwnPropertyDescriptor(current, key)!;
      if (!('value' in descriptor) || !descriptor.enumerable) { reject('Accessors and non-enumerable properties are not supported'); continue; }
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        diagnostics.push({ path: at(path, key), code: 'reserved-key', message: `Reserved key ${key}` }); continue;
      }
      walk(descriptor.value, at(path, key), depth + 1);
    }
    ancestors.delete(current);
  }
  walk(value, '', 0);
  return diagnostics;
}

function parse<T>(schema: z.ZodType<T>, value: unknown): Validation<T> {
  const diagnostics = serializableDiagnostics(value);
  if (diagnostics.length) return { success: false, diagnostics };
  const result = schema.safeParse(value);
  if (!result.success) return { success: false, diagnostics: result.error.issues.flatMap<Diagnostic>(issue => {
    const path = issue.path.reduce<string>((base, part) => at(base, String(part)), '');
    return issue.code === 'unrecognized_keys'
      ? issue.keys.map(key => ({ path: at(path, key), code: issue.code, message: 'Unknown field' }))
      : [{ path, code: issue.code, message: issue.message }];
  }) };
  return { success: true, data: result.data, diagnostics: [] };
}

export function validateData(schema: DataSchema, value: Json, path = ''): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const bad = (message: string) => diagnostics.push({ path, code: 'value', message });
  switch (schema.type) {
    case 'json': break;
    case 'null': if (value !== null) bad('Expected null'); break;
    case 'boolean': if (typeof value !== 'boolean') bad('Expected boolean'); break;
    case 'string':
      if (typeof value !== 'string') bad('Expected string');
      else if (value.length < (schema.minLength ?? 0)) bad(`Minimum length is ${schema.minLength}`);
      break;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) bad('Expected finite number');
      else if ((schema.integer && !Number.isInteger(value)) || (schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum)) bad('Number violates its declared bounds');
      break;
    case 'enum': if (!schema.values.includes(value as never)) bad('Value is not in the declared enumeration'); break;
    case 'array':
      if (!Array.isArray(value)) bad('Expected array');
      else value.forEach((item, index) => diagnostics.push(...validateData(schema.items, item, at(path, index))));
      break;
    case 'object':
      if (!value || typeof value !== 'object' || Array.isArray(value)) bad('Expected object');
      else {
        schema.required.forEach(key => { if (!own(value, key)) diagnostics.push({ path: at(path, key), code: 'required', message: 'Missing required field' }); });
        Object.entries(value).forEach(([key, item]) => {
          if (!own(schema.properties, key)) diagnostics.push({ path: at(path, key), code: 'unknown-property', message: 'Unknown property' });
          else diagnostics.push(...validateData(schema.properties[key], item, at(path, key)));
        });
      }
  }
  return diagnostics;
}

function contractDiagnostics(schema: DataSchema, path: string): Diagnostic[] {
  if (schema.type === 'object') return [
    ...schema.required.filter((key, index) => !own(schema.properties, key) || schema.required.indexOf(key) !== index)
      .map(key => ({ path: at(path, 'required'), code: 'schema', message: `Required key ${key} must be declared exactly once` })),
    ...Object.entries(schema.properties).flatMap(([key, child]) => contractDiagnostics(child, at(at(path, 'properties'), key))),
  ];
  if (schema.type === 'array') return contractDiagnostics(schema.items, at(path, 'items'));
  if (schema.type === 'number' && schema.minimum !== undefined && schema.maximum !== undefined && schema.minimum > schema.maximum)
    return [{ path, code: 'schema', message: 'Minimum exceeds maximum' }];
  return [];
}

function dependenciesDiagnostics(dependencies: Dependency[], path: string): Diagnostic[] {
  const seen = new Set<string>();
  return dependencies.flatMap((dependency, index) => {
    const result: Diagnostic[] = [];
    const key = `${dependency.package}/${dependency.export}`;
    if (!validRange(dependency.version)) result.push({ path: `${path}/${index}/version`, code: 'version', message: 'Invalid semantic version range' });
    if (seen.has(key)) result.push({ path: `${path}/${index}`, code: 'duplicate', message: `Duplicate dependency ${key}` });
    seen.add(key);
    return result;
  });
}

export function validatePackage(value: unknown, sdkVersion = '1.0.0'): Validation<PackageManifest> {
  const parsed = parse(packageSchema, value);
  if (!parsed.success) return parsed;
  const manifest = parsed.data;
  const diagnostics = dependenciesDiagnostics(manifest.dependencies, '/dependencies');
  const add = (path: string, message: string) => diagnostics.push({ path, code: 'manifest', message });
  if (!valid(manifest.version)) add('/version', 'Expected a full semantic version');
  if (!validRange(manifest.sdk) || !satisfies(sdkVersion, manifest.sdk)) add('/sdk', `Unsupported host SDK range for ${sdkVersion}`);
  if (manifest.target && !validRange(manifest.target.node)) add('/target/node', 'Invalid Node version range');
  const entries = Object.entries(manifest.contributions);
  if (!entries.length) add('/contributions', 'At least one contribution is required');
  const contributionKeys = { runtime: 'runtime', widget: 'widgets', styling: 'styling', action: 'actions', service: 'services' } as const;
  for (const [key, entry] of entries) {
    if (!(key === 'runtime' ? entry.endsWith('.json') : entry.endsWith('.cjs'))) add(`/contributions/${key}`, key === 'runtime' ? 'Runtime entry must be JSON' : 'Provider entry must be compiled CommonJS (.cjs)');
    if (!manifest.exports.some(item => contributionKeys[item.kind] === key)) add(`/contributions/${key}`, 'Contribution has no declared exports');
  }
  const ids = new Set<string>();
  manifest.exports.forEach((item, index) => {
    const path = `/exports/${index}`;
    if (ids.has(item.id)) add(`${path}/id`, 'Export identities must be unique across contribution kinds');
    ids.add(item.id);
    if (!manifest.contributions[contributionKeys[item.kind]]) add(path, 'Export has no declared contribution entry');
    if (item.kind === 'widget') {
      diagnostics.push(...contractDiagnostics(item.contract.properties, `${path}/contract/properties`));
      const optional = { ...item.contract.properties, required: [] };
      diagnostics.push(...validateData(optional, item.contract.defaults, `${path}/contract/defaults`));
      Object.entries(item.contract.events).forEach(([name, schema]) => diagnostics.push(...contractDiagnostics(schema, `${path}/contract/events/${name}`)));
      if (item.contract.example.type !== `${manifest.id}/${item.id}`) add(`${path}/contract/example/type`, 'Example must name this qualified widget export');
    }
    if (item.kind === 'action') for (const key of ['input', 'output'] as const) diagnostics.push(...contractDiagnostics(item.contract[key], `${path}/contract/${key}`));
    if (item.kind === 'service') Object.entries(item.methods).forEach(([name, method]) => {
      for (const key of ['input', 'output'] as const) diagnostics.push(...contractDiagnostics(method[key], `${path}/methods/${name}/${key}`));
    });
    if (item.kind === 'styling') diagnostics.push(...contractDiagnostics(item.tokens, `${path}/tokens`));
  });
  return diagnostics.length ? { success: false, diagnostics } : parsed;
}

export interface AvailableExport { version: string; descriptor: ExportDescriptor }
export interface ValidationCatalog {
  widgets: Readonly<Record<string, WidgetContract>>;
  exports?: Readonly<Record<string, AvailableExport>>;
}
const emptyObject: ObjectContract = { type: 'object', properties: {}, required: [] };
type Scope = { state: Record<string, DataSchema>; input: ObjectContract; params: ObjectContract; event: boolean; result: boolean; error: boolean; item: boolean; action: boolean };

export function validateRuntime(value: unknown, catalog: ValidationCatalog): Validation<RuntimeDocument> {
  const parsed = parse(runtimeSchema, value);
  if (!parsed.success) return parsed;
  const doc = parsed.data;
  const diagnostics = dependenciesDiagnostics(doc.dependencies, '/dependencies');
  const add = (path: string, message: string, code = 'reference') => diagnostics.push({ path, code, message });
  if (!own(doc.screens, doc.start)) add('/start', 'Start screen does not exist');
  else if (doc.screens[doc.start].params.required.length) add(`/screens/${doc.start}/params`, 'Start screen cannot require navigation parameters');
  for (const [index, dependency] of doc.dependencies.entries()) {
    const id = `${dependency.package}/${dependency.export}`;
    const found = catalog.exports?.[id];
    if (!found) add(`/dependencies/${index}`, `Unavailable export ${id}`);
    else if (found.descriptor.kind !== dependency.kind || !validRange(dependency.version) || !satisfies(found.version, dependency.version)) add(`/dependencies/${index}`, `Export ${id} has an incompatible kind or version`);
  }
  function stateSchema(state: RuntimeDocument['state'], path: string): Record<string, DataSchema> {
    return Object.fromEntries(Object.entries(state).map(([key, entry]) => {
      diagnostics.push(...contractDiagnostics(entry.schema, `${path}/${key}/schema`), ...validateData(entry.schema, entry.initial, `${path}/${key}/initial`));
      return [key, entry.schema];
    }));
  }
  const globalState = stateSchema(doc.state, '/state');
  function bound(value: Json, path: string, scope: Scope): boolean {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.map((child, index) => bound(child, at(path, index), scope)).some(Boolean);
    if ('$ref' in value) {
      const ref = value.$ref as { scope: keyof Scope; path: Array<string | number> };
      if (['event', 'result', 'error', 'item', 'action'].includes(ref.scope)) {
        if (!scope[ref.scope]) add(path, `Binding scope ${ref.scope} is unavailable here`);
      } else {
        let schema: DataSchema = ref.scope === 'state' ? { type: 'object', properties: scope.state, required: [] } : scope[ref.scope] as ObjectContract;
        for (const part of ref.path) {
          if (schema.type === 'json') break;
          if (schema.type === 'array' && typeof part === 'number') schema = schema.items;
          else if (schema.type === 'object' && own(schema.properties, part)) schema = schema.properties[String(part)];
          else { add(path, `Unknown ${ref.scope} reference ${ref.path.join('.')}`); break; }
        }
      }
      return true;
    }
    if ('$asset' in value) return true;
    if ('$expr' in value) {
      const expr = value.$expr as { op: string; args: Json[] };
      const counts: Record<string, number> = { get: 2, if: 3, not: 1, eq: 2, ne: 2, lt: 2, lte: 2, gt: 2, gte: 2, add: 2, subtract: 2, multiply: 2, divide: 2, length: 1, map: 2, filter: 2 };
      if ((counts[expr.op] !== undefined && counts[expr.op] !== expr.args.length) || (['format', 'and', 'or', 'concat'].includes(expr.op) && expr.args.length < 1)) add(path, `Invalid argument count for ${expr.op}`, 'expression');
      expr.args.forEach((arg, index) => bound(arg, `${path}/$expr/args/${index}`, { ...scope, item: scope.item || (['map', 'filter'].includes(expr.op) && index === 1) }));
      return true;
    }
    return Object.entries(value).map(([key, child]) => bound(child, at(path, key), scope)).some(Boolean);
  }
  function properties(schema: ObjectContract, values: Record<string, Json>, path: string, scope: Scope) {
    schema.required.forEach(key => { if (!own(values, key)) add(at(path, key), 'Missing required property', 'required'); });
    Object.entries(values).forEach(([key, item]) => {
      if (!own(schema.properties, key)) add(at(path, key), 'Unknown property', 'unknown-property');
      else if (!bound(item, at(path, key), scope)) diagnostics.push(...validateData(schema.properties[key], item, at(path, key)));
      else if (item && typeof item === 'object' && !Array.isArray(item) && '$ref' in item) {
        const reference = item.$ref as { scope: keyof Scope; path: Array<string | number> };
        let source: DataSchema | undefined = reference.scope === 'state'
          ? { type: 'object', properties: scope.state, required: [] }
          : ['input', 'params'].includes(reference.scope) ? scope[reference.scope] as ObjectContract : undefined;
        const childSchema = (schema: DataSchema | undefined, part: string | number): DataSchema | undefined =>
          schema?.type === 'object' ? schema.properties[String(part)] : schema?.type === 'array' && typeof part === 'number' ? schema.items : undefined;
        for (const part of reference.path) source = childSchema(source, part);
        const target = schema.properties[key];
        if (source && source.type !== 'json' && target.type !== 'json' && source.type !== target.type)
          add(at(path, key), `Binding is ${source.type}, but property requires ${target.type}`, 'binding-type');
      }
    });
  }
  function declared(target: string, path: string, kinds: string[]) {
    const dependency = doc.dependencies.find(dep => `${dep.package}/${dep.export}` === target && kinds.includes(dep.kind));
    if (!dependency) add(path, `Declare a ${kinds.join('/')} dependency on ${target}`);
  }
  function action(item: Action, path: string, scope: Scope, stack: string[] = []) {
    if (item.kind === 'set') {
      if (!own(scope.state, item.path[0])) add(`${path}/path`, 'State target does not exist');
      const dynamic = bound(item.value, `${path}/value`, scope);
      if (!dynamic && item.path.length === 1 && scope.state[String(item.path[0])]) diagnostics.push(...validateData(scope.state[String(item.path[0])], item.value, `${path}/value`));
    }
    if (item.kind === 'if') { bound(item.condition, `${path}/condition`, scope); action(item.then, `${path}/then`, scope, stack); if (item.else) action(item.else, `${path}/else`, scope, stack); }
    if (item.kind === 'sequence' || item.kind === 'parallel') item.steps.forEach((step, index) => action(step, `${path}/steps/${index}`, { ...scope, result: scope.result || (item.kind === 'sequence' && index > 0) }, stack));
    if (item.kind === 'call') { declared(item.target, `${path}/target`, ['action', 'service']); bound(item.args, `${path}/args`, scope); }
    if (item.kind === 'request') { bound(item.url, `${path}/url`, scope); if (item.body !== undefined) bound(item.body, `${path}/body`, scope); if (item.headers) bound(item.headers, `${path}/headers`, scope); }
    if (item.kind === 'navigate') {
      if (!own(doc.screens, item.screen)) add(`${path}/screen`, 'Unknown screen');
      else properties(doc.screens[item.screen].params, item.params, `${path}/params`, scope);
    }
    if (item.kind === 'run') {
      if (!own(doc.actions, item.action)) add(`${path}/action`, 'Unknown named action');
      else if (stack.includes(item.action)) add(`${path}/action`, 'Named action cycle');
      else action(doc.actions[item.action], `/actions/${item.action}`, scope, [...stack, item.action]);
    }
    if (item.kind === 'feedback' && item.value !== undefined) bound(item.value, `${path}/value`, scope);
    if (item.success) action(item.success, `${path}/success`, { ...scope, result: true }, stack);
    if (item.error) action(item.error, `${path}/error`, { ...scope, error: true }, stack);
  }
  function node(item: Node, path: string, scope: Scope, parent?: string, component?: string) {
    let nodeScope = scope;
    if (item.repeat) {
      bound(item.repeat.items, `${path}/repeat/items`, scope);
      bound(item.repeat.key, `${path}/repeat/key`, { ...scope, item: true });
      nodeScope = { ...scope, item: true };
      if (item.empty) node(item.empty, `${path}/empty`, scope, parent, component);
    } else if (item.empty) add(`${path}/empty`, 'Empty content requires repeat');
    if (item.visible !== undefined) bound(item.visible, `${path}/visible`, nodeScope);
    if (item.style) bound(item.style, `${path}/style`, nodeScope);
    if (item.type.startsWith('slot:')) {
      const slot = component && doc.components[component].slots[item.type.slice(5)];
      if (!slot) add(`${path}/type`, 'Unknown component slot');
      if (item.props || item.slots || item.events) add(path, 'Slot insertion cannot declare properties, child slots, or events');
      return;
    }
    const componentName = item.type.startsWith('component:') ? item.type.slice(10) : undefined;
    const definition = componentName && doc.components[componentName];
    if (componentName && !item.key && !item.repeat) add(`${path}/key`, 'Component instances require a stable key');
    const contract = definition ? { properties: definition.inputs, defaults: {}, slots: definition.slots, events: {} } : own(catalog.widgets, item.type) ? catalog.widgets[item.type] : undefined;
    if (!contract) { add(`${path}/type`, `Unknown type ${item.type}`); return; }
    if (item.type.includes('/')) declared(item.type, `${path}/type`, ['widget']);
    if ('parents' in contract && contract.parents?.length && (!parent || !contract.parents.includes(parent))) add(`${path}/type`, `Required parent: ${contract.parents.join(', ')}`, 'parent');
    properties(contract.properties, { ...contract.defaults, ...item.props }, `${path}/props`, nodeScope);
    Object.entries(item.events ?? {}).forEach(([name, handler]) => {
      if (!own(contract.events, name)) add(`${path}/events/${name}`, 'Unknown widget event');
      action(handler, `${path}/events/${name}`, { ...nodeScope, event: true });
    });
    Object.entries(contract.slots).forEach(([name, slot]) => { if (slot.required && !own(item.slots ?? {}, name)) add(`${path}/slots/${name}`, 'Missing required slot'); });
    Object.entries(item.slots ?? {}).forEach(([name, content]) => {
      const slot = contract.slots[name];
      if (!slot) add(`${path}/slots/${name}`, 'Unknown slot');
      else if ((slot.cardinality === 'many') !== Array.isArray(content)) add(`${path}/slots/${name}`, `Expected ${slot.cardinality === 'many' ? 'an array of nodes' : 'one node'}`);
      const children = Array.isArray(content) ? content : [content];
      const keys = new Set<string>();
      children.forEach((child, index) => {
        const childPath = `${path}/slots/${name}${Array.isArray(content) ? `/${index}` : ''}`;
        if (child.key) { if (keys.has(child.key)) add(`${childPath}/key`, 'Duplicate sibling key'); keys.add(child.key); }
        node(child, childPath, nodeScope, item.type, component);
      });
    });
  }
  const base: Scope = { state: globalState, input: emptyObject, params: emptyObject, event: false, result: false, error: false, item: false, action: true };
  Object.entries(doc.screens).forEach(([name, screen]) => {
    diagnostics.push(...contractDiagnostics(screen.params, `/screens/${name}/params`));
    node(screen.body, `/screens/${name}/body`, { ...base, params: screen.params, state: { ...globalState, ...stateSchema(screen.state, `/screens/${name}/state`) } });
  });
  Object.entries(doc.components).forEach(([name, component]) => {
    diagnostics.push(...contractDiagnostics(component.inputs, `/components/${name}/inputs`));
    node(component.body, `/components/${name}/body`, { ...base, input: component.inputs, state: { ...globalState, ...stateSchema(component.state, `/components/${name}/state`) } }, undefined, name);
  });
  function componentReferences(item: Node): string[] {
    return [
      ...(item.type.startsWith('component:') ? [item.type.slice(10)] : []),
      ...Object.values(item.slots ?? {}).flatMap(content => (Array.isArray(content) ? content : [content]).flatMap(componentReferences)),
      ...(item.empty ? componentReferences(item.empty) : []),
    ];
  }
  const visited = new Set<string>();
  function visit(name: string, ancestors: string[]) {
    if (ancestors.includes(name)) { add(`/components/${name}/body`, `Component cycle: ${[...ancestors, name].join(' -> ')}`); return; }
    if (visited.has(name) || !own(doc.components, name)) return;
    componentReferences(doc.components[name].body).forEach(child => visit(child, [...ancestors, name]));
    visited.add(name);
  }
  Object.keys(doc.components).forEach(name => visit(name, []));
  // Validate unused named actions too; named actions operate on document state.
  Object.entries(doc.actions).forEach(([name, item]) => action(item, `/actions/${name}`, { ...base, event: true, result: true, error: true }, [name]));
  return diagnostics.length ? { success: false, diagnostics } : parsed;
}

export function unwrap<T>(result: Validation<T>): T {
  if (!result.success) throw new LanguageError(result.diagnostics);
  return result.data;
}
