import { z } from 'zod';
import { createCliTransport, providerFailure, type AgentModel, type CliOptions, type GenerationInput, type ProviderAdapter } from './transport.js';
export type { AgentModel, CliOptions, GenerationInput, ProviderAdapter } from './transport.js';
export function claudeModels(value: unknown): AgentModel[] {
  return z.array(z.object({ value: z.string(), displayName: z.string(), supportsEffort: z.boolean().optional(), supportedEffortLevels: z.array(z.string()).optional() })).max(500).parse(value)
    .map(model => ({ id: model.value, label: model.displayName, isDefault: model.value === 'default', efforts: model.supportsEffort ? model.supportedEffortLevels ?? [] : [] }));
}

export function parseOutput(output: string): string {
    const result = JSON.parse(output);
    if (result.is_error) throw providerFailure('claude', JSON.stringify(result));
    if (result.structured_output !== undefined) return JSON.stringify(result.structured_output);
    if (typeof result.result !== 'string') throw new Error('Claude returned no response.');
    return result.result;

}
const claudeIsolation = ['--no-session-persistence', '--restricted', '--safe-mode', '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--setting-sources', ''];

export function generationArguments(choice: GenerationInput): string[] {
  return ['--print', '--output-format', 'json', ...claudeIsolation, ...(choice.model ? ['--model', choice.model] : []), ...(choice.effort ? ['--effort', choice.effort] : [])];

}
export function createClaudeProvider(options: CliOptions = {}): ProviderAdapter {
  const { run, temporary, available, checkVersion } = createCliTransport('claude', options);
  return {
    available,
    generate: request => temporary(async directory => {
      await checkVersion();
      const output = await run(generationArguments(request), directory, request.prompt, 120_000);
      try { return parseOutput(output as string); }
      catch (error) { if (error instanceof SyntaxError) throw new Error('claude returned an invalid response. Retry the request.'); throw error; }
    }),
    discover: () => temporary(async directory => {
      await checkVersion();
      return await run( ['--print', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', ...claudeIsolation], directory,
        { type: 'control_request', request_id: 'models', request: { subtype: 'initialize' } }, 15_000, (line, _send, finish) => {
          const message = JSON.parse(line);
          if (message.type !== 'control_response' || message.response?.request_id !== 'models') return;
          if (message.response.subtype !== 'success') throw new Error('Discovery refused');
          finish(claudeModels(message.response.response.models));
        }) as AgentModel[];

    }),
  };
}
