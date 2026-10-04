import type { Action, DataSchema, Json, RuntimeDocument } from '../schema/model';
import { LanguageError, validateData } from '../schema/validate';
import { evaluate, ExpressionError, type ValueContext } from '../state/evaluate';
import { DisposedScopeError, type ActivationScope } from './lifecycle';
import type { HostSelectionAdapter } from './selection-adapter';

export interface CallableAdapter {
  input: DataSchema;
  output: DataSchema;
  invoke(args: Json, context: { method?: string; signal: AbortSignal; use(disposer: () => void | Promise<void>): () => void }): Json | Promise<Json>;
}
export interface RequestInput { url: string; method: string; headers?: Record<string, string>; body?: Json; signal: AbortSignal }
export interface RuntimeAdapters {
  calls?: Readonly<Record<string, CallableAdapter>>;
  request?: (input: RequestInput) => Json | Promise<Json>;
  form?: (operation: 'validate' | 'submit' | 'reset', id: string, signal: AbortSignal) => Json | Promise<Json>;
  feedback?: (operation: 'toast' | 'openDialog' | 'closeDialog', id: string, value: Json | undefined, signal: AbortSignal) => Json | Promise<Json>;
  selection?: HostSelectionAdapter;
}
export interface ActionContext extends ValueContext { activation: ActivationScope }
export interface ActionNavigator {
  navigate(mode: 'push' | 'replace' | 'reset', screen: string, params: Record<string, Json>): Promise<void>;
  back(): Promise<boolean>;
}

const transitioned = Symbol('navigation-transition');
const structuredError = (error: unknown): Json => ({
  name: error instanceof Error ? error.name : 'Error',
  message: error instanceof Error ? error.message : String(error),
  ...(error instanceof LanguageError ? { diagnostics: error.diagnostics as unknown as Json } : {}),
});

export class ActionDispatcher {
  constructor(
    private readonly document: RuntimeDocument,
    private readonly navigator: ActionNavigator,
    private readonly adapters: RuntimeAdapters = {},
    private readonly statusChanged: () => void = () => {},
  ) {}

  dispatch(action: Action, context: ActionContext): Promise<Json> {
    return this.execute(action, context, []);
  }

  private async execute(action: Action, context: ActionContext, named: string[]): Promise<Json> {
    context.activation.assertActive();
    try {
      const result = await this.core(action, context, named);
      if (result === transitioned) return null;
      context.activation.assertActive();
      return action.success ? this.execute(action.success, { ...context, result }, named) : result;
    } catch (error) {
      if (error instanceof DisposedScopeError || !context.activation.active) throw error;
      if (!action.error) throw error;
      return this.execute(action.error, { ...context, error: structuredError(error) }, named);
    }
  }

  private async core(action: Action, context: ActionContext, named: string[]): Promise<Json | typeof transitioned> {
    switch (action.kind) {
      case 'set': {
        const value = evaluate(action.value, context, '/action/value');
        context.activation.assertActive();
        context.state.write(action.path, value);
        return value;
      }
      case 'if':
        return this.execute(evaluate(action.condition, context, '/action/condition') ? action.then : action.else ?? { kind: 'sequence', steps: [] }, context, named);
      case 'sequence': {
        let result: Json = context.result ?? null;
        for (const step of action.steps) result = await this.execute(step, { ...context, result }, named);
        return result;
      }
      case 'parallel':
        return Promise.all(action.steps.map(step => this.execute(step, { ...context, result: context.result }, named))) as Promise<Json>;
      case 'call': {
        const adapter = this.adapters.calls?.[action.target];
        if (!adapter) throw new Error(`Unavailable action or service ${action.target}`);
        const args = evaluate(action.args, context, '/action/args');
        const inputErrors = validateData(adapter.input, args, '/action/args');
        if (inputErrors.length) throw new LanguageError(inputErrors);
        const result = await adapter.invoke(args, { method: action.method, signal: context.activation.signal, use: disposer => context.activation.use(disposer) });
        context.activation.assertActive();
        const outputErrors = validateData(adapter.output, result, '/action/result');
        if (outputErrors.length) throw new LanguageError(outputErrors);
        return result;
      }
      case 'request': {
        if (!this.adapters.request) throw new Error('Request adapter is unavailable');
        const url = evaluate(action.url, context, '/action/url');
        if (typeof url !== 'string') throw new ExpressionError('/action/url', 'Request URL must be a string');
        const headers = action.headers && evaluate(action.headers as Json, context, '/action/headers');
        if (headers !== undefined && (!headers || typeof headers !== 'object' || Array.isArray(headers) || Object.values(headers).some(value => typeof value !== 'string'))) throw new ExpressionError('/action/headers', 'Request headers must resolve to strings');
        const result = await this.adapters.request({ url, method: action.method, headers: headers as Record<string, string> | undefined, body: action.body === undefined ? undefined : evaluate(action.body, context, '/action/body'), signal: context.activation.signal });
        context.activation.assertActive();
        return result;
      }
      case 'navigate': {
        const params = evaluate(action.params as Json, context, '/action/params') as Record<string, Json>;
        await this.navigator.navigate(action.mode, action.screen, params);
        return transitioned;
      }
      case 'back':
        await this.navigator.back();
        return transitioned;
      case 'run': {
        if (named.includes(action.action)) throw new Error(`Named action cycle: ${[...named, action.action].join(' -> ')}`);
        const target = this.document.actions[action.action];
        if (!target) throw new Error(`Unknown named action ${action.action}`);
        this.status(context, action.action, 'loading', null, null);
        try {
          const result = await this.execute(target, context, [...named, action.action]);
          this.status(context, action.action, 'success', result, null);
          return result;
        } catch (error) {
          this.status(context, action.action, error instanceof DisposedScopeError ? 'cancelled' : 'error', null, structuredError(error));
          throw error;
        }
      }
      case 'form': {
        if (!this.adapters.form) throw new Error('Form adapter is unavailable');
        const result = await this.adapters.form(action.operation, action.id, context.activation.signal);
        context.activation.assertActive();
        return result;
      }
      case 'feedback': {
        if (!this.adapters.feedback) throw new Error('Feedback adapter is unavailable');
        const result = await this.adapters.feedback(action.operation, action.id, action.value === undefined ? undefined : evaluate(action.value, context, '/action/value'), context.activation.signal);
        context.activation.assertActive();
        return result;
      }
    }
  }

  private status(context: ActionContext, name: string, status: string, result: Json, error: Json): void {
    if (!context.action) return;
    context.action[name] = { status, result, error };
    this.statusChanged();
  }
}

