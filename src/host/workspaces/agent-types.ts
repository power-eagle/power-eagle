import { z } from 'zod';

export const providerSchema = z.enum(['eagle', 'claude', 'codex']);
export type AgentProvider = z.infer<typeof providerSchema>;
export type LocalProvider = Exclude<AgentProvider, 'eagle'>;
export const modelChoiceSchema = z.strictObject({ model: z.string().min(1).optional(), effort: z.string().min(1).optional() });
export const providerChoiceSchema = modelChoiceSchema.extend({ provider: providerSchema });
export type ProviderChoice = z.infer<typeof providerChoiceSchema>;
export const agentSettingsSchema = z.strictObject({
  provider: providerSchema, claude: modelChoiceSchema, codex: modelChoiceSchema,
});
export type AgentSettings = z.infer<typeof agentSettingsSchema>;
export const defaultAgentSettings = (): AgentSettings => ({ provider: 'eagle', claude: {}, codex: {} });
export const selectedProvider = (settings: AgentSettings): ProviderChoice => settings.provider === 'eagle'
  ? { provider: 'eagle' } : { provider: settings.provider, ...settings[settings.provider] };
export const providerLabels: Record<AgentProvider, string> = { eagle: 'Eagle supplied', claude: 'Claude', codex: 'Codex' };
export const apiContextSchema = z.strictObject({ eagle: z.boolean(), web: z.boolean() });
export const contextInfoSchema = z.strictObject({
  included: z.array(z.number().int().positive()), omitted: z.number().int().nonnegative(),
  estimatedTokens: z.number().int().nonnegative(), inputBudget: z.number().int().positive(),
  capacity: z.literal('application-estimate'),
});
export type ContextInfo = z.infer<typeof contextInfoSchema>;
export interface ProviderRequest {
  instanceId: string; turnId: number; base: number; instruction: string;
  context: z.infer<typeof apiContextSchema>; choice: ProviderChoice; prompt: string;
}
export interface AgentModel { id: string; label: string; isDefault?: boolean; efforts: string[]; defaultEffort?: string }
export interface ProviderCatalog { state: 'loading' | 'ready' | 'unavailable'; installed?: boolean; models: AgentModel[]; error?: string }
export interface AgentProviders {
  generate(request: ProviderRequest): Promise<string>;
  discover(provider: LocalProvider): Promise<AgentModel[]>;
  available(provider: LocalProvider): Promise<boolean>;
}
