import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { Text } from '../../sdui/authoring/foundation';
import {
  AcquiredPackageRepository,
  PackageAcquisitionError,
  type PackageAcquisitionSource,
} from './package-repository';
import type {
  SaucepanAcquired,
  SaucepanAppView,
  SaucepanArtifact,
  SaucepanRecipe,
  SaucepanSource,
} from './saucepan-client';

const hostRequire = createRequire(import.meta.url);
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    const temporary = resolve(tmpdir());
    const target = resolve(root);
    const rel = relative(temporary, target);
    if (!rel.startsWith('power-eagle-acquired-') || rel.includes(sep)) throw new Error('Unexpected cleanup directory');
    rmSync(target, { recursive: true, force: true });
  }
});

function root(): string {
  const value = mkdtempSync(join(tmpdir(), 'power-eagle-acquired-'));
  roots.push(value);
  return value;
}

function runtimeDocument() {
  return {
    format: 'power-eagle/runtime', formatVersion: 1, start: 'home', state: {}, components: {}, actions: {}, dependencies: [],
    screens: { home: { params: { type: 'object', properties: {}, required: [] }, state: {}, body: { type: 'Text', props: { text: 'Acquired' } } } },
  };
}

function packageFixture(id: string, kind: 'runtime' | 'provider' | 'mixed', options: { missingDependency?: boolean; target?: boolean } = {}): string {
  const directory = root();
  const exports: unknown[] = [];
  const contributions: Record<string, string> = {};
  if (kind !== 'provider') {
    contributions.runtime = 'run.json';
    exports.push({ kind: 'runtime', id: 'main', screens: ['home'] });
    writeFileSync(join(directory, 'run.json'), JSON.stringify(runtimeDocument()));
  }
  if (kind !== 'runtime') {
    contributions.widgets = 'types.cjs';
    exports.push({ kind: 'widget', id: 'label', contract: { ...Text.contract, example: { type: `${id}/label`, props: { text: 'Label' } } } });
    writeFileSync(join(directory, 'types.cjs'), "require('fs').writeFileSync(require('path').join(__dirname, 'executed'), 'yes');");
    const dependencies = options.missingDependency ? { absent: '^1.0.0' } : { privateDependency: '^1.0.0' };
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: id, private: true, version: '1.0.0', dependencies }));
    if (!options.missingDependency) {
      const dependency = join(directory, 'node_modules', 'privateDependency');
      mkdirSync(dependency, { recursive: true });
      writeFileSync(join(dependency, 'package.json'), JSON.stringify({ name: 'privateDependency', version: '1.0.0', main: 'index.cjs' }));
      writeFileSync(join(dependency, 'index.cjs'), 'module.exports = true;');
    }
  }
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify({
    format: 'power-eagle/package', formatVersion: 1, id, name: id, version: '1.0.0', description: 'fixture', sdk: '^1.0.0',
    contributions, exports, dependencies: [], assets: [],
    ...(options.target ? { target: { platform: ['darwin'], arch: ['arm64'], node: '>=20.0.0' } } : {}),
  }));
  return directory;
}

function legacyFixture(): string {
  const directory = root();
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ name: 'legacy', main: 'main.cjs' }));
  writeFileSync(join(directory, 'main.cjs'), 'module.exports = {};');
  return directory;
}

function source(path: string): SaucepanSource { return { provider: 'local', path }; }

function acquired(directory: string, id: string, sourceId: string, folder: string | null = null): SaucepanAcquired {
  const artifact: SaucepanArtifact = {
    id, source_id: sourceId, source: source(directory), snapshot_id: `snapshot-${id}`, revision: `revision-${id}`,
    folder, content_id: `content-${id}`, files: {},
  };
  return { artifact, directory, fallback: false, update_checked: true, content_verified: true };
}

class FakeAcquisitionSource implements PackageAcquisitionSource {
  persistentQueue: SaucepanAcquired[] = [];
  sessionQueue: SaucepanAcquired[] = [];
  entries: Record<string, SaucepanArtifact> = {};
  paths = new Map<string, string>();

  async acquirePersistent(): Promise<SaucepanAcquired> {
    const value = this.persistentQueue.shift()!;
    this.entries[value.artifact.id] = value.artifact;
    this.paths.set(value.artifact.id, value.directory);
    return value;
  }
  async acquireSession(): Promise<SaucepanAcquired> { return this.sessionQueue.shift()!; }
  async view(): Promise<SaucepanAppView> {
    return {
      version: 1, app: 'power-eagle',
      settings: { retain_snapshots: true, verify_content: false, allow_local_fallback: false },
      filters: { source_ids: [], providers: [] }, entries: this.entries,
    };
  }
  async path(artifactId: string): Promise<string | null> { return this.paths.get(artifactId) ?? null; }
}

const recipe = (path: string): SaucepanRecipe => ({ source: { provider: 'local', path } });

describe('acquired contribution package repository', () => {
  it('publishes runtime-only, provider-only, and mixed artifacts without executing providers', async () => {
    const runtime = packageFixture('example.runtime', 'runtime');
    const provider = packageFixture('example.provider', 'provider');
    const mixed = packageFixture('example.mixed', 'mixed');
    const sourceClient = new FakeAcquisitionSource();
    sourceClient.persistentQueue.push(
      acquired(runtime, 'runtime-artifact', 'runtime-source'),
      acquired(provider, 'provider-artifact', 'provider-source'),
      acquired(mixed, 'mixed-artifact', 'mixed-source'),
    );
    const repository = new AcquiredPackageRepository(sourceClient, hostRequire);

    await repository.acquirePersistent(recipe(runtime));
    await repository.acquirePersistent(recipe(provider));
    await repository.acquirePersistent(recipe(mixed));

    expect(repository.persistent().map(value => value.discovered.manifest.id)).toEqual([
      'example.mixed', 'example.provider', 'example.runtime',
    ]);
    expect(existsSync(join(provider, 'executed'))).toBe(false);
    expect(existsSync(join(mixed, 'executed'))).toBe(false);
  });

  it('rejects missing dependencies, legacy formats, and unsupported targets before publication', async () => {
    const missing = packageFixture('example.missing', 'provider', { missingDependency: true });
    const legacy = legacyFixture();
    const incompatible = packageFixture('example.incompatible', 'runtime', { target: true });
    const sourceClient = new FakeAcquisitionSource();
    sourceClient.sessionQueue.push(
      acquired(missing, 'missing', 'missing-source'),
      acquired(legacy, 'legacy', 'legacy-source'),
      acquired(incompatible, 'incompatible', 'incompatible-source'),
    );
    const repository = new AcquiredPackageRepository(sourceClient, hostRequire, {
      hostTarget: { platform: 'win32', arch: 'x64', node: '16.17.1' },
    });

    for (const directory of [missing, legacy, incompatible]) {
      await expect(repository.acquireSession(recipe(directory))).rejects.toBeInstanceOf(PackageAcquisitionError);
    }
    expect(repository.session()).toEqual([]);
    expect(existsSync(join(missing, 'executed'))).toBe(false);
  });

  it('retains the previous valid package when acquisition or refresh validation fails', async () => {
    const valid = packageFixture('example.stable', 'runtime');
    const invalid = legacyFixture();
    const sourceClient = new FakeAcquisitionSource();
    sourceClient.persistentQueue.push(
      acquired(valid, 'valid', 'stable-source', 'package'),
      acquired(invalid, 'invalid', 'stable-source', 'package'),
    );
    const repository = new AcquiredPackageRepository(sourceClient, hostRequire);
    const first = await repository.acquirePersistent(recipe(valid));

    try {
      await repository.acquirePersistent(recipe(invalid));
      throw new Error('Expected invalid refresh to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(PackageAcquisitionError);
      expect((error as PackageAcquisitionError).retained).toBe(first);
    }
    expect(repository.persistent()).toEqual([first]);

    sourceClient.entries = { invalid: acquired(invalid, 'invalid', 'stable-source', 'package').artifact };
    sourceClient.paths.set('invalid', invalid);
    const refreshed = await repository.refreshPersistent();
    expect(refreshed.failures).toHaveLength(1);
    expect(refreshed.failures[0].retained).toBe(first);
    expect(refreshed.packages).toEqual([first]);
  });
});
