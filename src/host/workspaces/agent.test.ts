import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsx from 'react/jsx-runtime';
import { PluginAgent, eagleRuntimeModel } from './agent';
import { PluginCatalog } from './catalog';
import { WorkspaceStore, blankDocument } from './store';
import { InstancePreferences } from './preferences';
import { foundationRuntimeCatalog } from '../../sdui/runtime/foundation';
import { defaultAgentSettings, type AgentProviders, type ProviderRequest } from './agent-types';

const hostRequire = createRequire(import.meta.url);
let root: string; let store: WorkspaceStore; let catalog: PluginCatalog; let id: string;
beforeEach(async () => {
  mkdirSync('.artifacts', { recursive: true }); root = mkdtempSync(resolve('.artifacts/agent-test-'));
  writeFileSync(join(root, '.power-eagle-state.json'), JSON.stringify({ format: 'power-eagle/state', formatVersion: 1 }));
  store = new WorkspaceStore(root, hostRequire); id = (await store.create('Original')).instanceId;
  catalog = new PluginCatalog(InstancePreferences.open({ read: () => null, write: () => {} }), { hostRequire, sharedModules: { react: React, 'react-dom': ReactDOM, 'react/jsx-runtime': jsx } }, store);
  await catalog.refresh();
});
afterEach(async () => { await catalog.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); rmSync(root, { recursive: true, force: true }); });

describe('instance-bound runtime authoring', () => {
  it('upgrades current records without losing hidden history and retains an exact recovery catalog', async () => {
    const old = { format: 'power-eagle/conversation', formatVersion: 1, instanceId: id, selectedBase: 1, draft: 'Keep this draft', context: { eagle: false, web: true }, nextTurnId: 2,
      turns: [{ id: 1, base: 1, instruction: 'Old hidden request', createdAt: new Date().toISOString(), status: 'failed', error: 'offline', hidden: true }] };
    const original = { ...store.read(), conversations: { [id]: old } };
    writeFileSync(store.bounded('catalog.json'), JSON.stringify(original));
    const upgraded = new PluginAgent(catalog, async () => JSON.stringify(blankDocument()));
    expect(upgraded.record(id)).toMatchObject({ formatVersion: 2, draft: 'Keep this draft', settings: { provider: 'eagle' }, turns: [{ hidden: true, choice: { provider: 'eagle' } }] });
    await upgraded.draft(id, 'Updated draft');
    expect(JSON.parse(readFileSync(store.bounded('catalog.before-agent-v2.json'), 'utf8'))).toEqual(original);
    expect(store.read().conversations[id].draft).toBe('Updated draft');
    writeFileSync(store.bounded('catalog.json'), JSON.stringify(original)); // Exercise recovery on this disposable fixture.
    expect(new PluginAgent(catalog).record(id).draft).toBe('Keep this draft');
    const atomic = vi.spyOn(store, 'atomicWrite').mockImplementation(() => { throw Error('upgrade write failed'); });
    await expect(upgraded.draft(id, 'Cannot save')).rejects.toThrow('upgrade write failed');
    atomic.mockRestore(); expect(JSON.parse(readFileSync(store.bounded('catalog.json'), 'utf8'))).toEqual(original);
  });

  it('snapshots providers and API flags, retries the original base, and protects nonempty drafts', async () => {
    const requests: ProviderRequest[] = [];
    let finish!: (value: string) => void;
    const providers: AgentProviders = { available: async () => true, discover: async () => [], generate: vi.fn(async request => {
      requests.push(request); if (requests.length === 1) throw Error('offline'); return new Promise<string>(resolve => { finish = resolve; });
    }) };
    const agent = new PluginAgent(catalog, providers);
    await agent.draft(id, 'Keep blue accents'); await agent.send(id);
    expect(agent.error(id)).toBeUndefined(); expect(agent.record(id).turns[0].error).toBe('offline');
    await agent.draft(id, 'Unrelated draft');
    await expect(agent.editRequest(id, 1)).rejects.toThrow('draft has been kept');
    expect(agent.record(id).draft).toBe('Unrelated draft');
    await agent.editRequest(id, 1, true); expect(requests).toHaveLength(1);
    await agent.context(id, 'web', true);
    await agent.settings(id, { ...defaultAgentSettings(), provider: 'codex', codex: { model: 'model-a' } });
    const pending = agent.retry(id, 1);
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    await agent.settings(id, { ...defaultAgentSettings(), provider: 'claude' });
    expect(requests[1]).toMatchObject({ base: 1, choice: { provider: 'codex', model: 'model-a' }, context: { eagle: true, web: false } });
    expect(requests[1].prompt).toContain('"status":"failed"');
    finish(JSON.stringify(blankDocument())); await pending;
    expect(agent.record(id).turns[1]).toMatchObject({ retryOf: 1, base: 1, choice: { provider: 'codex', model: 'model-a' }, status: 'success' });
    expect(agent.record(id).turns[0].status).toBe('failed');
    expect(agent.record(id).settings.provider).toBe('claude');
    expect(agent.record(id).draft).toBe('Keep blue accents');
  });

  it('coalesces model discovery, refreshes it and rejects a known unsupported effort before inference', async () => {
    const providers: AgentProviders = { available: vi.fn(async () => true), discover: vi.fn(async () => [{ id: 'a', label: 'A', isDefault: true, efforts: ['low'] }]), generate: vi.fn(async () => '{}') };
    const agent = new PluginAgent(catalog, providers);
    await Promise.all([agent.discover('codex'), agent.discover('codex')]);
    expect(providers.discover).toHaveBeenCalledTimes(1);
    await agent.discover('codex'); expect(providers.discover).toHaveBeenCalledTimes(1);
    await agent.discover('codex', true); expect(providers.discover).toHaveBeenCalledTimes(2);
    await agent.settings(id, { ...defaultAgentSettings(), provider: 'codex', codex: { model: 'a', effort: 'high' } });
    await agent.draft(id, 'Try'); await agent.send(id);
    expect(providers.generate).not.toHaveBeenCalled(); expect(agent.record(id).turns[0].error).toContain('effort is unavailable');
    vi.mocked(providers.discover).mockRejectedValueOnce(Error('offline')); await agent.discover('codex', true);
    expect(agent.providerCatalog('codex')?.state).toBe('unavailable');
    expect(agent.record(id).settings.codex).toEqual({ model: 'a', effort: 'high' });
  });

  it('reports a pending-record write failure at the composer and retains its draft', async () => {
    const model = vi.fn(async () => JSON.stringify(blankDocument()));
    const agent = new PluginAgent(catalog, model);
    await agent.draft(id, 'Retain me');
    vi.spyOn(store, 'atomicWrite').mockImplementationOnce(() => { throw Error('Cannot create request'); });
    await agent.send(id);
    expect(agent.error(id)).toBe('Cannot create request');
    expect(agent.record(id).draft).toBe('Retain me'); expect(agent.record(id).turns).toEqual([]);
    expect(model).not.toHaveBeenCalled();
  });
  it('saves immutable versions with earlier bases, separate clone drafts, monotonic IDs and reload', async () => {
    const model = vi.fn<(prompt: string) => Promise<string>>(async () => JSON.stringify(blankDocument()));
    const agent = new PluginAgent(catalog, model);
    await agent.draft(id, 'Create a dashboard'); await agent.send(id);
    expect(agent.record(id).turns[0]).toMatchObject({ status: 'success', base: 1, revision: 2 });
    await agent.selectBase(id, 1); await agent.draft(id, 'Try another design'); await agent.send(id);
    expect(agent.record(id).turns[1]).toMatchObject({ status: 'success', base: 1, revision: 3 });
    expect(model.mock.calls[1][0]).toContain('Selected base document');
    await store.conversation(id, record => { record.turns[1].hidden = true; }); await agent.draft(id, 'Keep my original draft');
    const copy = await catalog.create('Copy', { instanceId: id, revision: 1 });
    expect(agent.record(copy.instanceId).turns).toEqual([]);
    expect(agent.record(copy.instanceId).draft).toBe('');
    await agent.draft(copy.instanceId, 'Independent');
    expect(agent.record(id).draft).toBe('Keep my original draft');
    const restored = new PluginAgent(catalog, model);
    expect(restored.record(id).turns[1].hidden).toBe(true);
    expect(restored.record(copy.instanceId).draft).toBe('Independent');
    await restored.send(id);
    expect(restored.record(id).turns[2]).toMatchObject({ id: 3, revision: 4 });
    expect(store.read().instances.find(item => item.instanceId === id)?.revisions.map(item => item.id)).toEqual([1, 2, 3, 4]);
    expect(catalog.snapshot().entries).toHaveLength(2);
  });

  it('retains the last valid revision for model, JSON, unsupported implementation and storage failures', async () => {
    const model = vi.fn<(prompt: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error('model unavailable')).mockResolvedValueOnce('{"bad":true}')
      .mockResolvedValueOnce('{"unsupported":"Install a compiled camera provider"}')
      .mockImplementationOnce(async () => { vi.spyOn(store, 'atomicWrite').mockImplementation(() => { throw new Error('disk full'); }); return JSON.stringify(blankDocument()); });
    const agent = new PluginAgent(catalog, model);
    for (const instruction of ['One', 'Two', 'Three', 'Four']) { await agent.draft(id, instruction); await agent.send(id); }
    expect(agent.error(id)).toBe('disk full');
    expect(store.read().instances[0].currentRevision).toBe(1);
    expect(agent.record(id).turns.slice(0, 3).map(turn => turn.status)).toEqual(['failed', 'failed', 'failed']);
    expect(agent.record(id).turns[2].error).toContain('Compiled provider required');
    vi.restoreAllMocks();
    const recovered = new PluginAgent(catalog, model); await recovered.recoverInterrupted();
    expect(recovered.record(id).turns[3].status).toBe('failed');
  });

  it('captures one turn while permitting other plugin drafts and base selection without redirecting completion', async () => {
    let finish!: (text: string) => void;
    const model = vi.fn(() => new Promise<string>(resolve => { finish = resolve; }));
    const agent = new PluginAgent(catalog, model);
    const other = await catalog.create('Other');
    await agent.draft(id, 'A'); const pending = agent.send(id); await agent.send(id);
    await vi.waitFor(() => expect(model).toHaveBeenCalledOnce());
    await agent.draft(other.instanceId, 'B draft');
    finish(JSON.stringify(blankDocument())); await pending;
    expect(agent.record(id).turns[0].revision).toBe(2);
    expect(agent.record(other.instanceId).turns).toEqual([]);
    expect(agent.record(other.instanceId).draft).toBe('B draft');
    await agent.draft(id, 'Another'); const second = agent.send(id);
    await vi.waitFor(() => expect(model).toHaveBeenCalledTimes(2));
    await agent.selectBase(id, 1); finish(JSON.stringify(blankDocument())); await second;
    expect(store.read().instances.find(item => item.instanceId === id)?.currentRevision).toBe(1);
    expect(agent.record(id).turns[1]).toMatchObject({ base: 2, revision: 3 });
    expect(agent.record(id).selectedBase).toBe(1);
  });

  it('provides custom widget contracts and revalidates against providers disabled during generation', async () => {
    const source = join(root, 'widget'); mkdirSync(source);
    const descriptor = { kind: 'widget', id: 'label', contract: { ...foundationRuntimeCatalog.widgets.Text.contract, example: { type: 'custom.labels/label', props: { text: 'Custom' } } } };
    writeFileSync(join(source, 'manifest.json'), JSON.stringify({ format: 'power-eagle/package', formatVersion: 1, id: 'custom.labels', name: 'Labels', version: '1.0.0', sdk: '^1.0.0', description: '', contributions: { widgets: 'types.cjs' }, exports: [descriptor], dependencies: [], assets: [] }));
    writeFileSync(join(source, 'types.cjs'), `module.exports = sdk => ({ format: 'power-eagle/provider', formatVersion: 1, kind: 'widget', exports: [{ descriptor: ${JSON.stringify(descriptor)}, implementation: { render: props => sdk.sharedModules.react.createElement('span', null, props.props.text) } }] });`);
    const provider = await store.register(source, { kind: 'acquired', sourceId: 'labels' }); await catalog.refresh();
    const document = blankDocument(); document.screens.home.body = { type: 'custom.labels/label', props: { text: 'Custom' } };
    document.dependencies = [{ package: 'custom.labels', export: 'label', kind: 'widget', version: '^1.0.0' }];
    let finish!: (value: string) => void;
    const model = vi.fn((prompt: string) => { expect(prompt).toContain('custom.labels/label'); return new Promise<string>(resolve => { finish = resolve; }); });
    const agent = new PluginAgent(catalog, model); await agent.draft(id, 'Custom'); const pending = agent.send(id);
    await vi.waitFor(() => expect(model).toHaveBeenCalledOnce()); finish(JSON.stringify(document)); await pending;
    expect(agent.record(id).turns[0].status).toBe('success');
    await agent.draft(id, 'Custom again'); const changed = agent.send(id);
    await vi.waitFor(() => expect(model).toHaveBeenCalledTimes(2));
    await catalog.setEnabled(provider.instanceId, false); finish(JSON.stringify(document)); await changed;
    expect(agent.record(id).turns[1].status).toBe('failed');
    expect(store.read().instances.find(item => item.instanceId === id)?.currentRevision).toBe(2);
  });

  it('uses Eagle’s configured chat model and returns only text for JSON validation', async () => {
    const ai = { getDefaultModel: vi.fn(() => 'chat-model'), getModel: vi.fn(() => ({ id: 'chat-model' })), generateText: vi.fn(async () => ({ text: '{}' })) };
    vi.stubGlobal('eagle', { extraModule: { ai } });
    expect(await eagleRuntimeModel('prompt')).toBe('{}');
    expect(ai.getDefaultModel).toHaveBeenCalledWith('chat');
    expect(ai.generateText).toHaveBeenCalledWith({ model: { id: 'chat-model' }, prompt: 'prompt' });
    vi.stubGlobal('eagle', undefined); await expect(eagleRuntimeModel('prompt')).rejects.toThrow('Configure a chat model');
  });

  it('records a generated dependency cycle as activation failure and restores the previous selected revision', async () => {
    const instance = store.read().instances[0];
    const output = blankDocument();
    output.dependencies.push({ package: instance.namespace, export: 'main', kind: 'runtime', version: '^1.0.0' });
    const agent = new PluginAgent(catalog, async () => JSON.stringify(output));
    await agent.draft(id, 'A cyclic view'); await agent.send(id);
    expect(agent.record(id).turns[0].status).toBe('failed');
    expect(agent.record(id).turns[0].error).toContain('could not activate');
    expect(store.read().instances[0].currentRevision).toBe(1);
    expect(catalog.snapshot().claims.get(id)?.status).toBe('active');
    expect(agent.error(id)).toBeUndefined();
    expect(store.read().instances[0].revisions.map(item => item.id)).toEqual([1, 2]);
  });
});
