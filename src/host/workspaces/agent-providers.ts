import { createClaudeProvider, createCodexProvider } from '@power-eagle/agent-providers';
import type { AgentProviders, LocalProvider } from './agent-types';

/** Eagle dispatch and application environment overrides stay outside the packages. */
export function localProviders(hostRequire: NodeRequire | undefined, eagle: (prompt: string) => Promise<string>): AgentProviders {
  const local = (provider: LocalProvider) => {
    if (!hostRequire) throw new Error('Local providers require the Eagle desktop host.');
    const process = hostRequire('node:process') as typeof import('node:process');
    const executable = process.env[`POWER_EAGLE_${provider.toUpperCase()}_BIN`];
    return (provider === 'claude' ? createClaudeProvider : createCodexProvider)({ hostRequire, executable });
  };
  return {
    available: async provider => local(provider).available(),
    discover: async provider => local(provider).discover(),
    generate: async request => request.choice.provider === 'eagle' ? eagle(request.prompt)
      : local(request.choice.provider).generate({ prompt: request.prompt, model: request.choice.model, effort: request.choice.effort }),
  };
}
