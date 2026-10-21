import { afterEach, describe, expect, it } from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { Text } from '../../sdui/authoring/foundation';
import { WorkspaceStore } from '../workspaces/store';
import { readFileSync } from 'node:fs';
import {
  AcquiredPackageRepository,
  PackageAcquisitionError,
  type PackageAcquisitionSource,
} from './package-repository';
import type { RetainedPackage, PackageRequest } from './saucepan-client';

const hostRequire = createRequire(import.meta.url);
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    const temporary = resolve(tmpdir());
    const target = resolve(root);
    const rel = relative(temporary, target);
    if (!rel.startsWith('power-eagle-acquired-') || rel.includes(sep))
      throw new Error('Unexpected cleanup directory');
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
    format: 'power-eagle/runtime',
    formatVersion: 1,
    start: 'home',
    state: {},
    components: {},
    actions: {},
    dependencies: [],
    screens: {
      home: {
        params: { type: 'object', properties: {}, required: [] },
        state: {},
        body: { type: 'Text', props: { text: 'Acquired' } },
      },
    },
  };
}

function packageFixture(
  id: string,
  kind: 'runtime' | 'provider' | 'mixed',
  options: { missingDependency?: boolean; target?: boolean } = {},
): string {
  const directory = root();
  const exports: unknown[] = [];
  const contributions: Record<string, string> = {};
  if (kind !== 'provider') {
    contributions.runtime = 'run.json';
    exports.push({ kind: 'runtime', id: 'main', screens: ['home'] });
    writeFileSync(
      join(directory, 'run.json'),
      JSON.stringify(runtimeDocument()),
    );
  }
  if (kind !== 'runtime') {
    contributions.widgets = 'types.cjs';
    exports.push({
      kind: 'widget',
      id: 'label',
      contract: {
        ...Text.contract,
        example: { type: `${id}/label`, props: { text: 'Label' } },
      },
    });
    writeFileSync(
      join(directory, 'types.cjs'),
      "require('fs').writeFileSync(require('path').join(__dirname, 'executed'), 'yes');",
    );
    const dependencies = options.missingDependency
      ? { absent: '^1.0.0' }
      : { privateDependency: '^1.0.0' };
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({
        name: id,
        private: true,
        version: '1.0.0',
        dependencies,
      }),
    );
    if (!options.missingDependency) {
      const dependency = join(directory, 'node_modules', 'privateDependency');
      mkdirSync(dependency, { recursive: true });
      writeFileSync(
        join(dependency, 'package.json'),
        JSON.stringify({
          name: 'privateDependency',
          version: '1.0.0',
          main: 'index.cjs',
        }),
      );
      writeFileSync(join(dependency, 'index.cjs'), 'module.exports = true;');
    }
  }
  writeFileSync(
    join(directory, 'manifest.json'),
    JSON.stringify({
      format: 'power-eagle/package',
      formatVersion: 1,
      id,
      name: id,
      version: '1.0.0',
      description: 'fixture',
      sdk: '^1.0.0',
      contributions,
      exports,
      dependencies: [],
      assets: [],
      ...(options.target
        ? {
            target: { platform: ['darwin'], arch: ['arm64'], node: '>=20.0.0' },
          }
        : {}),
    }),
  );
  return directory;
}

function legacyFixture(): string {
  const directory = root();
  writeFileSync(
    join(directory, 'manifest.json'),
    JSON.stringify({ name: 'legacy', main: 'main.cjs' }),
  );
  writeFileSync(join(directory, 'main.cjs'), 'module.exports = {};');
  return directory;
}

function acquired(
  directory: string,
  id: string,
  sourceId: string,
  folder: string | null = null,
): RetainedPackage {
  return {
    slot: sourceId + '/' + (folder ?? ''),
    sourceUuid: sourceId,
    outputUuid: id,
    groupUuid: 'group-' + id,
    pinUuid: 'pin-' + id,
    claimUuid: 'claim-' + id,
    scope: 'library',
    directory,
    relative: folder,
    source: { type: 'local', path: directory },
    revision: { commit: id },
    request: recipe(directory),
    persistence: 'persistent',
  };
}
class FakeAcquisitionSource implements PackageAcquisitionSource {
  persistentQueue: RetainedPackage[] = [];
  sessionQueue: RetainedPackage[] = [];
  entries: RetainedPackage[] = [];
  released: string[] = [];
  async acquirePersistent() {
    return this.persistentQueue.shift()!;
  }
  async acquireSession() {
    return { ...this.sessionQueue.shift()!, persistence: 'session' as const };
  }
  async retainedPackages() {
    return this.entries;
  }
  async publish(record: RetainedPackage) {
    if (record.persistence === 'persistent')
      this.entries = [
        ...this.entries.filter((x) => x.slot !== record.slot),
        record,
      ];
  }
  async forget(record: RetainedPackage) {
    this.entries = this.entries.filter((x) => x.pinUuid !== record.pinUuid);
  }
  async retainReader(record:RetainedPackage){return {directory:record.directory,close:async()=>{}};}
  async release(record: RetainedPackage) {
    this.released.push(record.pinUuid);
  }
}
const recipe = (path: string): PackageRequest => ({
  source: { type: 'local', path },
  selector: { type: 'local' },
});

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

    expect(
      repository.persistent().map((value) => value.discovered.manifest.id),
    ).toEqual(['example.mixed', 'example.provider', 'example.runtime']);
    expect(existsSync(join(provider, 'executed'))).toBe(false);
    expect(existsSync(join(mixed, 'executed'))).toBe(false);
  });

  it('rejects missing dependencies, legacy formats, and unsupported targets before publication', async () => {
    const missing = packageFixture('example.missing', 'provider', {
      missingDependency: true,
    });
    const legacy = legacyFixture();
    const incompatible = packageFixture('example.incompatible', 'runtime', {
      target: true,
    });
    const sourceClient = new FakeAcquisitionSource();
    sourceClient.sessionQueue.push(
      acquired(missing, 'missing', 'missing-source'),
      acquired(legacy, 'legacy', 'legacy-source'),
      acquired(incompatible, 'incompatible', 'incompatible-source'),
    );
    const repository = new AcquiredPackageRepository(
      sourceClient,
      hostRequire,
      {
        hostTarget: { platform: 'win32', arch: 'x64', node: '16.17.1' },
      },
    );

    for (const directory of [missing, legacy, incompatible]) {
      await expect(
        repository.acquireSession(recipe(directory)),
      ).rejects.toBeInstanceOf(PackageAcquisitionError);
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

    sourceClient.entries = [
      acquired(invalid, 'invalid', 'stable-source', 'package'),
    ];
    const refreshed = await repository.refreshPersistent();
    expect(refreshed.failures).toHaveLength(1);
    expect(refreshed.failures[0].retained).toBe(first);
    expect(refreshed.packages).toEqual([first]);
  });
  it('keeps the prior pin until replacement readers finish and explicit disposal completes', async () => {
    const directory = packageFixture('example.stable', 'runtime');
    const sourceClient = new FakeAcquisitionSource();
    sourceClient.persistentQueue.push(
      acquired(directory, 'a', 'source'),
      acquired(directory, 'b', 'source'),
    );
    const repository = new AcquiredPackageRepository(sourceClient, hostRequire);
    const first = await repository.acquirePersistent(recipe(directory));
    const reader = await repository.reader(first);
    const second = await repository.acquirePersistent(recipe(directory));
    expect(sourceClient.released).toEqual([]);
    await repository.dispose(first);
    expect(sourceClient.released).toEqual([]);
    expect(repository.persistent()).toEqual([second]);
    await reader.close();
    await reader.close();
    expect(sourceClient.released).toEqual(['pin-a']);
    await expect(repository.reader(first)).rejects.toThrow('closing');
  });
  it('does not publish a replacement whose activation fails', async () => {
    const directory = packageFixture('example.stable', 'runtime');
    const sourceClient = new FakeAcquisitionSource();
    sourceClient.persistentQueue.push(
      acquired(directory, 'a', 'source'),
      acquired(directory, 'b', 'source'),
    );
    const repository = new AcquiredPackageRepository(sourceClient, hostRequire);
    const first = await repository.acquirePersistent(recipe(directory));
    await expect(
      repository.acquirePersistent(recipe(directory), async () => {
        throw new Error('provider failed');
      }),
    ).rejects.toMatchObject({ retained: first });
    expect(repository.persistent()).toEqual([first]);
    expect(sourceClient.entries[0].pinUuid).toBe('pin-a');
    expect(sourceClient.released).toEqual([]);
  });
  it('holds a reader through workspace copying and leaves an independent editable result', async () => {
    const directory = packageFixture('example.copy', 'runtime');
    const state = root();
    writeFileSync(
      join(state, '.power-eagle-state.json'),
      JSON.stringify({ format: 'power-eagle/state', formatVersion: 1 }),
    );
    const store = new WorkspaceStore(state, hostRequire);
    const sourceClient = new FakeAcquisitionSource();
    sourceClient.sessionQueue.push(acquired(directory, 'copy', 'source'));
    const repository = new AcquiredPackageRepository(sourceClient, hostRequire);
    const record = await repository.acquireSession(recipe(directory));
    const register = store.register.bind(store);
    store.register = async (...args) => {
      await repository.dispose(record);
      expect(sourceClient.released).toEqual([]);
      return register(...args);
    };
    const instance = await repository.copyToWorkspace(record, store);
    expect(sourceClient.released).toEqual(['pin-copy']);
    const before = readFileSync(join(directory, 'run.json'), 'utf8');
    writeFileSync(join(store.artifact(instance), 'run.json'), 'edited');
    expect(readFileSync(join(directory, 'run.json'), 'utf8')).toBe(before);
  });
});
