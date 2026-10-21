import { describe, expect, it } from 'vitest';
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import {
  AcquiredPackageRepository,
  type PackageAcquisitionSource,
} from './package-repository';
import type { RetainedPackage, PackageRequest } from './saucepan-client';
const hostRequire = createRequire(import.meta.url);
describe('documented Saucepan workflow', () => {
  it('uses current source/selector payloads and retains the returned directory', async () => {
    const request = JSON.parse(
      readFileSync('examples/saucepan-recipes/local-runtime.json', 'utf8'),
    ) as PackageRequest;
    const directory = realpathSync(
      resolve(request.source.type === 'local' ? request.source.path : ''),
    );
    const receipt: RetainedPackage = {
      slot: 'local',
      sourceUuid: 'source',
      outputUuid: 'output',
      groupUuid: 'group',
      pinUuid: 'pin',
      scope: 'library',
      directory,
      relative: null,
      source: request.source,
      revision: {},
      request,
      persistence: 'persistent',
    };
    const source: PackageAcquisitionSource = {
      acquirePersistent: async () => receipt,
      acquireSession: async () => receipt,
      retainedPackages: async () => [receipt],
      publish: async () => {},
      forget: async () => {},
      release: async () => {},
      retainReader:async()=>({directory,close:async()=>{}}),
    };
    const repository = new AcquiredPackageRepository(source, hostRequire);
    const installed = await repository.acquirePersistent(request);
    expect(installed.discovered.root).toBe(directory);
    expect(installed.discovered.manifest.id).toBe('example.notes');
  });
});
