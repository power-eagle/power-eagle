import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsx from 'react/jsx-runtime';
import { PluginAgent, eagleRuntimeModel } from './agent';
import { PluginCatalog } from './catalog';
import { WorkspaceStore, blankDocument } from './store';
import { InstancePreferences } from './preferences';
import { foundationRuntimeCatalog } from '../../sdui/runtime/foundation';

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
  it('saves immutable versions with earlier bases, separate clone drafts, monotonic IDs and reload', async () => {
    const model = vi.fn<(prompt: string) => Promise<string>>(async () => JSON.stringify(blankDocument()));
    const agent = new PluginAgent(catalog, model);
    await agent.draft(id, 'Create a dashboard'); await agent.send(id);
    expect(agent.record(id).turns[0]).toMatchObject({ status: 'success', base: 1, revision: 2 });
    await agent.selectBase(id, 1); await agent.draft(id, 'Try another design'); await agent.send(id);
    expect(agent.record(id).turns[1]).toMatchObject({ status: 'success', base: 1, revision: 3 });
    expect(model.mock.calls[1][0]).toContain('Selected base document');
    await agent.hideTurn(id, 2); await agent.draft(id, 'Keep my original draft');
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
    expect(agent.error(id)).toContain('could not activate');
    expect(store.read().instances[0].currentRevision).toBe(1);
    expect(catalog.snapshot().claims.get(id)?.status).toBe('active');
    await agent.hideTurn(id, 1);
    expect(store.read().instances[0].revisions.map(item => item.id)).toEqual([1, 2]);
  });
});
