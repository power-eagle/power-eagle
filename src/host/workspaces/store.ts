import { identifier, type PackageManifest, type RuntimeDocument } from '../../sdui/schema/model';
import { foundationRuntimeCatalog } from '../../sdui/runtime/foundation';
import { unwrap, validateRuntime, type ValidationCatalog } from '../../sdui/schema/validate';
import { discoverContributionPackage } from '../install/contribution-package';
import { POWER_EAGLE_STATE_SENTINEL } from '../install/state-reset';
import { snapshotArtifact, type CopyOptions } from './artifact-copy';
import { newPluginInstance, parseWorkspaceCatalog, type PluginInstance, type WorkspaceCatalog } from './model';

export const emptyCatalog = (): WorkspaceCatalog => ({ format: 'power-eagle/workspace-catalog', formatVersion: 1, order: [], instances: [] });
export function blankDocument(): RuntimeDocument {
  return { format: 'power-eagle/runtime', formatVersion: 1, start: 'home', state: {}, actions: {}, components: {}, dependencies: [],
    screens: { home: { params: { type: 'object', properties: {}, required: [] }, state: {}, body: { type: 'Column', props: {}, slots: { children: [] } } } } };
}

/** One atomic catalog is authoritative; unreachable staged artifacts never become plugins. */
export class WorkspaceStore {
  readonly fs: typeof import('node:fs');
  readonly path: typeof import('node:path');
  readonly root: string;
  constructor(stateRoot: string, readonly hostRequire: NodeRequire) {
    this.fs = hostRequire('node:fs'); this.path = hostRequire('node:path');
    const sentinel = JSON.parse(this.fs.readFileSync(this.path.join(stateRoot, POWER_EAGLE_STATE_SENTINEL), 'utf8'));
    if (sentinel.format !== 'power-eagle/state' || sentinel.formatVersion !== 1 || this.fs.lstatSync(stateRoot).isSymbolicLink()) throw new Error('Workspace storage requires the owned Power Eagle state root');
    const root = this.path.join(this.fs.realpathSync(stateRoot), 'workspaces');
    if (this.fs.existsSync(root) && this.fs.lstatSync(root).isSymbolicLink()) throw new Error('Workspace root cannot be a link');
    this.fs.mkdirSync(root, { recursive: true }); this.root = this.fs.realpathSync(root);
  }

  bounded(...parts: string[]): string {
    const result = this.path.resolve(this.root, ...parts);
    const relative = this.path.relative(this.root, result);
    if (!relative || relative === '..' || relative.startsWith(`..${this.path.sep}`) || this.path.isAbsolute(relative)) throw new Error('Workspace path escapes its owned root');
    let cursor = result;
    while (cursor !== this.root) {
      if (this.fs.existsSync(cursor) && this.fs.lstatSync(cursor).isSymbolicLink()) throw new Error('Workspace path contains a link');
      cursor = this.path.dirname(cursor);
    }
    return result;
  }
  artifact(instance: PluginInstance, revision = instance.currentRevision): string {
    identifier.parse(instance.instanceId);
    const record = instance.revisions.find(item => item.id === revision);
    if (!record) throw new Error('Revision does not belong to this plugin');
    return this.bounded('instances', instance.instanceId, record.artifact);
  }
  read(): WorkspaceCatalog {
    const file = this.bounded('catalog.json');
    return this.fs.existsSync(file) ? parseWorkspaceCatalog(JSON.parse(this.fs.readFileSync(file, 'utf8'))) : emptyCatalog();
  }
  atomicWrite(relative: string, value: unknown): void {
    const file = this.bounded(relative);
    const temporary = this.bounded(`${relative}.tmp-${crypto.randomUUID()}`);
    this.fs.mkdirSync(this.path.dirname(file), { recursive: true });
    try {
      const fd = this.fs.openSync(temporary, 'wx');
      try { this.fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`); this.fs.fsyncSync(fd); } finally { this.fs.closeSync(fd); }
      this.fs.renameSync(temporary, file);
    } finally { if (this.fs.existsSync(temporary)) this.fs.unlinkSync(temporary); }
  }
  async transaction<T>(operation: (catalog: WorkspaceCatalog) => Promise<T>): Promise<T> {
    const lock = this.bounded('.lock');
    let fd: number;
    try { fd = this.fs.openSync(lock, 'wx'); }
    catch { throw new Error('Plugin storage is busy. Retry after the other operation finishes.'); }
    try { return await operation(this.read()); }
    finally { this.fs.closeSync(fd); this.fs.unlinkSync(lock); }
  }
  private publish(catalog: WorkspaceCatalog): void { this.atomicWrite('catalog.json', parseWorkspaceCatalog(catalog)); }
  private removeOwned(path: string): void { this.fs.rmSync(this.bounded(this.path.relative(this.root, path)), { recursive: true, force: true }); }

  async register(source: string, origin: PluginInstance['origin'], stableId?: string): Promise<PluginInstance> {
    return this.transaction(async catalog => {
      const existing = catalog.instances.find(item => stableId ? item.instanceId === stableId : item.origin.kind === origin.kind && item.origin.sourceId === origin.sourceId);
      if (existing) return existing;
      const discovered = discoverContributionPackage(source, this.hostRequire);
      const instance = newPluginInstance(discovered.manifest.name, origin);
      instance.namespace = discovered.manifest.id;
      if (stableId) instance.instanceId = identifier.parse(stableId);
      const destination = this.artifact(instance);
      try {
        await snapshotArtifact(source, destination, this.root, this.hostRequire);
        catalog.instances.push(instance); catalog.order.push(instance.instanceId); this.publish(catalog); return instance;
      } catch (error) { if (this.fs.existsSync(destination)) this.removeOwned(destination); throw error; }
    });
  }
  async create(name: string, source?: { instanceId: string; revision: number }, options: CopyOptions = {}): Promise<PluginInstance> {
    return this.transaction(async catalog => {
      const original = source ? catalog.instances.find(item => item.instanceId === source.instanceId) : undefined;
      if (source && !original) throw new Error('The selected source plugin no longer exists');
      const instance = newPluginInstance(name, { kind: 'local', sourceId: 'workspace' }, original ? { ...original, currentRevision: source!.revision } : undefined);
      const destination = this.artifact(instance);
      try {
        options.signal?.throwIfAborted();
        if (original) await snapshotArtifact(this.artifact(original, source!.revision), destination, this.root, this.hostRequire, options);
        else {
          const manifest: PackageManifest = { format: 'power-eagle/package', formatVersion: 1, id: instance.namespace, name: instance.name, version: '1.0.0', description: '', sdk: '^1.0.0', contributions: { runtime: 'run.json' }, exports: [{ kind: 'runtime', id: 'main', screens: ['home'] }], dependencies: [], assets: [] };
          const runtime = blankDocument();
          unwrap(validateRuntime(runtime, { widgets: Object.fromEntries(Object.entries(foundationRuntimeCatalog.widgets).map(([id, value]) => [id, value.contract])) }));
          this.fs.mkdirSync(destination, { recursive: true });
          this.fs.writeFileSync(this.path.join(destination, 'manifest.json'), JSON.stringify(manifest));
          this.fs.writeFileSync(this.path.join(destination, 'run.json'), JSON.stringify(runtime));
          discoverContributionPackage(destination, this.hostRequire);
        }
        options.signal?.throwIfAborted();
        catalog.instances.push(instance);
        if (original) catalog.order.splice(catalog.order.indexOf(original.instanceId) + 1, 0, instance.instanceId);
        else catalog.order.push(instance.instanceId);
        this.publish(catalog); return instance;
      } catch (error) { if (this.fs.existsSync(destination)) this.removeOwned(destination); throw error; }
    });
  }
  async reorder(order: string[]): Promise<void> { await this.transaction(async catalog => { this.publish({ ...catalog, order }); }); }

  async revise(instanceId: string, base: number, input: unknown, validation: ValidationCatalog): Promise<PluginInstance> {
    const runtime = unwrap(validateRuntime(input, validation));
    return this.transaction(async catalog => {
      const instance = catalog.instances.find(item => item.instanceId === instanceId);
      if (!instance) throw new Error('Plugin no longer exists');
      const next = Math.max(...instance.revisions.map(item => item.id)) + 1;
      const revision = { id: next, basedOn: base, artifact: `revisions/${next}`, createdAt: new Date().toISOString() };
      const updated = { ...instance, revisions: [...instance.revisions, revision], currentRevision: next };
      const destination = this.artifact(updated);
      try {
        const copied = await snapshotArtifact(this.artifact(instance, base), destination, this.root, this.hostRequire);
        const runtimePath = copied.manifest.contributions.runtime ?? 'run.json';
        const existing = copied.manifest.exports.find(item => item.kind === 'runtime');
        if (!existing && copied.manifest.exports.some(item => item.id === 'main')) throw new Error('Cannot add a runtime named main: that export already exists');
        const descriptor = { kind: 'runtime' as const, id: existing?.id ?? 'main', screens: [runtime.start, ...Object.keys(runtime.screens).filter(key => key !== runtime.start)] };
        const manifest = { ...copied.manifest, contributions: { ...copied.manifest.contributions, runtime: runtimePath }, exports: [...copied.manifest.exports.filter(item => item.kind !== 'runtime'), descriptor] };
        this.fs.mkdirSync(this.path.dirname(this.path.join(destination, runtimePath)), { recursive: true });
        this.fs.writeFileSync(this.path.join(destination, runtimePath), JSON.stringify(runtime));
        this.fs.writeFileSync(this.path.join(destination, 'manifest.json'), JSON.stringify(manifest));
        discoverContributionPackage(destination, this.hostRequire);
        catalog.instances = catalog.instances.map(item => item.instanceId === instanceId ? updated : item);
        this.publish(catalog); return updated;
      } catch (error) { if (this.fs.existsSync(destination)) this.removeOwned(destination); throw error; }
    });
  }
}
