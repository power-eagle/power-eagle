import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AgentController } from './controller.js';
import { selectedProvider, type AgentSettings } from './types.js';
import { useSelectionKey } from './selection-key.js';
export interface AgentSettingsPanelProps { agent: AgentController; conversationId: string; description?: string }
export function AgentSettingsPanel(props: AgentSettingsPanelProps) {
  return <SettingsPanel key={useSelectionKey(props.agent, props.conversationId)} {...props} />;
}
function SettingsPanel({ agent, conversationId: instanceId, description = 'Choose how Agent generates changes. Changes apply to your next request.' }: AgentSettingsPanelProps) {
  useSyncExternalStore(agent.subscribe, agent.snapshot, agent.snapshot);
  const settings = agent.record(instanceId).settings;
  const choice = selectedProvider(settings);
  const [error, setError] = useState('');
  const catalog = agent.provider(choice.provider)?.managed ? undefined : agent.providerCatalog(choice.provider);
  const model = catalog?.models.find(item => choice.model ? item.id === choice.model : item.isDefault);
  useEffect(() => { if (!agent.provider(settings.provider)?.managed) void agent.discover(settings.provider); }, [agent, settings.provider]);
  const save = (value: AgentSettings) => { setError(''); void agent.settings(instanceId, value).catch(reason => setError(String(reason))); };
  const refresh = () => { if (!agent.provider(choice.provider)?.managed) void agent.discover(choice.provider, true); };
  return <section className="ak-agent-settings" aria-label="Agent provider settings">
    <p>{description}</p>
    <label>Provider<select value={choice.provider} onChange={event => save({ ...settings, provider: event.currentTarget.value })}>
      {!agent.provider(choice.provider) ? <option value={choice.provider}>{choice.provider} · unavailable</option> : null}
      {agent.providers.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
    </select></label>
    {agent.provider(choice.provider)?.managed ? <p>{agent.provider(choice.provider)?.managed?.description}</p> : <>
      <small>{catalog?.installed === undefined ? 'Checking provider…' : catalog.installed ? 'Provider available · model access is checked when you send' : 'Provider unavailable'}</small>
      <label>Model<select value={choice.model ?? ''} disabled={catalog?.state === 'loading'} onChange={event => save({ ...settings, choices: { ...settings.choices, [choice.provider]: { model: event.currentTarget.value || undefined } } })}>
        <option value="">Provider default</option>
        {choice.model && !catalog?.models.some(item => item.id === choice.model) ? <option value={choice.model}>{choice.model} · not in current catalog</option> : null}
        {catalog?.models.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label>
      {(model?.efforts.length || choice.effort) ? <label>Effort<select value={choice.effort ?? ''} onChange={event => save({ ...settings, choices: { ...settings.choices, [choice.provider]: { model: choice.model, effort: event.currentTarget.value || undefined } } })}>
        <option value="">Model default{model?.defaultEffort ? ` (${model.defaultEffort})` : ''}</option>
        {choice.effort && !model?.efforts.includes(choice.effort) ? <option value={choice.effort}>{choice.effort} · unavailable</option> : null}
        {model?.efforts.map(effort => <option key={effort} value={effort}>{effort}</option>)}
      </select></label> : null}
      {catalog?.state === 'loading' ? <p role="status">Loading models…</p> : null}
      {catalog?.error ? <p role="status">{catalog.error} Your selection has been kept.</p> : null}
      <div className="ak-agent-recovery"><button type="button" disabled={catalog?.state === 'loading'} onClick={refresh}>Reconnect</button>
        <button type="button" disabled={catalog?.state === 'loading'} onClick={refresh}>Refresh models</button></div>
      <small>{agent.provider(choice.provider)?.setupHint}</small>
    </>}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
