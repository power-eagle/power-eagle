import {
  ContributionPackageError,
  discoverContributionPackage,
  type DiscoveredPackage,
  type PackageDiscoveryOptions,
} from './contribution-package';
import {
  type SaucepanAcquired,
  type SaucepanArtifact,
  type SaucepanRecipe,
} from './saucepan-client';

export type PackagePersistence = 'persistent' | 'session';

export interface AcquiredContributionPackage {
  persistence: PackagePersistence;
  acquired: SaucepanAcquired;
  discovered: DiscoveredPackage;
}

export interface PersistentRefreshFailure {
  artifact: SaucepanArtifact;
  error: ContributionPackageError;
  retained?: AcquiredContributionPackage;
}

export interface PersistentRefreshResult {
  packages: AcquiredContributionPackage[];
  failures: PersistentRefreshFailure[];
}

export interface PackageAcquisitionSource {
  acquirePersistent(recipe: SaucepanRecipe): Promise<SaucepanAcquired>;
  acquireSession(recipe: SaucepanRecipe): Promise<SaucepanAcquired>;
  view(): Promise<import('./saucepan-client').SaucepanAppView>;
  path(artifactId: string): Promise<string | null>;
}

export class PackageAcquisitionError extends Error {
  constructor(
    public readonly persistence: PackagePersistence,
    public readonly acquired: SaucepanAcquired,
    public readonly validation: ContributionPackageError,
    public readonly retained?: AcquiredContributionPackage,
  ) {
    super(`Acquired ${persistence} package failed validation: ${validation.message}`);
    this.name = 'PackageAcquisitionError';
  }
}

function slot(artifact: SaucepanArtifact): string {
  return `${artifact.source_id}\u0000${artifact.folder ?? ''}`;
}

function acquiredFromArtifact(artifact: SaucepanArtifact, directory: string): SaucepanAcquired {
  return { artifact, directory, fallback: false, update_checked: false, content_verified: false };
}

/** Publish only statically validated packages; provider code remains inactive. */
export class AcquiredPackageRepository {
  readonly #persistent = new Map<string, AcquiredContributionPackage>();
  readonly #session = new Map<string, AcquiredContributionPackage>();

  constructor(
    private readonly saucepan: PackageAcquisitionSource,
    private readonly hostRequire: NodeRequire,
    private readonly discoveryOptions: PackageDiscoveryOptions = {},
  ) {}

  async acquirePersistent(recipe: SaucepanRecipe): Promise<AcquiredContributionPackage> {
    const acquired = await this.saucepan.acquirePersistent(recipe);
    const key = slot(acquired.artifact);
    try {
      const record = this.discover(acquired, 'persistent');
      this.#persistent.set(key, record);
      return record;
    } catch (error) {
      if (!(error instanceof ContributionPackageError)) throw error;
      throw new PackageAcquisitionError('persistent', acquired, error, this.#persistent.get(key));
    }
  }

  async acquireSession(recipe: SaucepanRecipe): Promise<AcquiredContributionPackage> {
    const acquired = await this.saucepan.acquireSession(recipe);
    try {
      const record = this.discover(acquired, 'session');
      this.#session.set(acquired.artifact.id, record);
      return record;
    } catch (error) {
      if (!(error instanceof ContributionPackageError)) throw error;
      throw new PackageAcquisitionError('session', acquired, error);
    }
  }

  async refreshPersistent(): Promise<PersistentRefreshResult> {
    const view = await this.saucepan.view();
    const next = new Map<string, AcquiredContributionPackage>();
    const failures: PersistentRefreshFailure[] = [];
    for (const artifact of Object.values(view.entries).sort((left, right) => left.id.localeCompare(right.id))) {
      const key = slot(artifact);
      const retained = this.#persistent.get(key);
      const directory = await this.saucepan.path(artifact.id);
      if (directory === null) {
        const error = new ContributionPackageError([{
          packageRoot: '<unresolved>', path: '', code: 'missing-path',
          message: `Saucepan did not resolve artifact ${artifact.id}`,
        }]);
        failures.push({ artifact, error, ...(retained ? { retained } : {}) });
        if (retained) next.set(key, retained);
        continue;
      }
      try {
        next.set(key, this.discover(acquiredFromArtifact(artifact, directory), 'persistent'));
      } catch (error) {
        if (!(error instanceof ContributionPackageError)) throw error;
        failures.push({ artifact, error, ...(retained ? { retained } : {}) });
        if (retained) next.set(key, retained);
      }
    }
    this.#persistent.clear();
    next.forEach((record, key) => this.#persistent.set(key, record));
    return { packages: this.persistent(), failures };
  }

  persistent(): AcquiredContributionPackage[] {
    return [...this.#persistent.values()].sort((left, right) => left.discovered.manifest.id.localeCompare(right.discovered.manifest.id));
  }

  session(): AcquiredContributionPackage[] {
    return [...this.#session.values()].sort((left, right) => left.discovered.manifest.id.localeCompare(right.discovered.manifest.id));
  }

  private discover(acquired: SaucepanAcquired, persistence: PackagePersistence): AcquiredContributionPackage {
    const discovered = discoverContributionPackage(acquired.directory, this.hostRequire, this.discoveryOptions);
    return { persistence, acquired, discovered };
  }
}
