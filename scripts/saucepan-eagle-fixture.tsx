/** Outside-checkout acceptance page; never imported by the production application. */
import { createRoot } from 'react-dom/client';
import App from '../src/app/App';
import { sharedModules } from '../src/app/plugin-catalog';
import { WorkspaceStore } from '../src/host/workspaces/store';
import { PluginCatalog } from '../src/host/workspaces/catalog';
import { InstancePreferences } from '../src/host/workspaces/preferences';
import type { openWorkbenchAcquisition } from '../src/host/install/workbench-acquisition';

async function run() {
  const host = globalThis as unknown as { require: NodeRequire; eagle?: { app?: { version?: string; build?: number } } };
  if (!host.eagle || !host.require) throw new Error('This acceptance fixture requires actual Eagle.');
  const fs = host.require('node:fs') as typeof import('node:fs');
  const path = host.require('node:path') as typeof import('node:path');
  const process = host.require('node:process') as typeof import('node:process');
  const config = (globalThis as unknown as { fixtureConfig: { root: string; binaryPath: string } }).fixtureConfig;
  const resultPath = path.join(config.root, 'result.json');
  const prior = fs.existsSync(resultPath) ? JSON.parse(fs.readFileSync(resultPath, 'utf8')) : undefined;
  const report = prior ?? { passed: false, checks: [], runtime: process.versions, platform: process.platform, arch: process.arch,
    eagle: { version: host.eagle.app?.version, build: host.eagle.app?.build }, timestamp: new Date().toISOString(), root: config.root };
  const status = document.getElementById('acceptance-status')!;
  const save = () => {
    report.eagle = { version: host.eagle?.app?.version, build: host.eagle?.app?.build };
    fs.writeFileSync(resultPath, JSON.stringify(report, null, 2)); status.textContent = JSON.stringify(report, null, 2);
  };
  const check = (name: string, value: unknown) => { report.checks.push({ name, passed: Boolean(value) }); save(); if (!value) throw new Error(name); };
  try {
    const store = new WorkspaceStore(path.join(config.root, 'state'), host.require);
    const catalog = new PluginCatalog(InstancePreferences.open({ read: () => null, write: () => {} }), { hostRequire: host.require, sharedModules }, store);
    await catalog.refresh();
    const integration = host.require(path.join(config.root, 'dist', 'saucepan-host.cjs')) as { openWorkbenchAcquisition: typeof openWorkbenchAcquisition };
    const acquisition = await integration.openWorkbenchAcquisition(catalog, { binaryPath: config.binaryPath, root: path.join(config.root, 'manager') });
    catalog.acquisition = acquisition;
    check('released manager probe', !acquisition.unavailable);
    const root = createRoot(document.getElementById('root')!);
    const source = path.join(config.root, 'source');
    if (!prior) {
      check('startup did not create manager store', !fs.existsSync(path.join(config.root, 'manager')));
      await acquisition.setup();
      const instance = await acquisition.install({ source: { type: 'local', path: source }, selector: { type: 'local' } });
      report.instanceId = instance.instanceId;
      check('installed and activated immutable revision', catalog.snapshot().claims.get(instance.instanceId)?.status === 'active');
      root.render(<App catalog={catalog} />);
      await new Promise(resolve => setTimeout(resolve, 500));
      check('workbench package controls rendered', document.body.textContent?.includes('Refresh source'));
      report.phase = 'awaiting-renderer-restart'; save();
      const restart = document.createElement('button'); restart.textContent = 'Restart acceptance renderer';
      restart.onclick = () => { void catalog.dispose().then(() => location.reload()); };
      document.getElementById('fixture-actions')!.append(restart);
      return;
    }
    check('rediscovered after renderer restart', store.read().instances[0]?.instanceId === report.instanceId);
    root.render(<App catalog={catalog} />);
    const manifestPath = path.join(source, 'manifest.json');
    const original = fs.readFileSync(manifestPath, 'utf8');
    fs.writeFileSync(manifestPath, JSON.stringify({ ...JSON.parse(original), version: '1.0.1' }));
    const refreshed = await acquisition.refresh(report.instanceId);
    check('refresh kept identity and advanced revision', refreshed.instanceId === report.instanceId && refreshed.currentRevision === 2);
    fs.writeFileSync(manifestPath, '{}');
    let rejected = false;
    try { await acquisition.refresh(report.instanceId); } catch { rejected = true; }
    check('failed replacement preserved active revision', rejected && store.read().instances[0].currentRevision === 2 && catalog.snapshot().claims.get(report.instanceId)?.status === 'active');
    fs.writeFileSync(manifestPath, original);
    const copy = await catalog.create('Acceptance independent copy', { instanceId: report.instanceId, revision: 2 });
    await acquisition.remove(report.instanceId);
    check('removal preserved independent copy and source', store.read().instances[0]?.instanceId === copy.instanceId && fs.existsSync(source));
    // Invalid candidates deliberately remain retained for recovery; the installed pin must be gone.
    check('removed installation pin released', !acquisition.app!.retainedReceipts().some(item => item.pinUuid === refreshed.acquisition!.pinUuid));
    await catalog.dispose();
    report.phase = 'complete'; report.passed = true; save();
  } catch (error) { report.error = String(error); report.passed = false; save(); throw error; }
}
void run().catch(error => { document.getElementById('acceptance-status')!.textContent += `\n${String(error)}`; });
