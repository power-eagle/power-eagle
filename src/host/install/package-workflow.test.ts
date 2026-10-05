import { describe, expect, it } from 'vitest';
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { AcquiredPackageRepository, type PackageAcquisitionSource } from './package-repository';
import type { SaucepanAcquired, SaucepanAppView, SaucepanArtifact, SaucepanRecipe } from './saucepan-client';

const hostRequire = createRequire(import.meta.url);

describe('documented Saucepan workflow', () => {
  it('loads the local recipe package from Saucepan returned directory metadata', async () => {
    const recipe = JSON.parse(readFileSync('examples/saucepan-recipes/local-runtime.json', 'utf8')) as SaucepanRecipe;
    const directory = realpathSync(resolve(recipe.source.provider === 'local' ? recipe.source.path : ''));
    const artifact: SaucepanArtifact = {
      id: 'documented-local-runtime', source_id: 'canonical-local-source', source: recipe.source,
      snapshot_id: 'snapshot', revision: 'local', folder: null, content_id: 'content', files: {},
    };
    const acquired: SaucepanAcquired = {
      artifact, directory, fallback: false, update_checked: true, content_verified: true,
    };
    const source: PackageAcquisitionSource = {
      acquirePersistent: async () => acquired,
      acquireSession: async () => acquired,
      view: async (): Promise<SaucepanAppView> => ({
        version: 1, app: 'power-eagle',
        settings: { retain_snapshots: true, verify_content: false, allow_local_fallback: false },
        filters: { source_ids: [], providers: [] }, entries: { [artifact.id]: artifact },
      }),
      path: async () => directory,
    };
    const repository = new AcquiredPackageRepository(source, hostRequire);

    const installed = await repository.acquirePersistent(recipe);

    expect(installed.acquired.directory).toBe(directory);
    expect(installed.discovered.root).toBe(directory);
    expect(installed.discovered.manifest.id).toBe('example.notes');
  });
});
