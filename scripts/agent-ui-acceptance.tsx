/** Isolated Eagle UI fixture; production never imports this module. */
import { createRoot } from 'react-dom/client';
import App from '../src/app/App';
import { sharedModules } from '../src/app/plugin-catalog';
import { WorkspaceStore } from '../src/host/workspaces/store';
import { PluginCatalog } from '../src/host/workspaces/catalog';
import { InstancePreferences } from '../src/host/workspaces/preferences';

export async function mount(root: string, builtins: string) {
  const hostRequire = (globalThis as unknown as { require: NodeRequire }).require;
  const fs = hostRequire('node:fs') as typeof import('node:fs');
  const path = hostRequire('node:path') as typeof import('node:path');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, '.power-eagle-state.json'), JSON.stringify({ format: 'power-eagle/state', formatVersion: 1 }));
  const store = new WorkspaceStore(root, hostRequire);
  await store.register(path.join(builtins, 'example.runtime-flow'), { kind: 'built-in', sourceId: 'example.runtime-flow' });
  await store.register(path.join(builtins, 'power-eagle.paper-pop'), { kind: 'built-in', sourceId: 'power-eagle.paper-pop' });
  if (!store.read().instances.some(instance => instance.name === 'Agent check')) await store.create('Agent check');
  const prefs = store.bounded('preferences.json');
  const catalog = new PluginCatalog(InstancePreferences.open({ read: () => fs.existsSync(prefs) ? fs.readFileSync(prefs, 'utf8') : null,
    write: value => store.atomicWrite('preferences.json', JSON.parse(value)) }), { hostRequire, sharedModules }, store);
  await catalog.refresh();
  window.addEventListener('pagehide', () => { void catalog.dispose(); });
  createRoot(document.getElementById('root')!).render(<App catalog={catalog} />);
}
