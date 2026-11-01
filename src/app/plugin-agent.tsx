import { AgentPanel } from '@power-eagle/agent/react';
import type { PluginAgent } from '../host/workspaces/agent';
import type { CatalogEntry } from '../host/workspaces/catalog';

export function PluginAgentPanel({ agent, entry, onSettings }: { agent: PluginAgent; entry: CatalogEntry; onSettings?(): void }) {
  const instance = entry.instance;
  return <AgentPanel agent={agent.controller} conversationId={instance.instanceId} title={instance.name}
    titleHint={instance.forkOf ? `Copied from ${instance.forkOf.instanceId}, v${instance.forkOf.revision}` : undefined}
    revisions={instance.revisions} currentRevision={instance.currentRevision} revisionsLabel="Plugin revisions"
    contextControls={[{ id: 'eagle', label: 'Eagle API' }, { id: 'web', label: 'Web API' }]}
    composerLabel="Describe this plugin" placeholder="What should this plugin do?" onSettings={onSettings}
    emptyMessage="Describe what this plugin should do. Each saved version stays in this plugin."
    notice={!entry.discovered.runtime ? 'This plugin supplies compiled providers. Agent can add a runtime interface; changes to its compiled implementation use the package authoring workflow.' : undefined} />;
}
