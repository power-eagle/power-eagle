/**
 * The app-facing host service: composes the built-in plugin catalog with the
 * saucepan-backed install index into one surface the shell consumes. Built-ins
 * are always available and launchable; saucepan-installed plugins are listed,
 * and become launchable once a built-in (or a future disk loader) backs them.
 */
import { listBuiltins, getBuiltin, type AnyPluginModule } from '../plugins/builtins';
import {
  resolveSaucepanRoot,
  ensureRoot,
  listInstalled,
  listBuckets,
  install,
  addBucket,
  type SaucepanOptions,
  type SaucepanEntry,
} from '../host/install/saucepan';
import { ensureSaucepanBinary, type EnsureBinaryOptions } from '../host/install/saucepan-binary';

/** One plugin the shell can show, from either the built-in catalog or saucepan. */
export interface PluginSummary {
  id: string;
  name: string;
  version: string;
  source: 'builtin' | 'github' | 'local' | 'customgit';
  launchable: boolean;
}

/** Map saucepan index entries to plugin summaries (id from the manifest, else name). */
export function mapInstalled(entries: SaucepanEntry[]): PluginSummary[] {
  return entries.map((item) => {
    const id = typeof item.sauce.id === 'string' ? item.sauce.id : item.sauce.name;
    return {
      id,
      name: item.sauce.name,
      version: item.sauce.version,
      source: item.source_type,
      launchable: getBuiltin(id) !== undefined,
    };
  });
}

/** Built-ins first, then installed plugins that do not duplicate a built-in id. */
export function mergeAvailable(installed: PluginSummary[]): PluginSummary[] {
  const builtins: PluginSummary[] = listBuiltins().map((manifest) => ({
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    source: 'builtin',
    launchable: true,
  }));
  const seen = new Set(builtins.map((entry) => entry.id));
  return [...builtins, ...installed.filter((entry) => !seen.has(entry.id))];
}

/** The surface the shell uses to list, install, and launch plugins. */
export interface HostService {
  listAvailable(): PluginSummary[];
  listBuckets(): string[];
  install(name: string): void;
  addBucket(url: string): void;
  getLaunchable(id: string): AnyPluginModule | undefined;
}

/** Build a host service over a resolved saucepan invocation context. */
export function createHostService(saucepan: SaucepanOptions): HostService {
  return {
    listAvailable: () => mergeAvailable(mapInstalled(listInstalled(saucepan))),
    listBuckets: () => listBuckets(saucepan),
    install: (name) => install(saucepan, name),
    addBucket: (url) => addBucket(saucepan, url),
    getLaunchable: (id) => getBuiltin(id),
  };
}

/** Options for initializing the host service (binary cache + saucepan root). */
export type InitHostServiceOptions = EnsureBinaryOptions & {
  root?: string;
  runner?: SaucepanOptions['runner'];
};

/** Ensure the saucepan binary + root, then build the host service. */
export async function initHostService(options: InitHostServiceOptions = {}): Promise<HostService> {
  const binaryPath = await ensureSaucepanBinary(options);
  const root = resolveSaucepanRoot(options.root);
  ensureRoot({ root, binaryPath });
  return createHostService({ root, binaryPath, runner: options.runner });
}
