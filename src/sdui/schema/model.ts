import { z } from 'zod';

export const identifier = z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]*$/);
export const qualifiedId = z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]*\/[A-Za-z][A-Za-z0-9_.-]*$/);
export const relativePath = z.string().min(1).refine(value =>
  !value.includes('\\') && !value.includes(':') && !value.includes('?') && !value.includes('#') &&
  !value.includes('\0') && value.split('/').every(part => part !== '' && part !== '.' && part !== '..'),
  'Expected a package-relative path without traversal, backslashes, or URL syntax');
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export const jsonSchema: z.ZodType<Json> = z.json();

// A closed, serializable contract vocabulary shared by manifest discovery and validation.
export type DataSchema =
  | { type: 'string'; minLength?: number; maxLength?: number; pattern?: string }
  | { type: 'number'; minimum?: number; maximum?: number; integer?: boolean }
  | { type: 'boolean' | 'null' | 'json' }
  | { type: 'enum'; values: Array<string | number | boolean | null> }
  | { type: 'array'; items: DataSchema }
  | ObjectContract;
export interface ObjectContract { type: 'object'; properties: Record<string, DataSchema>; required: string[] }
export const dataSchema: z.ZodType<DataSchema> = z.lazy(() => z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('string'),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().nonnegative().optional(),
    pattern: z.string().optional(),
  }),
  z.strictObject({ type: z.literal('number'), minimum: z.number().optional(), maximum: z.number().optional(), integer: z.boolean().optional() }),
  z.strictObject({ type: z.literal('boolean') }),
  z.strictObject({ type: z.literal('null') }),
  z.strictObject({ type: z.literal('json') }),
  z.strictObject({ type: z.literal('enum'), values: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).min(1) }),
  z.strictObject({ type: z.literal('array'), items: dataSchema }),
  objectSchema,
]));
export const objectSchema = z.strictObject({ type: z.literal('object'), properties: z.record(identifier, dataSchema), required: z.array(identifier) });
export const stateSchema = z.record(identifier, z.strictObject({ schema: dataSchema, initial: jsonSchema }));
export const slotSchema = z.strictObject({ cardinality: z.enum(['one', 'many']), required: z.boolean() });
export const slotsSchema = z.record(identifier, slotSchema);
export const refSchema = z.strictObject({ $ref: z.strictObject({
  scope: z.enum(['state', 'input', 'params', 'item', 'event', 'result', 'error', 'action']),
  path: z.array(z.union([z.string().min(1), z.number().int().nonnegative()])),
}) });
export const operators = ['get', 'format', 'if', 'not', 'and', 'or', 'eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'add', 'subtract', 'multiply', 'divide', 'length', 'map', 'filter', 'concat'] as const;
export type Value = Json | { $ref: z.infer<typeof refSchema>['$ref'] };
// Dollar-prefixed keys are reserved: unknown expression/binding tags cannot become ordinary objects.
export const valueSchema: z.ZodType<Json> = z.lazy(() => z.union([
  z.string(), z.number(), z.boolean(), z.null(), refSchema,
  z.strictObject({ $asset: relativePath }),
  z.strictObject({ $expr: z.strictObject({ op: z.enum(operators), args: z.array(valueSchema) }) }),
  z.array(valueSchema), z.record(z.string().regex(/^[^$].*$/), valueSchema),
]));
export const dependencySchema = z.strictObject({
  package: identifier, version: z.string().min(1), export: identifier,
  kind: z.enum(['runtime', 'widget', 'styling', 'action', 'service']),
});
export type Dependency = z.infer<typeof dependencySchema>;

export interface ActionOutcomes { success?: Action; error?: Action }
export type Action = ActionOutcomes & (
  | { kind: 'set'; path: Array<string | number>; value: Json }
  | { kind: 'if'; condition: Json; then: Action; else?: Action }
  | { kind: 'sequence' | 'parallel'; steps: Action[] }
  | { kind: 'call'; target: string; method?: string; args: Json }
  | { kind: 'request'; url: Json; method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; headers?: Record<string, Json>; body?: Json }
  | { kind: 'navigate'; mode: 'push' | 'replace' | 'reset'; screen: string; params: Record<string, Json> }
  | { kind: 'back' }
  | { kind: 'run'; action: string }
  | { kind: 'form'; operation: 'validate' | 'submit' | 'reset'; id: string }
  | { kind: 'feedback'; operation: 'toast' | 'openDialog' | 'closeDialog'; id: string; value?: Json }
);
export const actionSchema: z.ZodType<Action> = z.lazy(() => {
  const outcomes = { success: actionSchema.optional(), error: actionSchema.optional() };
  return z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('set'), path: z.array(z.union([z.string().min(1), z.number().int().nonnegative()])).min(1), value: valueSchema, ...outcomes }),
    z.strictObject({ kind: z.literal('if'), condition: valueSchema, then: actionSchema, else: actionSchema.optional(), ...outcomes }),
    z.strictObject({ kind: z.enum(['sequence', 'parallel']), steps: z.array(actionSchema), ...outcomes }),
    z.strictObject({ kind: z.literal('call'), target: qualifiedId, method: identifier.optional(), args: valueSchema, ...outcomes }),
    z.strictObject({ kind: z.literal('request'), url: valueSchema, method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']), headers: z.record(z.string(), valueSchema).optional(), body: valueSchema.optional(), ...outcomes }),
    z.strictObject({ kind: z.literal('navigate'), mode: z.enum(['push', 'replace', 'reset']), screen: identifier, params: z.record(identifier, valueSchema), ...outcomes }),
    z.strictObject({ kind: z.literal('back'), ...outcomes }),
    z.strictObject({ kind: z.literal('run'), action: identifier, ...outcomes }),
    z.strictObject({ kind: z.literal('form'), operation: z.enum(['validate', 'submit', 'reset']), id: identifier, ...outcomes }),
    z.strictObject({ kind: z.literal('feedback'), operation: z.enum(['toast', 'openDialog', 'closeDialog']), id: identifier, value: valueSchema.optional(), ...outcomes }),
  ]);
});
export interface Node {
  type: string; key?: string; props?: Record<string, Json>; slots?: Record<string, Node | Node[]>;
  events?: Record<string, Action>; visible?: Json; style?: Record<string, Json>;
  repeat?: { items: Json; key: Json }; empty?: Node;
}
export const nodeSchema: z.ZodType<Node> = z.lazy(() => z.strictObject({
  type: z.string().min(1), key: z.string().min(1).optional(),
  props: z.record(identifier, valueSchema).optional(),
  slots: z.record(identifier, z.union([nodeSchema, z.array(nodeSchema)])).optional(),
  events: z.record(identifier, actionSchema).optional(), visible: valueSchema.optional(),
  style: z.record(identifier, valueSchema).optional(),
  repeat: z.strictObject({ items: valueSchema, key: valueSchema }).optional(),
  empty: nodeSchema.optional(),
}));
export const componentSchema = z.strictObject({ inputs: objectSchema, slots: slotsSchema, state: stateSchema, body: nodeSchema });
export const screenSchema = z.strictObject({ params: objectSchema, state: stateSchema, body: nodeSchema });
export const runtimeSchema = z.strictObject({
  initialize: z.array(identifier).optional(),
  format: z.literal('power-eagle/runtime'), formatVersion: z.literal(1),
  start: identifier, state: stateSchema, screens: z.record(identifier, screenSchema),
  components: z.record(identifier, componentSchema), actions: z.record(identifier, actionSchema),
  dependencies: z.array(dependencySchema),
});
export type RuntimeDocument = z.infer<typeof runtimeSchema>;
export const widgetContractSchema = z.strictObject({
  properties: objectSchema, defaults: z.record(identifier, jsonSchema), slots: slotsSchema,
  events: z.record(identifier, dataSchema), themeHooks: z.array(identifier),
  parents: z.array(z.string()).optional(), example: nodeSchema,
});
export type WidgetContract = z.infer<typeof widgetContractSchema>;
export const callableSchema = z.strictObject({ input: dataSchema, output: dataSchema });
export const exportSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('runtime'), id: identifier, screens: z.array(identifier).min(1) }),
  z.strictObject({ kind: z.literal('widget'), id: identifier, contract: widgetContractSchema }),
  z.strictObject({ kind: z.literal('styling'), id: identifier, tokens: objectSchema, targets: z.array(qualifiedId) }),
  z.strictObject({ kind: z.literal('action'), id: identifier, contract: callableSchema }),
  z.strictObject({ kind: z.literal('service'), id: identifier, methods: z.record(identifier, callableSchema) }),
]);
export const packageSchema = z.strictObject({
  format: z.literal('power-eagle/package'), formatVersion: z.literal(1),
  id: identifier, name: z.string().min(1), version: z.string().min(1), description: z.string(), sdk: z.string().min(1),
  contributions: z.strictObject({ runtime: relativePath.optional(), widgets: relativePath.optional(), styling: relativePath.optional(), actions: relativePath.optional(), services: relativePath.optional() }),
  exports: z.array(exportSchema).min(1), dependencies: z.array(dependencySchema), assets: z.array(relativePath),
  target: z.strictObject({ platform: z.array(z.enum(['win32', 'darwin', 'linux'])).min(1), arch: z.array(z.enum(['x64', 'arm64'])).min(1), node: z.string().min(1) }).optional(),
});
export type PackageManifest = z.infer<typeof packageSchema>;
export type ExportDescriptor = z.infer<typeof exportSchema>;
