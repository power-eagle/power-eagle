import { useState, useSyncExternalStore } from 'react';
import type { PluginAgent } from '../host/workspaces/agent';
import type { CatalogEntry } from '../host/workspaces/catalog';
import { Button } from '../components/ui';

export function PluginAgentPanel({ agent, entry }: { agent: PluginAgent; entry: CatalogEntry }) {
  useSyncExternalStore(agent.subscribe, agent.snapshot, agent.snapshot);
  const id = entry.instance.instanceId;
  const record = agent.record(id);
  const [draft, setDraft] = useState(record.draft);
  const [error, setError] = useState('');
  const busy = agent.busy(id);
  const report = (work: Promise<unknown>) => { setError(''); void work.catch(reason => setError(String(reason))); };
  return <section className="pe-agent-context" aria-label={`Agent for ${entry.instance.name}`}>
    <header><strong>{entry.instance.name}</strong><small>Refining revision {record.selectedBase}{busy ? ' · generating…' : ''}</small>
      {entry.instance.forkOf ? <small>Copied from {entry.instance.forkOf.instanceId}, revision {entry.instance.forkOf.revision}. This conversation is independent.</small> : null}
    </header>
    <div className="pe-agent-versions" aria-label="Plugin revisions">
      {entry.instance.revisions.map(revision => <button key={revision.id} type="button" aria-pressed={entry.instance.currentRevision === revision.id}
        onClick={() => report(agent.selectBase(id, revision.id))}>v{revision.id}</button>)}
    </div>
    <div className="pe-agent-history pe-scroll" aria-live="polite">
      {record.turns.filter(turn => !turn.hidden).length === 0 ? <p>Describe what this plugin should do. Each saved version stays in this plugin.</p> : null}
      {!entry.discovered.runtime ? <p>This plugin supplies compiled providers. Agent can add a runtime interface; changes to its compiled implementation use the package authoring workflow.</p> : null}
      {record.turns.filter(turn => !turn.hidden).map(turn => <article key={turn.id} data-status={turn.status}>
        <p>{turn.instruction}</p><small>From v{turn.base} · {turn.status}{turn.revision ? ` · saved v${turn.revision}` : ''}</small>
        {turn.error ? <p role="alert">{turn.error}</p> : null}
        {turn.status !== 'pending' ? <button type="button" aria-label={`Remove turn ${turn.id} from history`} onClick={() => report(agent.hideTurn(id, turn.id))}>Remove from history</button> : null}
      </article>)}
    </div>
    <form className="pe-agent-composer" onSubmit={event => { event.preventDefault(); setDraft(''); report(agent.send(id)); }}>
      <div className="pe-agent-context-controls">
        <label><input type="checkbox" checked={record.context.eagle} onChange={event => report(agent.context(id, 'eagle', event.currentTarget.checked))} />Eagle API</label>
        <label><input type="checkbox" checked={record.context.web} onChange={event => report(agent.context(id, 'web', event.currentTarget.checked))} />Web API</label>
      </div>
      <label htmlFor="plugin-agent-draft">Describe this plugin</label>
      <textarea id="plugin-agent-draft" placeholder="What should this plugin do?" value={draft}
        onChange={event => { const value = event.currentTarget.value; setDraft(value); report(agent.draft(id, value)); }} />
      {error || agent.error(id) ? <p role="alert">{error || agent.error(id)}</p> : null}
      <div><small>{busy ? 'Generating…' : `Base: v${record.selectedBase}`}</small><Button type="submit" disabled={busy || !draft.trim()}>Send</Button></div>
    </form>
  </section>;
}
