import { z } from 'zod';
import { runtimeSchema, type RuntimeDocument } from '../../sdui/schema/model';
import { RuntimeSession } from '../../sdui/runtime/session';
import { unwrap, validateRuntime, type ValidationCatalog } from '../../sdui/schema/validate';
import { discoverContributionPackage } from '../install/contribution-package';
import type { PluginCatalog } from './catalog';
import { conversationSchema, type PluginConversation } from './model';
import { blankDocument, newConversation } from './store';
import { effectiveRuntimeEnvironment } from './runtime';
import { AgentController, type Conversation, type AgentTurn, type AgentSettings as PortableSettings } from '@power-eagle/agent';
import { agentSettingsSchema, apiContextSchema, providerChoiceSchema, providerLabels, type AgentProviders, type AgentSettings, type LocalProvider, type ProviderCatalog } from './agent-types';
import { localProviders } from './agent-providers';

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

function portable(record: PluginConversation): Conversation {
  return { id: record.instanceId, draft: record.draft, selectedBase: record.selectedBase, context: { ...record.context },
    nextTurnId: record.nextTurnId, turns: record.turns.map(turn => ({ ...turn })),
    settings: { provider: record.settings.provider, choices: { claude: { ...record.settings.claude }, codex: { ...record.settings.codex } } } };
}
function persistedSettings(settings: PortableSettings): AgentSettings {
  return agentSettingsSchema.parse({ provider: settings.provider, claude: settings.choices.claude ?? {}, codex: settings.choices.codex ?? {} });
}

/** Application adapter: disk format, runtime validation and activation stay here. */
export class PluginAgent {
  readonly providers: AgentProviders;
  readonly controller: AgentController;
  constructor(readonly catalog: PluginCatalog, model?: RuntimeModel | AgentProviders) {
    this.providers = typeof model === 'function' ? { generate: request => model(request.prompt), discover: async () => [], available: async () => false }
      : model ?? localProviders(catalog.store?.hostRequire, eagleRuntimeModel);
    const requireStore = () => {
      if (!catalog.store) throw new Error('Open Power Eagle in Eagle to save Agent conversations.');
      return catalog.store;
    };
    const read = (id: string) => portable(this.record(id));
    this.controller = new AgentController({
      emptyInstructionMessage: 'Describe what this plugin should do.',
      host: {
        read,
        list: () => Object.values(catalog.store?.read().conversations ?? {}).map(portable),
        update: async (id, mutation) => {
          const record = await requireStore().conversation(id, current => {
            const next = portable(current); mutation(next);
            if (next.id !== current.instanceId) throw new Error('Conversation ownership does not match');
            Object.assign(current, conversationSchema.parse({ ...current, draft: next.draft,
              selectedBase: next.selectedBase, context: next.context, nextTurnId: next.nextTurnId,
              turns: next.turns, settings: persistedSettings(next.settings) }));
          });
          return portable(record);
        },
        selectBase: async (id, revision) => {
          await requireStore().selectRevision(id, revision); await catalog.refresh(); return read(id);
        },
        prepare: (id, turn) => {
          const store = requireStore(); const instance = store.read().instances.find(item => item.instanceId === id);
          if (!instance) throw new Error('Plugin is unavailable');
          const source = discoverContributionPackage(store.artifact(instance, turn.base), store.hostRequire);
          const environment = effectiveRuntimeEnvironment(catalog.snapshot().registry, catalog.controller);
          const validation: ValidationCatalog = { widgets: Object.fromEntries(Object.entries(environment.catalog.widgets).map(([key, value]) => [key, value.contract])), exports: environment.catalog.exports };
          return runtimePrompt(turn.instruction, source.runtime, validation, apiContextSchema.parse(turn.apiContext));
        },
        apply: (id, turn, response) => this.applyResult(id, turn, response),
      },
      providers: (['eagle', 'claude', 'codex'] as const).map(provider => ({
        id: provider, label: providerLabels[provider],
        ...(provider === 'eagle' ? { managed: { description: 'The chat model is managed in Eagle. Configure Eagle’s default chat model to use this provider.' } }
          : { setupHint: `Sign in using ${provider === 'codex' ? 'codex login' : 'claude auth login'} in your terminal.` }),
        adapter: {
          available: () => provider === 'eagle' ? Promise.resolve(true) : this.providers.available(provider),
          discover: () => provider === 'eagle' ? Promise.resolve([]) : this.providers.discover(provider),
          generate: () => Promise.reject(new Error('Power Eagle dispatch requires captured request provenance')),
        },
      })),
      generate: request => this.providers.generate({ instanceId: request.conversationId, turnId: request.turnId, base: request.base,
        instruction: request.instruction, context: apiContextSchema.parse(request.context), choice: providerChoiceSchema.parse(request.choice), prompt: request.prompt }),
    });
  }
  record(id: string): PluginConversation {
    const instance = this.catalog.snapshot().entries.find(item => item.instance.instanceId === id)?.instance;
    if (!instance) throw new Error('Plugin is unavailable');
    return this.catalog.store?.read().conversations[id] ?? newConversation(instance);
  }
  subscribe = (listener: () => void) => this.controller.subscribe(listener);
  snapshot = () => this.controller.snapshot();
  busy(id: string) { return this.controller.busy(id); }
  error(id: string) { return this.controller.error(id); }
  providerCatalog(provider: LocalProvider): ProviderCatalog | undefined { return this.controller.providerCatalog(provider); }
  discover(provider: LocalProvider, refresh = false) { return this.controller.discover(provider, refresh); }
  async draft(id: string, draft: string) { await this.controller.draft(id, draft); return this.record(id); }
  async context(id: string, key: 'eagle' | 'web', enabled: boolean) { await this.controller.context(id, key, enabled); return this.record(id); }
  async settings(id: string, settings: AgentSettings) {
    const checked = agentSettingsSchema.parse(settings);
    await this.controller.settings(id, { provider: checked.provider, choices: { claude: checked.claude, codex: checked.codex } });
    return this.record(id);
  }
  async editRequest(id: string, turnId: number, replaceDraft = false) { await this.controller.editRequest(id, turnId, replaceDraft); return this.record(id); }
  retry(id: string, turnId: number) { return this.controller.retry(id, turnId); }
  selectBase(id: string, revision: number) { return this.controller.selectBase(id, revision); }
  recoverInterrupted() { return this.controller.recoverInterrupted(); }
  send(id: string, retryOf?: number) { return this.controller.send(id, retryOf); }

  private async applyResult(id: string, turn: AgentTurn, response: string): Promise<Conversation> {
    const store = this.catalog.store!;
    const parsed: unknown = JSON.parse(response.trim().replace(/^```(?:json)?\s*\n/u, '').replace(/\n```$/u, ''));
    if (parsed && typeof parsed === 'object' && 'unsupported' in parsed) throw new Error(`Compiled provider required: ${String(parsed.unsupported)}`);
    const current = effectiveRuntimeEnvironment(this.catalog.snapshot().registry, this.catalog.controller);
    const validation = { widgets: Object.fromEntries(Object.entries(current.catalog.widgets).map(([key, value]) => [key, value.contract])), exports: current.catalog.exports };
    const runtime = unwrap(validateRuntime(parsed, validation));
    const preview = new RuntimeSession(runtime, current.catalog, { calls: current.calls });
    try { preview.resolve(); } finally { await preview.dispose(); }
    // The revision and successful turn still publish in the original store transaction.
    await store.revise(id, turn.base, runtime, validation, turn.id);
    await this.catalog.refresh();
    const claim = this.catalog.snapshot().claims.get(id);
    if (claim?.status === 'failed') {
      await store.selectRevision(id, turn.base); await this.catalog.refresh();
      throw new Error(`Generated revision could not activate: ${claim.reason}`);
    }
    return portable(this.record(id));
  }
}
