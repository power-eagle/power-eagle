import type { Json, RuntimeDocument } from '../schema/model';
import { LanguageError, validateData } from '../schema/validate';
import { StateScope } from '../state/store';
import { ActivationScope } from './lifecycle';

export interface ViewFrame {
  readonly id: number;
  readonly screen: string;
  readonly params: Record<string, Json>;
  readonly state: StateScope;
  readonly instances: Map<string, StateScope>;
  readonly actionStatus: Record<string, Json>;
  activation: ActivationScope;
}

export class NavigationStack {
  #nextId = 1;
  #stack: ViewFrame[] = [];
  #listeners = new Set<() => void>();
  constructor(private readonly document: RuntimeDocument, private readonly globalState: StateScope) {
    this.#stack.push(this.create(document.start, {}));
  }
  get current(): ViewFrame { return this.#stack[this.#stack.length - 1]; }
  get entries(): ReadonlyArray<Pick<ViewFrame, 'id' | 'screen' | 'params'>> { return this.#stack.map(({ id, screen, params }) => ({ id, screen, params })); }
  subscribe(listener: () => void): () => void { this.#listeners.add(listener); return () => this.#listeners.delete(listener); }

  async navigate(mode: 'push' | 'replace' | 'reset', screen: string, params: Record<string, Json>): Promise<void> {
    this.validate(screen, params);
    if (mode === 'push') {
      await this.current.activation.dispose();
      this.#stack.push(this.create(screen, params));
    } else if (mode === 'replace') {
      await this.remove(this.#stack.pop()!);
      this.#stack.push(this.create(screen, params));
    } else {
      const old = this.#stack.splice(0);
      for (const frame of old.reverse()) await this.remove(frame);
      this.#stack.push(this.create(screen, params));
    }
    this.emit();
  }

  async back(): Promise<boolean> {
    if (this.#stack.length < 2) return false;
    await this.remove(this.#stack.pop()!);
    const previous = this.current;
    previous.activation = new ActivationScope(`view:${previous.id}:${previous.screen}`);
    this.emit();
    return true;
  }

  reconcileInstances(live: ReadonlySet<string>): void {
    for (const [key, state] of this.current.instances) {
      if (!live.has(key)) { state.dispose(); this.current.instances.delete(key); }
    }
  }

  dispose(): Promise<void> {
    const frames = this.#stack.splice(0).reverse();
    this.#listeners.clear();
    return Promise.all(frames.map(frame => this.remove(frame))).then(() => undefined);
  }

  private create(screen: string, params: Record<string, Json>): ViewFrame {
    const id = this.#nextId++;
    return {
      id, screen, params: structuredClone(params),
      state: new StateScope(`screen:${id}:${screen}`, this.document.screens[screen].state, this.globalState),
      instances: new Map(),
      actionStatus: Object.fromEntries(Object.keys(this.document.actions).map(name => [name, { status: 'idle', result: null, error: null }])),
      activation: new ActivationScope(`view:${id}:${screen}`),
    };
  }

  private validate(screen: string, params: Record<string, Json>): void {
    const definition = this.document.screens[screen];
    if (!definition) throw new LanguageError([{ path: '/screen', code: 'navigation', message: `Unknown screen ${screen}` }]);
    const diagnostics = validateData(definition.params, params, '/params');
    if (diagnostics.length) throw new LanguageError(diagnostics);
  }

  private async remove(frame: ViewFrame): Promise<void> {
    let failure: unknown;
    try { await frame.activation.dispose(); } catch (error) { failure = error; }
    frame.instances.forEach(state => state.dispose());
    frame.instances.clear();
    frame.state.dispose();
    if (failure) throw failure;
  }
  private emit(): void { this.#listeners.forEach(listener => listener()); }
}
