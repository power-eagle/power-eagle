import { z } from 'zod';
import { runtimeSchema, type RuntimeDocument } from '../../sdui/schema/model';
import { RuntimeSession } from '../../sdui/runtime/session';
import { unwrap, validateRuntime, type ValidationCatalog } from '../../sdui/schema/validate';
import { discoverContributionPackage } from '../install/contribution-package';
import type { PluginCatalog } from './catalog';
import type { PluginConversation } from './model';
import { blankDocument, newConversation } from './store';
import { effectiveRuntimeEnvironment } from './runtime';

export interface EagleAiModule {
  getDefaultModel(type: string): string;
  getModel(id: string): unknown;
  generateText(options: { model: unknown; prompt: string }): Promise<{ text: string }>;
}
export type RuntimeModel = (prompt: string) => Promise<string>;
export const eagleRuntimeModel: RuntimeModel = async prompt => {
  const ai = (globalThis as { eagle?: { extraModule?: { ai?: EagleAiModule } } }).eagle?.extraModule?.ai;
  if (!ai) throw new Error('Eagle AI is unavailable. Configure a chat model in Eagle and retry.');
  const model = ai.getModel(ai.getDefaultModel('chat'));
  return (await ai.generateText({ model, prompt })).text;
};

export function runtimePrompt(instruction: string, base: RuntimeDocument | undefined, validation: ValidationCatalog, context: PluginConversation['context']): string {
  const exports = Object.fromEntries(Object.entries(validation.exports ?? {}).filter(([id, value]) => context.eagle
    || !(id.startsWith('power-eagle.') && ['action', 'service'].includes(value.descriptor.kind))));
  return [
    'Produce one complete canonical power-eagle/runtime JSON document. Return JSON only, without Markdown fences.',
    'Use only the supplied widget and export contracts. Declare qualified provider dependencies with matching kinds and versions.',
    'Never return JavaScript, TypeScript, CommonJS, npm commands, or generated provider implementations.',
    'If the request requires an unavailable executable provider, return {"unsupported":"Explain which compiled provider is needed"}.',
    context.eagle ? 'Eagle API context enabled: use the typed installed Eagle actions/services shown below; do not invent host APIs.' : 'Eagle API context disabled: do not propose Eagle operations.',
    context.web ? 'Web API context enabled: declarative request actions may call JSON HTTP APIs; include recoverable error outcomes.' : 'Web API context disabled: do not add HTTP request actions.',
    `Structural schema: ${JSON.stringify(z.toJSONSchema(runtimeSchema))}`,
    `Widget contracts: ${JSON.stringify(validation.widgets)}`,
    `Effective export contracts: ${JSON.stringify(exports)}`,
    `Minimal example: ${JSON.stringify(blankDocument())}`,
    `Selected base document: ${JSON.stringify(base ?? null)}`,
    'An absent base means the plugin is provider-only. You may add a runtime using its available providers; compiled implementations remain unchanged.',
    `User instruction: ${instruction}`,
  ].join('\n\n');
}

export class PluginAgent {
  #records = new Map<string, PluginConversation>();
  #busy = new Set<string>();
  #errors = new Map<string, string>();
  #listeners = new Set<() => void>();
  #version = 0;
  #tail: Promise<unknown> = Promise.resolve();
  constructor(readonly catalog: PluginCatalog, readonly model: RuntimeModel = eagleRuntimeModel) {
    const records = catalog.store?.read().conversations ?? {};
    for (const [id, value] of Object.entries(records)) this.#records.set(id, value);
  }
  subscribe = (listener: () => void) => { this.#listeners.add(listener); return () => { this.#listeners.delete(listener); }; };
  snapshot = () => this.#version;
  private emit() { this.#version += 1; this.#listeners.forEach(listener => listener()); }
  private queue<T>(run: () => Promise<T>): Promise<T> { const next = this.#tail.then(run); this.#tail = next.catch(() => {}); return next; }
  record(id: string): PluginConversation {
    const instance = this.catalog.snapshot().entries.find(item => item.instance.instanceId === id)?.instance;
    if (!instance) throw new Error('Plugin is unavailable');
    return this.#records.get(id) ?? newConversation(instance);
  }
  busy(id: string) { return this.#busy.has(id); }
  error(id: string) { return this.#errors.get(id); }
  private async update(id: string, mutation: (record: PluginConversation) => void): Promise<PluginConversation> {
    return this.queue(async () => {
      if (!this.catalog.store) throw new Error('Open Power Eagle in Eagle to save Agent conversations.');
      const record = await this.catalog.store.conversation(id, mutation);
      this.#records.set(id, record); this.emit(); return record;
    });
  }
  draft(id: string, draft: string): Promise<PluginConversation> { return this.update(id, record => { record.draft = draft; }); }
  context(id: string, key: 'eagle' | 'web', enabled: boolean) { return this.update(id, record => { record.context[key] = enabled; }); }
  hideTurn(id: string, turnId: number) { return this.update(id, record => { const turn = record.turns.find(item => item.id === turnId); if (turn?.status === 'pending') throw new Error('A running turn cannot be removed'); if (turn) turn.hidden = true; }); }
  async selectBase(id: string, revision: number): Promise<void> {
    await this.queue(async () => {
      if (!this.catalog.store) throw new Error('Open Power Eagle in Eagle to select stored revisions.');
      await this.catalog.store.selectRevision(id, revision);
      this.#records.set(id, this.catalog.store.read().conversations[id]);
      await this.catalog.refresh(); this.emit();
    });
  }
  async recoverInterrupted(): Promise<void> {
    for (const [id, record] of this.#records) if (record.turns.some(turn => turn.status === 'pending') && !this.busy(id)) {
      await this.update(id, value => value.turns.forEach(turn => {
        if (turn.status === 'pending') { turn.status = 'failed'; turn.error = 'Generation was interrupted. Your last saved version is intact; retry your instruction.'; }
      }));
    }
  }
  async send(id: string): Promise<void> {
    if (this.#busy.has(id)) return;
    this.#busy.add(id); this.#errors.delete(id); this.emit();
    let turnId: number | undefined;
    let base = 0;
    try {
      const pending = await this.update(id, record => {
        if (!record.draft.trim()) throw new Error('Describe what this plugin should do.');
        turnId = record.nextTurnId++; base = record.selectedBase;
        record.turns.push({ id: turnId, base, instruction: record.draft.trim(), status: 'pending', createdAt: new Date().toISOString() });
        record.draft = '';
      });
      const turn = pending.turns.find(item => item.id === turnId)!;
      const store = this.catalog.store!;
      const instance = store.read().instances.find(item => item.instanceId === id)!;
      const source = discoverContributionPackage(store.artifact(instance, base), store.hostRequire);
      const environment = effectiveRuntimeEnvironment(this.catalog.snapshot().registry, this.catalog.controller);
      const validation: ValidationCatalog = { widgets: Object.fromEntries(Object.entries(environment.catalog.widgets).map(([key, value]) => [key, value.contract])), exports: environment.catalog.exports };
      const response = await this.model(runtimePrompt(turn.instruction, source.runtime, validation, pending.context));
      const parsed: unknown = JSON.parse(response.trim().replace(/^```(?:json)?\s*\n/u, '').replace(/\n```$/u, ''));
      if (parsed && typeof parsed === 'object' && 'unsupported' in parsed) throw new Error(`Compiled provider required: ${String(parsed.unsupported)}`);
      // Validate against the current catalog too: disabled or changed providers are not silently accepted.
      const current = effectiveRuntimeEnvironment(this.catalog.snapshot().registry, this.catalog.controller);
      const currentValidation = { widgets: Object.fromEntries(Object.entries(current.catalog.widgets).map(([key, value]) => [key, value.contract])), exports: current.catalog.exports };
      const runtime = unwrap(validateRuntime(parsed, currentValidation));
      const preview = new RuntimeSession(runtime, current.catalog, { calls: current.calls });
      try { preview.resolve(); } finally { await preview.dispose(); }
      await this.queue(() => store.revise(id, base, runtime, currentValidation, turnId));
      await this.catalog.refresh();
      const claim = this.catalog.snapshot().claims.get(id);
      if (claim?.status === 'failed') {
        await store.selectRevision(id, base); await this.catalog.refresh();
        throw new Error(`Generated revision could not activate: ${claim.reason}`);
      }
      this.#records.set(id, store.read().conversations[id]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.#errors.set(id, message);
      if (turnId !== undefined) {
        try { await this.update(id, record => { const turn = record.turns.find(item => item.id === turnId); if (turn) { turn.status = 'failed'; turn.error = message; } }); }
        catch { /* The visible error remains; never claim a history write succeeded. */ }
      }
    } finally { this.#busy.delete(id); this.emit(); }
  }
}
