/** Disposable host acceptance. Never imported by production. Build as CJS, call run(root) in Eagle. */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsx from 'react/jsx-runtime';
import { PluginAgent } from '../src/host/workspaces/agent';
import { WorkspaceStore } from '../src/host/workspaces/store';
import { PluginCatalog } from '../src/host/workspaces/catalog';
import { InstancePreferences } from '../src/host/workspaces/preferences';
import { defaultAgentSettings, type AgentProvider } from '../src/host/workspaces/agent-types';

export async function run(root: string) {
  const host = globalThis as unknown as { require: NodeRequire; eagle?: unknown };
  if (!host.eagle) throw Error('Actual Eagle host required');
  const fs = host.require('node:fs') as typeof import('node:fs');
  const path = host.require('node:path') as typeof import('node:path');
  const process = host.require('node:process') as typeof import('node:process');
  fs.mkdirSync(root, { recursive: true });
  const state = fs.mkdtempSync(path.join(root, 'state-'));
  fs.writeFileSync(path.join(state, '.power-eagle-state.json'), JSON.stringify({ format: 'power-eagle/state', formatVersion: 1 }));
  const store = new WorkspaceStore(state, host.require);
  const catalog = new PluginCatalog(InstancePreferences.open({ read: () => null, write: () => {} }), { hostRequire: host.require, sharedModules: { react: React, 'react-dom': ReactDOM, 'react/jsx-runtime': jsx } }, store);
  const report = { runtime: process.versions, started: new Date().toISOString(), checks: [] as { name: string; passed: boolean; detail?: string }[] };
  const save = () => fs.writeFileSync(path.join(root, 'acceptance.json'), JSON.stringify(report, null, 2));
  const check = (name: string, passed: boolean, detail?: string) => { report.checks.push({ name, passed, detail }); save(); };
  try {
    for (const provider of ['eagle', 'codex', 'claude'] as AgentProvider[]) {
      const instance = await catalog.create(`Synthetic ${provider} acceptance`);
      const id = instance.instanceId;
      const agent = new PluginAgent(catalog);
      await agent.settings(id, { ...defaultAgentSettings(), provider });
      if (provider !== 'eagle') {
        await agent.discover(provider, true);
        check(`${provider} models in Eagle`, agent.providerCatalog(provider)?.state === 'ready', String(agent.providerCatalog(provider)?.models.length ?? 0));
      }
      await agent.draft(id, 'Create a simple home view with a Text widget showing exactly Lighthouse. Future refinements must always retain the word Lighthouse. Return the complete runtime document.');
      await agent.send(id);
      const first = agent.record(id).turns[0];
      check(`${provider} validated first revision`, first.status === 'success', first.error ?? agent.error(id));
      if (first.status !== 'success') continue;
      await agent.selectBase(id, 1);
      await agent.draft(id, 'Starting from this selected blank base, create a Text widget containing the required word from my earlier instruction and append Harbor.');
      await agent.send(id);
      const second = agent.record(id).turns[1];
      check(`${provider} earlier-base contextual follow-up`, second.status === 'success' && second.base === 1 && second.contextInfo?.included.includes(first.id) === true, second.error);
      const updated = store.read().instances.find(item => item.instanceId === id)!;
      const runtime = fs.readFileSync(path.join(store.artifact(updated), 'run.json'), 'utf8');
      check(`${provider} followed prior instruction`, /Lighthouse/.test(runtime) && /Harbor/.test(runtime));
      const restored = new PluginAgent(catalog);
      check(`${provider} restored settings and transcript`, restored.record(id).settings.provider === provider && restored.record(id).turns.length === 2);
    }
  } catch (error) { check('Acceptance harness', false, String(error)); }
  finally { await catalog.dispose(); save(); }
  return report;
}
