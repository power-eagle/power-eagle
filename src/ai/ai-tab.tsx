/**
 * The AI tab: a prompt box that generates a plugin, renders it, and a left-hand
 * history of attempts that can be reselected. The generation pipeline and
 * attempt loading are injected (the App binds them to the real model, home, and
 * disk loader), so this component is pure UI + state.
 */
import React from 'react';
import { PluginRuntimeView } from '../app/plugin-runtime-view';
import { ThemeContext } from '../sdui/render/render';
import { mergeThemes } from '../sdui/theme';
import type { HostContext } from '../app/host-service';
import type { AnyPluginModule } from '../plugins/builtins';
import type { Attempt } from './aidriven-store';
import type { GenerateResult } from './generate';
import type { PromptOptions } from './prompt';

export function AiTab(props: {
  context: HostContext;
  eagle: Record<string, unknown>;
  attempts: Attempt[];
  generate: (instruction: string, options: PromptOptions) => Promise<GenerateResult>;
  loadAttempt: (id: string) => Promise<AnyPluginModule | undefined>;
}): React.ReactElement {
  const { context, eagle, generate, loadAttempt } = props;
  const [prompt, setPrompt] = React.useState('');
  const [attempts, setAttempts] = React.useState<Attempt[]>(props.attempts);
  const [module, setModule] = React.useState<AnyPluginModule | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<'idle' | 'busy' | 'error'>('idle');
  const [error, setError] = React.useState('');
  // Heavy platform surfaces are opt-in (default on) to keep prompt cost in hand.
  const [includeEagle, setIncludeEagle] = React.useState(true);
  const [includeWebApi, setIncludeWebApi] = React.useState(true);

  const upsert = (attempt: Attempt): void =>
    setAttempts((prev) => [attempt, ...prev.filter((entry) => entry.id !== attempt.id)]);

  async function onGenerate(): Promise<void> {
    if (!prompt.trim()) return;
    setStatus('busy');
    setModule(null);
    try {
      const result = await generate(prompt, { includeEagle, includeWebApi });
      upsert(result.attempt);
      setSelectedId(result.attempt.id);
      if (result.module) {
        setModule(result.module);
        setStatus('idle');
      } else {
        setError(result.attempt.error ?? 'the generated plugin did not load');
        setStatus('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }

  async function onSelect(id: string): Promise<void> {
    setSelectedId(id);
    setStatus('busy');
    setModule(null);
    try {
      const loaded = await loadAttempt(id);
      if (loaded) {
        setModule(loaded);
        setStatus('idle');
      } else {
        setError('could not load this attempt');
        setStatus('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-56 flex-shrink-0 overflow-y-auto border-r border-border p-2">
        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Attempts</div>
        {attempts.length ? attempts.map((attempt) => (
          <button
            key={attempt.id}
            type="button"
            onClick={() => void onSelect(attempt.id)}
            className={`mb-1 flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm ${selectedId === attempt.id ? 'bg-card shadow-sm' : 'hover:bg-card'}`}
          >
            <span className="truncate">{attempt.name}</span>
            <span className={`text-[10px] ${attempt.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>{attempt.status}</span>
          </button>
        )) : <div className="px-3 py-3 text-sm text-muted-foreground">no attempts yet</div>}
      </aside>
      <section className="min-w-0 flex-1 overflow-y-auto p-4">
        <textarea
          className="mb-2 h-24 w-full resize-y rounded-lg border border-border bg-background p-2 text-sm"
          placeholder="Describe the plugin to generate…"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={includeEagle} onChange={(event) => setIncludeEagle(event.target.checked)} />
            Eagle API
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={includeWebApi} onChange={(event) => setIncludeWebApi(event.target.checked)} />
            Web API
          </label>
        </div>
        <button
          type="button"
          onClick={() => void onGenerate()}
          disabled={status === 'busy'}
          className="mb-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {status === 'busy' ? 'Generating…' : 'Generate'}
        </button>
        {status === 'error' ? (
          <div className="text-sm text-destructive">generation failed: {error}</div>
        ) : module ? (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <ThemeContext.Provider value={mergeThemes(context.theme, {})}>
              <PluginRuntimeView module={module} eagle={eagle} services={context.services} widgets={context.widgets} />
            </ThemeContext.Provider>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">describe a plugin above and generate it</div>
        )}
      </section>
    </div>
  );
}
