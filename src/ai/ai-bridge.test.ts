import { describe, it, expect, vi } from 'vitest';
import { generatePluginSource, resolveAiModule, type AiModule } from './ai-bridge';

function fakeAi(text: string) {
  return {
    getDefaultModel: vi.fn(() => 'openai::gpt-5'),
    getModel: vi.fn((id: string) => ({ id })),
    generateText: vi.fn(async () => ({ text })),
  };
}

describe('generatePluginSource', () => {
  it('resolves the default chat model and returns the generated source', async () => {
    const ai = fakeAi('export default definePlugin({})');

    const source = await generatePluginSource('a prompt', ai);

    expect(source).toContain('export default definePlugin');
    expect(ai.getDefaultModel).toHaveBeenCalledWith('chat');
    expect(ai.getModel).toHaveBeenCalledWith('openai::gpt-5');
    expect(ai.generateText).toHaveBeenCalledWith({ model: { id: 'openai::gpt-5' }, prompt: 'a prompt' });
  });

  it('strips a markdown code fence the model may wrap around the module', async () => {
    const ai = fakeAi('```js\nexport default 1\n```');
    expect(await generatePluginSource('p', ai)).toBe('export default 1');
  });

  it('throws a clear error when the ai module is unavailable', async () => {
    await expect(generatePluginSource('p', undefined as unknown as AiModule)).rejects.toThrow(/AI SDK unavailable/iu);
  });
});

describe('resolveAiModule', () => {
  it('reads eagle.extraModule.ai from the global eagle object', () => {
    const fake = {} as AiModule;
    (globalThis as { eagle?: unknown }).eagle = { extraModule: { ai: fake } };
    expect(resolveAiModule()).toBe(fake);
    delete (globalThis as { eagle?: unknown }).eagle;
  });

  it('returns undefined when the eagle global or its ai module is absent', () => {
    delete (globalThis as { eagle?: unknown }).eagle;
    expect(resolveAiModule()).toBeUndefined();
  });
});
