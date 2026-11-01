import { AgentSettingsPanel as PortableSettings } from '@power-eagle/agent/react';
import type { PluginAgent } from '../host/workspaces/agent';

export function AgentSettingsPanel({ agent, instanceId }: { agent: PluginAgent; instanceId: string }) {
  return <PortableSettings agent={agent.controller} conversationId={instanceId}
    description="Choose how Agent generates changes for this plugin. Changes apply to your next request." />;
}
