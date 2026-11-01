import { conversationContext } from './context.js';
import { selectedProvider, type AgentOptions, type AgentProvider, type AgentSettings, type Conversation, type ProviderCatalog } from './types.js';

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

/** Host-neutral request workflow. Persistence and document semantics remain owned by the host. */
export class AgentController {
  #busy = new Set<string>();
  #errors = new Map<string, string>();
  #listeners = new Set<() => void>();
  #version = 0;
  #tail: Promise<unknown> = Promise.resolve();
  #catalogs = new Map<string, { value: ProviderCatalog; expires: number }>();
  #discovery = new Map<string, Promise<void>>();
  readonly options: Readonly<AgentOptions>;
  readonly providers: readonly AgentProvider[];
  constructor(options: AgentOptions) {
    if (new Set(options.providers.map(provider => provider.id)).size !== options.providers.length || options.providers.some(provider => !provider.id)) throw new Error('Provider IDs must be nonempty and unique');
    this.providers = Object.freeze(options.providers.map(provider => Object.freeze({ ...provider,
      adapter: Object.freeze({ generate: provider.adapter.generate.bind(provider.adapter), available: provider.adapter.available.bind(provider.adapter), discover: provider.adapter.discover.bind(provider.adapter) }),
      ...(provider.managed ? { managed: Object.freeze({ ...provider.managed }) } : {}),
    })));
    this.options = Object.freeze({ ...options });
  }
  subscribe = (listener: () => void) => { this.#listeners.add(listener); return () => { this.#listeners.delete(listener); }; };
  snapshot = () => this.#version;
  private emit() { this.#version += 1; this.#listeners.forEach(listener => listener()); }
  private queue<T>(run: () => Promise<T>): Promise<T> { const next = this.#tail.then(run); this.#tail = next.catch(() => {}); return next; }
  record(id: string): Conversation {
    const record = this.options.host.read(id);
    if (record.id !== id) throw new Error('Conversation ownership does not match');
    return copy(record);
  }
  busy(id: string) { return this.#busy.has(id); }
  error(id: string) { return this.#errors.get(id); }
  provider(id: string) { return this.providers.find(provider => provider.id === id); }
  providerCatalog(provider: string): ProviderCatalog | undefined {
    const catalog = this.#catalogs.get(provider)?.value;
    return catalog ? copy(catalog) : undefined;
  }
  async discover(provider: string, refresh = false): Promise<void> {
    const running = this.#discovery.get(provider); if (running) return running;
    if (!refresh && (this.#catalogs.get(provider)?.expires ?? 0) > Date.now()) return;
    const work = Promise.resolve().then(async () => {
      this.#catalogs.set(provider, { value: { state: 'loading', models: this.providerCatalog(provider)?.models ?? [] }, expires: 0 }); this.emit();
      let installed = false;
      try {
        const definition = this.provider(provider);
        if (!definition) throw new Error(`Provider ${provider} is unavailable.`);
        installed = await definition.adapter.available();
        if (!installed) throw new Error(`${definition.label} unavailable. ${definition.setupHint ?? 'Check the provider connection, then reconnect.'}`);
        const models = await definition.adapter.discover();
        this.#catalogs.set(provider, { value: { state: 'ready', installed, models: copy(models) }, expires: Date.now() + 300_000 });
      } catch (error) {
        this.#catalogs.set(provider, { value: { state: 'unavailable', installed, models: [], error: error instanceof Error ? error.message : String(error) }, expires: Date.now() + 10_000 });
      } finally { this.emit(); }
    });
    this.#discovery.set(provider, work);
    try { await work; } finally { this.#discovery.delete(provider); }
  }
  private update(id: string, mutation: (record: Conversation) => void): Promise<Conversation> {
    return this.queue(async () => {
      const record = await this.options.host.update(id, current => {
        if (current.id !== id) throw new Error('Conversation ownership does not match');
        mutation(current);
      });
      if (record.id !== id) throw new Error('Conversation ownership does not match');
      this.emit(); return copy(record);
    });
  }
  draft(id: string, draft: string) { return this.update(id, record => { record.draft = draft; }); }
  context(id: string, key: string, enabled: boolean) { return this.update(id, record => { record.context[key] = enabled; }); }
  settings(id: string, settings: AgentSettings) {
    if (!this.provider(settings.provider)) return Promise.reject(new Error('Provider is unavailable'));
    const captured = copy(settings);
    return this.update(id, record => { record.settings = captured; });
  }
  editRequest(id: string, turnId: number, replaceDraft = false) {
    return this.update(id, record => {
      const turn = record.turns.find(item => item.id === turnId && item.status === 'failed' && !item.hidden);
      if (!turn) throw new Error('Failed request is unavailable');
      if (record.draft.trim() && !replaceDraft) throw new Error('Your draft has been kept. Choose Replace draft to edit this request.');
      record.draft = turn.instruction;
    });
  }
  retry(id: string, turnId: number) { return this.send(id, turnId); }
  async selectBase(id: string, revision: number): Promise<void> {
    await this.queue(async () => { await this.options.host.selectBase(id, revision); this.emit(); });
  }
  async recoverInterrupted(): Promise<void> {
    for (const record of this.options.host.list()) if (record.turns.some(turn => turn.status === 'pending') && !this.busy(record.id)) {
      await this.update(record.id, value => value.turns.forEach(turn => {
        if (turn.status === 'pending') { turn.status = 'failed'; turn.error = 'Generation was interrupted. Your last saved version is intact; retry your instruction.'; }
      }));
    }
  }
  async send(id: string, retryOf?: number): Promise<void> {
    if (this.#busy.has(id)) return;
    this.#busy.add(id); this.#errors.delete(id); this.emit();
    let turnId: number | undefined;
    try {
      const pending = await this.update(id, record => {
        const original = retryOf === undefined ? undefined : record.turns.find(turn => turn.id === retryOf && turn.status === 'failed' && !turn.hidden);
        if (retryOf !== undefined && !original) throw new Error('Failed request is unavailable');
        const instruction = original?.instruction ?? record.draft.trim();
        if (!instruction) throw new Error(this.options.emptyInstructionMessage ?? 'Describe what you want to change.');
        turnId = record.nextTurnId++;
        record.turns.push({ id: turnId, base: original?.base ?? record.selectedBase, instruction, status: 'pending', createdAt: new Date().toISOString(),
          choice: selectedProvider(record.settings), apiContext: { ...(original?.apiContext ?? record.context) },
          ...(original ? { retryOf: original.id, currentFlagsOnRetry: !original.apiContext } : {}),
        });
        if (!original) record.draft = '';
      });
      const turn = pending.turns.find(item => item.id === turnId)!;
      const assembled = conversationContext(await this.options.host.prepare(id, copy(turn)), pending.turns.filter(item => item.id < turn.id), this.options.inputBudget);
      await this.update(id, record => { record.turns.find(item => item.id === turn.id)!.contextInfo = assembled.info; });
      turn.contextInfo = assembled.info;
      const provider = this.provider(turn.choice.provider);
      if (!provider) throw new Error(`Provider ${turn.choice.provider} is unavailable.`);
      if (!provider.managed) {
        await this.discover(provider.id);
        const capabilities = this.providerCatalog(provider.id);
        const selected = capabilities?.models.find(item => turn.choice.model ? item.id === turn.choice.model : item.isDefault);
        if (capabilities?.state === 'ready' && selected && turn.choice.effort && !selected.efforts.includes(turn.choice.effort)) throw new Error('Selected effort is unavailable for this model. Choose a supported effort or Model default in Agent settings.');
      }
      const request = { conversationId: id, turnId: turn.id, base: turn.base, instruction: turn.instruction,
        context: { ...turn.apiContext! }, choice: { ...turn.choice }, prompt: assembled.prompt };
      const response = await (this.options.generate ? this.options.generate(request) : provider.adapter.generate({ ...turn.choice, prompt: assembled.prompt }));
      await this.queue(() => this.options.host.apply(id, copy(turn), response));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (turnId !== undefined) {
        try { await this.update(id, record => { const turn = record.turns.find(item => item.id === turnId); if (!turn) throw new Error('Request was not saved'); turn.status = 'failed'; turn.error = message; }); }
        catch { this.#errors.set(id, message); }
      } else this.#errors.set(id, message);
    } finally { this.#busy.delete(id); this.emit(); }
  }
}
