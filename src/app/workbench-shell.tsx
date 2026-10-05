import { Component, useEffect, useState, type ReactNode } from 'react';
import { Button, Input, Panel, SectionLabel } from '../components/ui';

interface StageBoundaryProps { children: ReactNode; resetKey?: string }
interface StageBoundaryState { error: Error | null }

export class StageBoundary extends Component<StageBoundaryProps, StageBoundaryState> {
  state: StageBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): StageBoundaryState { return { error }; }
  componentDidCatch(): void { /* the stage owns its visible diagnostic */ }
  componentDidUpdate(previous: StageBoundaryProps): void {
    if (previous.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return <div className="pe-workbench-stage-error" role="alert">
      <strong>Stage could not render this view.</strong>
      <code>{this.state.error.message}</code>
      <p>Choose another source or retry this view. Sources and Agent remain available.</p>
      <Button size="sm" variant="secondary" onClick={() => this.setState({ error: null })}>Retry view</Button>
    </div>;
  }
}

export interface WorkbenchShellProps {
  stage: ReactNode;
  sources?: ReactNode;
  sourceHint?: string;
  stageTitle?: string;
  stageCaption?: string;
  active?: number;
  total?: number;
}

function compactWindow(): boolean { return typeof window !== 'undefined' && window.innerWidth < 760; }

export function WorkbenchShell({
  stage, sources, sourceHint = 'built-ins', stageTitle = 'Language foundation', stageCaption = 'example.runtime-flow · built-in · runtime', active = 4, total = 4,
}: WorkbenchShellProps) {
  const [sourcesCollapsed, setSourcesCollapsed] = useState(compactWindow);
  const [agentCollapsed, setAgentCollapsed] = useState(compactWindow);
  const [sourceDraft, setSourceDraft] = useState('');
  const [agentDraft, setAgentDraft] = useState('');

  useEffect(() => {
    const resize = () => {
      if (window.innerWidth < 760) {
        setSourcesCollapsed(true);
        setAgentCollapsed(true);
      }
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return <main className="pe-shell pe-ground" aria-label="Power Eagle workbench">
    <div className="pe-shell-frame">
      <header className="pe-shell-bar">
        <strong className="pe-wordmark pe-shell-wordmark">power<span>eagle</span></strong>
        <span className="pe-shell-count"><span className="pe-shell-live" aria-hidden="true" />{active} of {total} active</span>
      </header>
      <div className="pe-shell-panels" data-layout="sources-stage-agent">
        <Panel
          index="01" label="Sources" hint={sourceHint}
          className="pe-panel-source" collapsed={sourcesCollapsed}
          onToggleCollapsed={() => setSourcesCollapsed(value => !value)}
          footer={<form className="pe-source-footer" onSubmit={event => event.preventDefault()}>
            <Input
              size="sm" aria-label="Package source" placeholder="owner/repo or path"
              value={sourceDraft} onChange={event => setSourceDraft(event.currentTarget.value)}
            />
            <Button size="sm" variant="secondary" type="submit" disabled>Add</Button>
          </form>}
        >
          {sources ?? <nav className="pe-source-foundation" aria-label="Available source groups">
            <SectionLabel>built-in</SectionLabel>
            <div className="pe-source-foundation-row" aria-current="page">
              <span><strong>Language foundation</strong><small>runtime · version 1</small></span>
              <span className="pe-meta">active</span>
            </div>
            <div className="pe-source-foundation-row">
              <span><strong>Eagle tools</strong><small>3 runtimes · 9 actions</small></span>
              <span className="pe-meta">active</span>
            </div>
            <div className="pe-source-foundation-row">
              <span><strong>Widget catalog</strong><small>75 declarative types</small></span>
              <span className="pe-meta">active</span>
            </div>
          </nav>}
        </Panel>

        <Panel index="02" label="Stage" hint="preview" className="pe-panel-stage">
          <section className="pe-workbench-stage" aria-labelledby="workbench-stage-title">
            <header className="pe-workbench-stage-head">
              <span className="pe-workbench-stage-dot" aria-hidden="true" />
              <div>
                <h1 id="workbench-stage-title">{stageTitle}</h1>
                <p>{stageCaption}</p>
              </div>
              <span className="pe-meta">ready</span>
            </header>
            <div className="pe-workbench-stage-scroll pe-scroll">
              <div className="pe-workbench-stage-viewport">
                <StageBoundary resetKey={stageTitle}>{stage}</StageBoundary>
              </div>
            </div>
          </section>
        </Panel>

        <Panel
          index="03" label="Agent" hint="idle"
          className="pe-panel-agent" collapsed={agentCollapsed}
          onToggleCollapsed={() => setAgentCollapsed(value => !value)}
          footer={<form className="pe-agent-composer" onSubmit={event => event.preventDefault()}>
            <label htmlFor="agent-draft">Describe an extension</label>
            <textarea
              id="agent-draft" placeholder="What should Power Eagle build?"
              value={agentDraft} onChange={event => setAgentDraft(event.currentTarget.value)}
            />
            <div><span className="pe-meta">eagle agent</span><Button type="submit" disabled>Send</Button></div>
          </form>}
        >
          <div className="pe-agent-empty">
            <SectionLabel>conversation</SectionLabel>
            <p>No conversation yet.</p>
            <small>Generated runtime versions will appear here and share the Stage selection.</small>
          </div>
        </Panel>
      </div>
    </div>
  </main>;
}
