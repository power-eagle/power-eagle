export interface ModelChoice { model?: string; effort?: string }
export interface ProviderChoice extends ModelChoice { provider: string }
export interface AgentSettings { provider: string; choices: Record<string, ModelChoice> }
export const selectedProvider = (settings: AgentSettings): ProviderChoice => ({ ...settings.choices[settings.provider], provider: settings.provider });
export interface AgentModel { id: string; label: string; isDefault?: boolean; efforts: string[]; defaultEffort?: string }
export interface ProviderCatalog { state: 'loading' | 'ready' | 'unavailable'; installed?: boolean; models: AgentModel[]; error?: string }
export interface ContextInfo {
  included: number[]; omitted: number; estimatedTokens: number; inputBudget: number; capacity: 'application-estimate';
}
export interface AgentTurn {
  id: number; base: number; instruction: string; createdAt: string;
  status: 'pending' | 'success' | 'failed'; revision?: number; error?: string; hidden?: boolean;
  choice: ProviderChoice; apiContext?: Record<string, boolean>; retryOf?: number;
  currentFlagsOnRetry?: boolean; contextInfo?: ContextInfo;
}
export interface Conversation {
  id: string; draft: string; selectedBase: number; context: Record<string, boolean>;
  nextTurnId: number; turns: AgentTurn[]; settings: AgentSettings;
}
export interface AgentRequest {
  conversationId: string; turnId: number; base: number; instruction: string;
  context: Record<string, boolean>; choice: ProviderChoice; prompt: string;
}
/** Adapter APIs are structural: local-provider packages satisfy this without depending on Agent. */
export interface ProviderAdapter {
  generate(input: { prompt: string; model?: string; effort?: string }): Promise<string>;
  available(): Promise<boolean>;
  discover(): Promise<AgentModel[]>;
}
export interface AgentProvider {
  id: string; label: string; adapter: ProviderAdapter;
  managed?: { description: string };
  setupHint?: string;
}
export interface AgentHost {
  read(id: string): Conversation;
  list(): Conversation[];
  /** Publish atomically; reject without changing durable state. Preserve unrelated record fields. */
  update(id: string, mutation: (record: Conversation) => void): Promise<Conversation>;
  selectBase(id: string, revision: number): Promise<Conversation>;
  /** Return complete mandatory content; the controller appends bounded history. */
  prepare(id: string, turn: AgentTurn): string | Promise<string>;
  /** Validate, commit result and successful turn together, then return the durable conversation. */
  apply(id: string, turn: AgentTurn, response: string): Promise<Conversation>;
}
export interface AgentOptions {
  host: AgentHost; providers: AgentProvider[]; inputBudget?: number;
  /** Optional enriched dispatcher for hosts needing request provenance at their provider boundary. */
  generate?(request: AgentRequest): Promise<string>;
  emptyInstructionMessage?: string;
}
export function createConversation(id: string, provider: string, base = 1): Conversation {
  return { id, draft: '', selectedBase: base, context: {}, nextTurnId: 1, turns: [], settings: { provider, choices: {} } };
}
