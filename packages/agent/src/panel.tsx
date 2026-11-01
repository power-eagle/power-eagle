import { useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { AgentController } from './controller.js';
import { selectedProvider } from './types.js';
import { useSelectionKey } from './selection-key.js';
export interface AgentPanelProps {
  agent: AgentController; conversationId: string; title: string; titleHint?: string;
  revisions?: { id: number; label?: string }[]; currentRevision?: number;
  contextControls?: { id: string; label: string }[]; notice?: ReactNode;
  emptyMessage?: ReactNode; composerLabel?: string; placeholder?: string; onSettings?(): void;
  revisionsLabel?: string;
}
export function AgentPanel(props: AgentPanelProps) {
  // Key the inner editor so selection changes never retain another conversation's local draft.
  return <ConversationPanel key={useSelectionKey(props.agent, props.conversationId)} {...props} />;
}
function ConversationPanel({ agent, conversationId: id, title, titleHint, revisions = [], currentRevision,
  contextControls = [], notice, emptyMessage = 'Describe a change. Each saved version remains available.',
  composerLabel = 'Describe a change', placeholder = 'What would you like to change?', revisionsLabel = 'Revisions', onSettings }: AgentPanelProps) {
  const draftId = useId();
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const draftVersion = useRef(0);
  useSyncExternalStore(agent.subscribe, agent.snapshot, agent.snapshot);
  const record = agent.record(id);
  const [draft, setDraft] = useState(record.draft);
  const [error, setError] = useState('');
  const [replaceTurn, setReplaceTurn] = useState<number>();
  const busy = agent.busy(id);
  const choice = selectedProvider(record.settings);
  const report = (work: Promise<unknown>) => { setError(''); void work.catch(reason => setError(String(reason))); };
  const edit = (turnId: number, replace = false) => {
    if (draft.trim() && !replace) { setReplaceTurn(turnId); return; }
    const version = ++draftVersion.current;
    report(agent.editRequest(id, turnId, replace).then(value => {
      if (version !== draftVersion.current) return;
      setDraft(value.draft); setReplaceTurn(undefined); draftRef.current?.focus();
    }));
  };
  return <section className="ak-agent-context" aria-label={`Agent for ${title}`}>
    <header><strong title={titleHint}>{title}</strong>
      <button className="ak-agent-settings-trigger" type="button" aria-label="Agent settings" onClick={onSettings}>
        {(agent.provider(choice.provider)?.label ?? choice.provider)}{!agent.provider(choice.provider)?.managed ? ` · ${choice.model ?? 'Provider default'}` : ''}<span aria-hidden="true"> ⚙</span>
      </button>
    </header>
    <div className="ak-agent-versions" aria-label={revisionsLabel}>
      {revisions.map(revision => <button key={revision.id} type="button" aria-pressed={(currentRevision ?? record.selectedBase) === revision.id}
        onClick={() => report(agent.selectBase(id, revision.id))}>{revision.label ?? `v${revision.id}`}</button>)}
    </div>
    <div className="ak-agent-history" aria-live="polite">
      {record.turns.filter(turn => !turn.hidden).length === 0 ? <p>{emptyMessage}</p> : null}
      {notice ? <p>{notice}</p> : null}
      {record.turns.filter(turn => !turn.hidden).map(turn => <article key={turn.id} data-status={turn.status}>
        <small>You</small><p>{turn.instruction}</p>
        <small>From v{turn.base} · {(agent.provider(turn.choice.provider)?.label ?? turn.choice.provider)}{turn.choice.model ? ` · ${turn.choice.model}` : ''}{turn.choice.effort ? ` · ${turn.choice.effort}` : ''}{turn.retryOf ? ` · retry of request ${turn.retryOf}` : ''}</small>
        {turn.currentFlagsOnRetry ? <small className="ak-agent-notice">Using current context; the original flags were not recorded.</small> : null}
        <div className="ak-agent-outcome" aria-label={`Agent outcome for request ${turn.id}`}>
          <small>Agent · {turn.status}</small>
          {turn.status === 'pending' ? <p role="status">Generating…</p> : null}
          {turn.status === 'success' && turn.revision ? <p>Saved <button type="button" aria-label={`Open revision ${turn.revision}`} onClick={() => report(agent.selectBase(id, turn.revision!))}>v{turn.revision}</button></p> : null}
        {turn.error ? <p role="alert">{turn.error}</p> : null}
        {turn.contextInfo?.omitted ? <small className="ak-agent-notice">Partial history supplied · {turn.contextInfo.omitted} older requests omitted</small> : null}
        {turn.status === 'failed' ? <div className="ak-agent-recovery">
          <button type="button" disabled={busy} aria-label={`Retry request ${turn.id}`} onClick={() => report(agent.retry(id, turn.id))}>Retry</button>
          <button type="button" aria-label={`Edit request ${turn.id}`} onClick={() => edit(turn.id)}>Edit request</button>
        </div> : null}
        </div>
      </article>)}
    </div>
    <form className="ak-agent-composer" onSubmit={event => {
      event.preventDefault(); const version = draftVersion.current;
      setDraft(''); setReplaceTurn(undefined);
      report(agent.send(id).then(() => { if (version === draftVersion.current) setDraft(agent.record(id).draft); }));
    }}>
      {replaceTurn !== undefined ? <div role="status">Keep your current draft, or replace it with this request?
        <button type="button" onClick={() => edit(replaceTurn, true)}>Replace draft</button>
        <button type="button" onClick={() => setReplaceTurn(undefined)}>Keep draft</button>
      </div> : null}
      <div className="ak-agent-context-controls">
        {contextControls.map(control => <label key={control.id}><input type="checkbox" checked={record.context[control.id] ?? false} onChange={event => report(agent.context(id, control.id, event.currentTarget.checked))} />{control.label}</label>)}
      </div>
      <label htmlFor={draftId}>{composerLabel}</label>
      <textarea ref={draftRef} id={draftId} placeholder={placeholder} value={draft}
        onChange={event => { const value = event.currentTarget.value; draftVersion.current += 1; setDraft(value); report(agent.draft(id, value)); }} />
      {error || agent.error(id) ? <p role="alert">{error || agent.error(id)}</p> : null}
      <div><small>{busy ? 'Generating…' : ''}</small><button className="ak-agent-send" type="submit" disabled={busy || !draft.trim()}>Send</button></div>
    </form>
  </section>;
}
