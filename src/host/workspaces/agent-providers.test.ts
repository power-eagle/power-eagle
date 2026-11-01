import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createClaudeProvider, createCodexProvider } from '@power-eagle/agent-providers';
import { localProviders } from './agent-providers';
import type { ProviderRequest } from './agent-types';

// Protocol/process tests live with the package; this verifies application composition.
vi.mock('@power-eagle/agent-providers', () => ({ createClaudeProvider: vi.fn(), createCodexProvider: vi.fn() }));
const hostRequire = createRequire(import.meta.url);
const request: ProviderRequest = { instanceId: 'plugin', turnId: 1, base: 1, instruction: 'Synthetic',
  prompt: 'A complete runtime prompt', context: { eagle: true, web: false }, choice: { provider: 'codex', model: 'chosen', effort: 'low' } };
const adapter = { available: vi.fn(async () => true), discover: vi.fn(async () => [{ id: 'chosen', label: 'Chosen', efforts: ['low'] }]), generate: vi.fn(async () => 'result text') };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClaudeProvider).mockReturnValue(adapter);
  vi.mocked(createCodexProvider).mockReturnValue(adapter);
});
afterEach(() => vi.unstubAllEnvs());

describe('Power Eagle provider composition', () => {
  it('delegates Eagle generation without constructing native adapters or loading host modules', async () => {
    const eagle = vi.fn(async () => 'Eagle result'); const providers = localProviders(undefined, eagle);
    expect(await providers.generate({ ...request, choice: { provider: 'eagle' } })).toBe('Eagle result');
    expect(eagle).toHaveBeenCalledWith(request.prompt);
    expect(createClaudeProvider).not.toHaveBeenCalled(); expect(createCodexProvider).not.toHaveBeenCalled();
    await expect(providers.available('claude')).rejects.toThrow('desktop host');
    await expect(providers.discover('codex')).rejects.toThrow('desktop host');
  });
  it.each(['claude', 'codex'] as const)('passes only explicit %s configuration and portable generation inputs', async provider => {
    vi.stubEnv(`POWER_EAGLE_${provider.toUpperCase()}_BIN`, `C:/fixtures/${provider}.exe`);
    const providers = localProviders(hostRequire, async () => 'Eagle');
    expect(await providers.available(provider)).toBe(true);
    expect(await providers.discover(provider)).toEqual([{ id: 'chosen', label: 'Chosen', efforts: ['low'] }]);
    expect(await providers.generate({ ...request, choice: { ...request.choice, provider } })).toBe('result text');
    const factory = provider === 'claude' ? createClaudeProvider : createCodexProvider;
    const other = provider === 'claude' ? createCodexProvider : createClaudeProvider;
    expect(factory).toHaveBeenCalledWith({ hostRequire, executable: `C:/fixtures/${provider}.exe` });
    expect(other).not.toHaveBeenCalled();
    expect(adapter.generate).toHaveBeenCalledWith({ prompt: request.prompt, model: 'chosen', effort: 'low' });
  });
  it('preserves native errors and never dispatches them through Eagle', async () => {
    const eagle = vi.fn(async () => 'fallback'); const providers = localProviders(hostRequire, eagle);
    adapter.generate.mockRejectedValueOnce(Error('Codex authentication failed'));
    await expect(providers.generate(request)).rejects.toThrow('Codex authentication failed');
    expect(eagle).not.toHaveBeenCalled();
  });
});
