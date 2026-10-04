import type { Action, Json, Node, RuntimeDocument, WidgetContract } from '../schema/model';
import { unwrap, validateRuntime, type ValidationCatalog } from '../schema/validate';
import { evaluate, ExpressionError, type ValueContext } from '../state/evaluate';
import { StateScope } from '../state/store';
import { ActionDispatcher, type RuntimeAdapters } from './actions';
import { FormController } from './form-controller';
import { NavigationStack } from './navigation';
import type { FileSelectionOptions, RuntimeSelectionAdapter } from './selection-adapter';

export type RuntimeEvent = (payload?: Json) => Promise<Json>;
export interface ResolvedNode {
  type: string;
  key: string;
  identity?: string;
  props: Record<string, Json>;
  style: Record<string, Json>;
  slots: Record<string, ResolvedNode[]>;
  events: Record<string, RuntimeEvent>;
}
export interface WidgetDefinition {
  contract: WidgetContract;
  render: import('./view').WidgetRenderer;
}
export interface RuntimeCatalog {
  widgets: Readonly<Record<string, WidgetDefinition>>;
  exports?: ValidationCatalog['exports'];
}
interface Projection { node: Node; context: ValueContext; path: string }

const own = (object: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(object, key);
const asJsonObject = (value: Json, path: string): Record<string, Json> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ExpressionError(path, 'Expected an object');
  return value;
};

export class RuntimeSession {
  readonly document: RuntimeDocument;
  readonly globalState: StateScope;
  readonly navigation: NavigationStack;
  readonly actions: ActionDispatcher;
  readonly forms: FormController;
  readonly selection?: RuntimeSelectionAdapter;
  readonly catalog: RuntimeCatalog;
  #listeners = new Set<() => void>();
  #version = 0;
  #screenUnsubscribe?: () => void;
  #instanceSubscriptions = new Map<string, () => void>();

  constructor(input: unknown, catalog: RuntimeCatalog, adapters: RuntimeAdapters = {}, private readonly asset?: (relative: string) => string) {
    const validationCatalog: ValidationCatalog = {
      widgets: Object.fromEntries(Object.entries(catalog.widgets).map(([id, item]) => [id, item.contract])), exports: catalog.exports,
    };
    this.document = unwrap(validateRuntime(input, validationCatalog));
    this.catalog = catalog;
    this.globalState = new StateScope('document', this.document.state);
    this.navigation = new NavigationStack(this.document, this.globalState);
    this.forms = new FormController(adapters.form);
    if (adapters.selection) {
      this.selection = async (request: FileSelectionOptions) => {
        const activation = this.navigation.current.activation;
        activation.assertActive();
        const result = await adapters.selection!({ ...request, signal: activation.signal });
        activation.assertActive();
        return result;
      };
    }
    this.actions = new ActionDispatcher(this.document, this.navigation, { ...adapters, form: (operation, id, signal) => this.forms.run(operation, id, signal) }, () => this.emit());
    this.globalState.subscribe(() => this.emit());
    this.navigation.subscribe(() => { this.bindScreen(); this.emit(); });
    this.bindScreen();
  }

  get version(): number { return this.#version; }
  subscribe = (listener: () => void): (() => void) => { this.#listeners.add(listener); return () => this.#listeners.delete(listener); };
  snapshot = (): number => this.#version;

  resolve(): ResolvedNode | null {
    const frame = this.navigation.current;
    const live = new Set<string>();
    const context: ValueContext = { state: frame.state, params: frame.params, action: frame.actionStatus, asset: this.asset };
    const nodes = this.expand(this.document.screens[frame.screen].body, context, `screen:${frame.screen}`, live);
    frame.instances.forEach((state, identity) => {
      if (live.has(identity) && !this.#instanceSubscriptions.has(identity)) this.#instanceSubscriptions.set(identity, state.subscribe(() => this.emit()));
    });
    for (const [identity, unsubscribe] of this.#instanceSubscriptions) {
      if (!live.has(identity)) { unsubscribe(); this.#instanceSubscriptions.delete(identity); }
    }
    this.navigation.reconcileInstances(live);
    if (!nodes.length) return null;
    return nodes.length === 1 ? nodes[0] : { type: '$fragment', key: `screen:${frame.id}`, props: {}, style: {}, events: {}, slots: { children: nodes } };
  }

  run(action: string, event: Json = null): Promise<Json> {
    const frame = this.navigation.current;
    return this.actions.dispatch({ kind: 'run', action }, {
      state: frame.state, params: frame.params, event, action: frame.actionStatus, asset: this.asset, activation: frame.activation,
    });
  }

  async dispose(): Promise<void> {
    this.#screenUnsubscribe?.();
    this.#instanceSubscriptions.forEach(unsubscribe => unsubscribe());
    this.#instanceSubscriptions.clear();
    this.globalState.dispose();
    this.forms.clear();
    this.#listeners.clear();
    await this.navigation.dispose();
  }

  debugInstances(): ReadonlyMap<string, StateScope> { return this.navigation.current.instances; }

  private expand(node: Node, context: ValueContext, path: string, live: Set<string>, projections?: Record<string, Projection[]>): ResolvedNode[] {
    if (node.repeat) {
      const items = evaluate(node.repeat.items, context, `${path}/repeat/items`);
      if (!Array.isArray(items)) throw new ExpressionError(`${path}/repeat/items`, 'Repeat items must resolve to an array');
      if (!items.length) return node.empty ? this.expand(node.empty, context, `${path}/empty`, live, projections) : [];
      const seen = new Set<string>();
      return items.flatMap((item, index) => {
        const itemContext = { ...context, item, input: { ...(context.input ?? {}), index } };
        const keyValue = evaluate(node.repeat!.key, itemContext, `${path}/repeat/key`);
        if (typeof keyValue !== 'string' && typeof keyValue !== 'number') throw new ExpressionError(`${path}/repeat/key`, 'Repeat key must resolve to a string or number');
        const key = String(keyValue);
        if (seen.has(key)) throw new ExpressionError(`${path}/repeat/key`, `Duplicate repeat key ${key}`);
        seen.add(key);
        return this.expand({ ...node, repeat: undefined, empty: undefined, key }, itemContext, `${path}/repeat:${key}`, live, projections);
      });
    }
    if (node.visible !== undefined && !evaluate(node.visible, context, `${path}/visible`)) return [];
    if (node.type.startsWith('slot:')) {
      return (projections?.[node.type.slice(5)] ?? []).flatMap(projected => this.expand(projected.node, projected.context, projected.path, live));
    }
    if (node.type.startsWith('component:')) {
      const name = node.type.slice(10);
      const component = this.document.components[name];
      if (!component) throw new Error(`Unknown component ${name}`);
      const key = node.key ?? path;
      const identity = `${this.navigation.current.id}:${path}:${key}`;
      live.add(identity);
      let state = this.navigation.current.instances.get(identity);
      if (!state) {
        state = new StateScope(`component:${identity}`, component.state, this.navigation.current.state);
        this.navigation.current.instances.set(identity, state);
      }
      const inputs = this.resolveRecord(node.props ?? {}, context, `${path}/props`);
      const projected = Object.fromEntries(Object.entries(node.slots ?? {}).map(([slot, content]) => [slot,
        (Array.isArray(content) ? content : [content]).map((child, index) => ({ node: child, context, path: `${path}/slots/${slot}/${index}` })),
      ]));
      const children = this.expand(component.body, { ...context, state, input: inputs }, `${identity}/body`, live, projected);
      return [{ type: '$fragment', key, identity, props: {}, style: {}, events: {}, slots: { children } }];
    }
    if (!own(this.catalog.widgets, node.type)) throw new Error(`Unknown widget ${node.type}`);
    const props = this.resolveRecord(node.props ?? {}, context, `${path}/props`);
    const style = this.resolveRecord(node.style ?? {}, context, `${path}/style`);
    const slots = Object.fromEntries(Object.entries(node.slots ?? {}).map(([slot, content]) => [slot,
      (Array.isArray(content) ? content : [content]).flatMap((child, index) => this.expand(child, context, `${path}/slots/${slot}/${child.key ?? index}`, live, projections)),
    ]));
    const activation = this.navigation.current.activation;
    const events = Object.fromEntries(Object.entries(node.events ?? {}).map(([name, action]) => [name, (payload: Json = null) => this.actions.dispatch(action, {
      ...context, event: payload, activation,
    })]));
    return [{ type: node.type, key: node.key ?? path, props, style, slots, events }];
  }

  private resolveRecord(record: Record<string, Json>, context: ValueContext, path: string): Record<string, Json> {
    return asJsonObject(evaluate(record, context, path), path);
  }
  private bindScreen(): void {
    this.#screenUnsubscribe?.();
    this.#screenUnsubscribe = this.navigation.current.state.subscribe(() => this.emit());
  }
  private emit(): void { this.#version += 1; this.#listeners.forEach(listener => listener()); }
}

export function repeat(node: Node, items: Json, key: Json, empty?: Node): Node {
  return empty ? { ...node, repeat: { items, key }, empty } : { ...node, repeat: { items, key } };
}

export function event(action: Action): Action { return action; }
