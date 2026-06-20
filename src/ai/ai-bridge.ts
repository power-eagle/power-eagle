/**
 * Adapter over Eagle's injected `ai` module (the AI SDK). It resolves the user's
 * default chat model and runs one text generation, returning the cleaned plugin
 * source. The `ai` module is passed in so this is unit-testable; the AI tab
 * resolves the real global at runtime (Eagle 4.0 Build20+).
 */

/** The slice of Eagle's AI SDK this feature uses. */
export interface AiModule {
  getDefaultModel(type: string): string;
  getModel(id: string): unknown;
  generateText(opts: { model: unknown; prompt: string }): Promise<{ text: string }>;
}

/** Resolve Eagle's AI SDK from the injected global: `eagle.extraModule.ai` (Eagle 4.0 Build20+). */
export function resolveAiModule(): AiModule | undefined {
  const injected = globalThis as { eagle?: { extraModule?: { ai?: AiModule } } };
  return injected.eagle?.extraModule?.ai;
}

/** Strip a leading/trailing markdown code fence the model may add despite instructions. */
function stripFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```[^\n]*\n/u, '')
    .replace(/\n```$/u, '')
    .trim();
}

/** Generate one plugin module's source from a prompt using the default chat model. */
export async function generatePluginSource(prompt: string, ai: AiModule): Promise<string> {
  if (!ai) {
    throw new Error('Eagle AI SDK unavailable — eagle.extraModule.ai not found (needs Eagle 4.0 Build20+, with a model configured)');
  }
  const model = ai.getModel(ai.getDefaultModel('chat'));
  const result = await ai.generateText({ model, prompt });
  return stripFences(result.text);
}
