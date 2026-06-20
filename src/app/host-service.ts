/**
 * The app-facing host service: composes the built-in plugin catalog with the
 * saucepan-backed install index into one surface the shell consumes. Built-ins
 * are always available and launchable; saucepan-installed plugins are listed,
 * and become launchable once a built-in (or a future disk loader) backs them.
 */
import { listBuiltins, getBuiltin, type AnyPluginModule } from '../plugins/builtins';
import { activatePlugin, pluginKind } from '../sdui/activate';
import { mergeThemes, EMPTY_THEME } from '../sdui/theme';
import type { Theme } from '../sdui/types';
import type { WidgetComponent } from '../sdui/render/render';
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
  kind: 'visual' | 'service' | 'styling';
  launchable: boolean;
}

/** Map saucepan index entries to plugin summaries (id from the manifest, else name). */
export function mapInstalled(entries: SaucepanEntry[]): PluginSummary[] {
  return entries.map((item) => {
    const id = typeof item.sauce.id === 'string' ? item.sauce.id : item.sauce.name;
    const kind = pluginKind({ service: Boolean(item.sauce.service), styling: Boolean(item.sauce.styling) });
    return {
      id,
      name: item.sauce.name,
      version: item.sauce.version,
      source: item.source_type,
      kind,
      launchable: kind === 'visual' && getBuiltin(id) !== undefined,
    };
  });
}

/** Built-ins first, then installed plugins that do not duplicate a built-in id. */
export function mergeAvailable(installed: PluginSummary[]): PluginSummary[] {
  const builtins: PluginSummary[] = listBuiltins().map((manifest) => {
    const kind = pluginKind(manifest);
    return {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      source: 'builtin',
      kind,
      launchable: kind === 'visual',
    };
  });
  const seen = new Set(builtins.map((entry) => entry.id));
  return [...builtins, ...installed.filter((entry) => !seen.has(entry.id))];
}

/** The shared runtime context contributed by service + styling plugins. */
export interface HostContext {
  services: Record<string, unknown>;
  widgets: Record<string, WidgetComponent>;
  theme: Theme;
}

/**
 * Activate the service and styling plugins among `modules` and collect their
 * contributions: service surfaces (for rt.service), styling widget types (to
 * merge into the renderer registry), and styling themes (folded into one global
 * theme). Visual plugins are skipped — they are launched on demand with this
 * context. Services activate against the accumulating registry so they can
 * depend on earlier services.
 */
export async function buildHostContext(
  modules: AnyPluginModule[],
  eagle: Record<string, unknown> = {},
): Promise<HostContext> {
  const services: Record<string, unknown> = {};
  let widgets: Record<string, WidgetComponent> = {};
  let theme: Theme = EMPTY_THEME;

  for (const module of modules) {
    const kind = pluginKind(module.manifest);
    if (kind === 'service') {
      const app = await activatePlugin(module, eagle, services);
      if (app.provides) services[module.manifest.id] = app.provides;
    } else if (kind === 'styling') {
      const app = await activatePlugin(module, eagle, services);
      if (app.widgets) widgets = { ...widgets, ...app.widgets };
      if (app.theme) theme = mergeThemes(theme, app.theme);
    }
  }

  return { services, widgets, theme };
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
