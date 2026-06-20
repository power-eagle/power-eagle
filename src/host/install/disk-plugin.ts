/**
 * Load a saucepan-installed plugin from its on-disk directory into a live
 * plugin module. The app is already an ES module context, so a plugin ships a
 * pre-built ESM entry (declared as `main` in its manifest.json) whose default
 * export is a `definePlugin` module; this loader dynamic-imports that entry.
 *
 * The importer is injected: the real one (`import(fileUrl)`) only resolves at
 * runtime in the Eagle webview, so callers pass it in and tests fake it. This
 * file owns turning a directory into a module — resolving *which* directory is
 * saucepan's `installedPath`.
 */
import { joinPath, readTextFile } from './fs-bridge';
import type { AnyPluginModule } from '../../plugins/builtins';

/** Dynamic-imports a module from an absolute path (injected for testability). */
export type ModuleImporter = (path: string) => Promise<unknown>;

/**
 * The real importer: dynamic-import an absolute path as a file:// URL. Only
 * resolves at runtime in the Eagle webview (verified by a spike, not the node
 * suite), so callers inject a fake in tests. `@vite-ignore` keeps the bundler
 * from trying to resolve the runtime path at build time.
 */
export const nativeImport: ModuleImporter = (path) => {
  const url = `file://${path.startsWith('/') ? '' : '/'}${path.replace(/\\/gu, '/')}`;
  return import(/* @vite-ignore */ url);
};

/** A plugin's manifest.json: saucepan's sauce fields plus power-eagle's `main`. */
interface DiskManifest {
  main?: unknown;
}

/** Whether an imported default export is shaped like a plugin module. */
function isPluginModule(value: unknown): value is AnyPluginModule {
  const manifest = (value as { manifest?: { id?: unknown } } | null)?.manifest;
  return typeof manifest?.id === 'string';
}

/** Load the plugin installed at `installDir` by importing its manifest entry. */
export async function loadDiskPlugin(
  installDir: string,
  deps: { importModule: ModuleImporter },
): Promise<AnyPluginModule> {
  const manifest = JSON.parse(readTextFile(joinPath(installDir, 'manifest.json'))) as DiskManifest;
  if (typeof manifest.main !== 'string') {
    throw new Error(`plugin at ${installDir} has no "main" entry in manifest.json`);
  }

  const imported = await deps.importModule(joinPath(installDir, manifest.main));
  const exported = (imported as { default?: unknown }).default;
  if (!isPluginModule(exported)) {
    throw new Error(`plugin at ${installDir} did not default-export a valid plugin module`);
  }
  return exported;
}
