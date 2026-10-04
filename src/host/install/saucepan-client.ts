import { createHostFilesystem } from './fs-bridge';
import { resolveHostRequire } from './runtime-modules';
import { SaucepanCli, saucepanJson } from './saucepan';

export const POWER_EAGLE_SAUCEPAN_APP = 'power-eagle';
export const POWER_EAGLE_SAUCEPAN_MARKER = '.saucepanhash';

export interface AppSettings {
  retain_snapshots: boolean;
  verify_content: boolean;
  allow_local_fallback: boolean;
}

export type SourceProvider = 'git' | 'url' | 'local';
export interface Filters { source_ids: string[]; providers: SourceProvider[] }
export interface SaucepanConfiguration { settings?: AppSettings; filters?: Filters }
export interface AppToken { version: 1; app: string; token: number[] }
export type SaucepanSource =
  | { provider: 'git'; origin: string; reference: string }
  | { provider: 'url'; url: string; download: { format: 'file'; name: string } | { format: 'zip' } }
  | { provider: 'local'; path: string };
export interface SaucepanRecipe { source: SaucepanSource; folder?: string | null; commit?: string | null }
export interface SaucepanFileRecord { digest: string | null; executable: boolean }
export interface SaucepanArtifact {
  id: string;
  source_id: string;
  source: SaucepanSource;
  snapshot_id: string;
  revision: string;
  folder: string | null;
  content_id: string;
  files: Record<string, SaucepanFileRecord>;
}
export interface SaucepanAcquired {
  artifact: SaucepanArtifact;
  directory: string;
  fallback: boolean;
  update_checked: boolean;
  content_verified: boolean;
}
export interface SaucepanAppView {
  version: 1;
  app: string;
  settings: AppSettings;
  filters: Filters;
  entries: Record<string, SaucepanArtifact>;
}
export interface SaucepanSnapshot {
  id: string;
  revision: string;
  content_id: string;
  files: Record<string, SaucepanFileRecord>;
  dependencies: Record<string, string>;
  zip_digest: string | null;
  last_used: number;
  created: number;
}
export interface SaucepanSourceState {
  source: SaucepanSource;
  current: SaucepanSnapshot | null;
  history: SaucepanSnapshot[];
  sequence: number;
}

export interface SaucepanSourceGroup {
  sourceId: string;
  source: SaucepanSource;
  artifacts: SaucepanArtifact[];
}

export interface PowerEagleSaucepanOptions {
  cli: SaucepanCli;
  stateRoot: string;
  hostRequire?: NodeRequire;
  appId?: string;
}

function requireVersionOne<T extends { version: number }>(value: T, operation: string): T {
  if (value?.version !== 1) throw new Error(`Saucepan ${operation} returned unsupported format version ${String(value?.version)}`);
  return value;
}

function validateToken(value: AppToken, appId: string): AppToken {
  requireVersionOne(value, 'register');
  const bytes = value?.token;
  if (value.app !== appId || !Array.isArray(bytes) || bytes.length !== 32
    || bytes.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
    throw new Error('Saucepan register returned an invalid app token');
  }
  return value;
}

export function groupSaucepanArtifacts(artifacts: Iterable<SaucepanArtifact>): SaucepanSourceGroup[] {
  const groups = new Map<string, SaucepanSourceGroup>();
  for (const artifact of artifacts) {
    const group = groups.get(artifact.source_id) ?? {
      sourceId: artifact.source_id,
      source: artifact.source,
      artifacts: [],
    };
    group.artifacts.push(artifact);
    groups.set(group.sourceId, group);
  }
  return [...groups.values()]
    .map(group => ({ ...group, artifacts: group.artifacts.sort((left, right) => left.id.localeCompare(right.id)) }))
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId));
}

/** Current Saucepan application client with explicit persistent and session-only acquisition. */
export class PowerEagleSaucepan {
  readonly markerPath: string;
  readonly appId: string;
  readonly #cli: SaucepanCli;
  readonly #hostRequire: NodeRequire;
  readonly #sessionArtifacts = new Map<string, SaucepanArtifact>();

  constructor(options: PowerEagleSaucepanOptions) {
    this.#cli = options.cli;
    this.#hostRequire = resolveHostRequire(options.hostRequire);
    this.appId = options.appId ?? POWER_EAGLE_SAUCEPAN_APP;
    const filesystem = createHostFilesystem(this.#hostRequire);
    this.markerPath = filesystem.join(options.stateRoot, POWER_EAGLE_SAUCEPAN_MARKER);
  }

  async initializeStore(): Promise<{ created: true }> {
    return this.#cli.execute('initialize store', ['init']);
  }

  async ensureRegistration(configuration: SaucepanConfiguration = {}): Promise<'existing' | 'registered'> {
    const fs = this.#hostRequire('fs/promises') as typeof import('node:fs/promises');
    const path = this.#hostRequire('path') as typeof import('node:path');
    try {
      const existing = JSON.parse(await fs.readFile(this.markerPath, 'utf8')) as AppToken;
      validateToken(existing, this.appId);
      return 'existing';
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw error;
    }

    await fs.mkdir(path.dirname(this.markerPath), { recursive: true });
    const probe = `${this.markerPath}.write-probe`;
    await fs.writeFile(probe, '', { flag: 'wx', mode: 0o600 });
    await fs.rm(probe, { force: true });
    const arguments_: Array<string | ReturnType<typeof saucepanJson>> = ['register', this.appId];
    if (configuration.settings !== undefined) arguments_.push('--settings', saucepanJson(configuration.settings));
    if (configuration.filters !== undefined) arguments_.push('--filters', saucepanJson(configuration.filters));
    const token = validateToken(await this.#cli.execute<AppToken>('register', arguments_), this.appId);
    const temporary = `${this.markerPath}.new`;
    try {
      await fs.writeFile(temporary, `${JSON.stringify(token)}\n`, { flag: 'wx', mode: 0o600 });
      await fs.rename(temporary, this.markerPath);
    } finally {
      await fs.rm(temporary, { force: true });
    }
    return 'registered';
  }

  async configure(configuration: SaucepanConfiguration): Promise<{ configured: true }> {
    const arguments_: Array<string | ReturnType<typeof saucepanJson>> = [this.markerArgument(), 'configure'];
    if (configuration.settings !== undefined) arguments_.push('--settings', saucepanJson(configuration.settings));
    if (configuration.filters !== undefined) arguments_.push('--filters', saucepanJson(configuration.filters));
    return this.#cli.execute('configure', arguments_);
  }

  async acquirePersistent(recipe: SaucepanRecipe): Promise<SaucepanAcquired> {
    return this.#cli.execute('persistent acquire', [this.markerArgument(), 'acquire', saucepanJson(recipe)]);
  }

  async acquireSession(recipe: SaucepanRecipe): Promise<SaucepanAcquired> {
    const acquired = await this.#cli.execute<SaucepanAcquired>('session acquire', ['acquire', saucepanJson(recipe)]);
    this.#sessionArtifacts.set(acquired.artifact.id, acquired.artifact);
    return acquired;
  }

  async view(): Promise<SaucepanAppView> {
    return requireVersionOne(await this.#cli.execute<SaucepanAppView>('view', [this.markerArgument(), 'view']), 'view');
  }

  async path(artifactId: string): Promise<string | null> {
    return this.#cli.execute('path', [this.markerArgument(), 'path', artifactId]);
  }

  async history(sourceId: string): Promise<SaucepanSourceState | null> {
    return this.#cli.execute('history', [this.markerArgument(), 'history', sourceId]);
  }

  async verify(view: SaucepanAppView): Promise<{ verified: true }> {
    return this.#cli.execute('verify', [this.markerArgument(), 'verify', saucepanJson(view)]);
  }

  async snapshot(sourceId: string, snapshotId: string, folder?: string): Promise<SaucepanAcquired> {
    return this.#cli.execute('snapshot', [
      this.markerArgument(), 'snapshot', sourceId, snapshotId,
      ...(folder === undefined ? [] : [`--folder=${folder}`]),
    ]);
  }

  async mirror(artifactId: string, destination: string): Promise<{ directory: string }> {
    return this.#cli.execute('mirror', [this.markerArgument(), 'mirror', artifactId, destination]);
  }

  sessionArtifacts(): SaucepanArtifact[] {
    return [...this.#sessionArtifacts.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  async persistentSources(): Promise<SaucepanSourceGroup[]> {
    const view = await this.view();
    return groupSaucepanArtifacts(Object.values(view.entries));
  }

  sessionSources(): SaucepanSourceGroup[] {
    return groupSaucepanArtifacts(this.#sessionArtifacts.values());
  }

  private markerArgument(): string {
    return `--marker=${this.markerPath}`;
  }
}
