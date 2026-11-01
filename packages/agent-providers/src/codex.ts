import { z } from 'zod';
import { createCliTransport, providerFailure, type AgentModel, type CliOptions, type GenerationInput, type ProviderAdapter } from './transport.js';
export type { AgentModel, CliOptions, GenerationInput, ProviderAdapter } from './transport.js';
const localModelSchema = z.object({ id: z.string().min(1), label: z.string(), isDefault: z.boolean().optional(), efforts: z.array(z.string()), defaultEffort: z.string().optional() });
const codexPage = z.object({ data: z.array(z.object({ model: z.string(), displayName: z.string(), hidden: z.boolean().optional(), isDefault: z.boolean(),
  defaultReasoningEffort: z.string().optional(), supportedReasoningEfforts: z.array(z.object({ reasoningEffort: z.string() })) })).max(500), nextCursor: z.string().nullable().optional() });
export function codexModels(value: unknown) {
  const page = codexPage.parse(value);
  return { models: page.data.filter(model => !model.hidden).map(model => localModelSchema.parse({ id: model.model, label: model.displayName,
    isDefault: model.isDefault, efforts: model.supportedReasoningEfforts.map(effort => effort.reasoningEffort), defaultEffort: model.defaultReasoningEffort })), cursor: page.nextCursor };
}

export function parseOutput(output: string): string {
  let last: string | undefined;
  for (const line of output.split('\n').filter(line => line.trim())) {
    const event = JSON.parse(line);
    if (event.type === 'error' || event.type === 'turn.failed') throw providerFailure('codex', JSON.stringify(event));
    if (event.type === 'item.completed' && event.item?.type === 'agent_message') last = event.item.text;
  }
  if (typeof last !== 'string' || !last) throw new Error('Codex returned no response.');
  return last;

}

export function generationArguments(choice: GenerationInput, directory: string): string[] {
return ['exec', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', '--sandbox', 'read-only', '--cd', directory, '--json', '--color', 'never',
    '-c', 'approval_policy="never"', '-c', 'features.shell_tool=false', '-c', 'features.unified_exec=false', '-c', 'features.apply_patch_freeform=false',
    '-c', 'features.multi_agent=false', '-c', 'features.image_generation=false', '-c', 'web_search="disabled"', '-c', 'history.persistence="none"', '-c', 'project_doc_max_bytes=0',
    ...(choice.model ? ['--model', choice.model] : []), ...(choice.effort ? ['-c', `model_reasoning_effort=${JSON.stringify(choice.effort)}`] : []), '-'];

}
export function createCodexProvider(options: CliOptions = {}): ProviderAdapter {
  const { run, temporary, available, checkVersion } = createCliTransport('codex', options);
  return {
    available,
    generate: request => temporary(async directory => {
      await checkVersion();
      const output = await run(generationArguments(request, directory), directory, request.prompt, 120_000);
      try { return parseOutput(output as string); }
      catch (error) { if (error instanceof SyntaxError) throw new Error('codex returned an invalid response. Retry the request.'); throw error; }
    }),
    discover: () => temporary(async directory => {
      await checkVersion();
      let id = 1; const models: AgentModel[] = [], cursors = new Set<string>();
      return await run( ['app-server', '--listen', 'stdio://', '-c', 'analytics.enabled=false'], directory,
        { id, method: 'initialize', params: { clientInfo: { name: 'agent_provider', version: '1.0.0' }, capabilities: {} } }, 15_000, (line, send, finish) => {
          const message = JSON.parse(line); if (message.id !== id) return;
          if (message.error) throw new Error('Discovery refused');
          if (id === 1) { send({ method: 'initialized', params: {} }); send({ id: ++id, method: 'model/list', params: { limit: 100, includeHidden: false } }); return; }
          const page = codexModels(message.result); models.push(...page.models);
          if (models.length > 500) throw new Error('Model limit');
          if (!page.cursor) { finish(models); return; }
          if (cursors.has(page.cursor) || cursors.size >= 10) throw new Error('Invalid pagination');
          cursors.add(page.cursor); send({ id: ++id, method: 'model/list', params: { limit: 100, includeHidden: false, cursor: page.cursor } });
        }) as AgentModel[];
    }),
  };
}
