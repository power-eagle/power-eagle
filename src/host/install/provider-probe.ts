/** Checkpoint-one experiment, not the production package loader. */
import type { ComponentType } from 'react';

export interface ProbeSdk {
  sharedModules: Record<string, unknown>;
  require: NodeRequire;
  assetUrl: (relative: string) => string;
  record: (event: string) => void;
}

export interface ProbeProvider {
  Widget: ComponentType;
  revision: string;
  dependencyVersion: string;
  dependencyPath: string;
  shared: { react: boolean; reactDom: boolean; jsx: boolean };
}

export function createProbeLoader(hostRequire: NodeRequire) {
  const fs = hostRequire('fs') as typeof import('node:fs');
  const path = hostRequire('path') as typeof import('node:path');
  const { pathToFileURL } = hostRequire('url') as typeof import('node:url');
  const { createRequire } = hostRequire('module') as typeof import('node:module');

  function inside(root: string, file: string): boolean {
    const relative = path.relative(root, file);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
  }

  function resolveFile(root: string, relative: string): string {
    const canonicalRoot = fs.realpathSync(root);
    const canonicalFile = fs.realpathSync(path.resolve(canonicalRoot, relative));
    if (!inside(canonicalRoot, canonicalFile)) throw new Error(`Entry escapes fixture package: ${relative}`);
    return canonicalFile;
  }

  function clear(root: string): void {
    const canonicalRoot = fs.realpathSync(root);
    const localRequire = createRequire(path.join(canonicalRoot, 'package.json'));
    for (const id of Object.keys(localRequire.cache)) {
      if (inside(canonicalRoot, id)) delete localRequire.cache[id];
    }
  }

  function load(root: string, sharedModules: Record<string, unknown>, record: ProbeSdk['record']): ProbeProvider {
    const canonicalRoot = fs.realpathSync(root);
    const manifest = JSON.parse(fs.readFileSync(resolveFile(canonicalRoot, 'manifest.json'), 'utf8')) as {
      format?: string; formatVersion?: number; contributions?: { widgets?: string };
    };
    if (manifest.format !== 'power-eagle/package' || manifest.formatVersion !== 1) {
      throw new Error('Unsupported fixture package format');
    }
    if (!manifest.contributions?.widgets) throw new Error('Fixture has no widget contribution');
    const entry = resolveFile(canonicalRoot, manifest.contributions.widgets);
    if (path.extname(entry) !== '.cjs') throw new Error('Fixture provider must be compiled CommonJS');
    const localRequire = createRequire(path.join(canonicalRoot, 'package.json'));
    const factory: unknown = localRequire(entry);
    if (typeof factory !== 'function') throw new Error('Fixture provider must export a factory');
    return factory({
      sharedModules,
      require: localRequire,
      assetUrl: (relative: string) => pathToFileURL(resolveFile(canonicalRoot, relative)).href,
      record,
    } satisfies ProbeSdk) as ProbeProvider;
  }

  return { load, clear, resolveFile };
}
