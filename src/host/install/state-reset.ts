import { createHostFilesystem, type HostFilesystem } from './fs-bridge';

export const POWER_EAGLE_STATE_DIRECTORY = '.powereagle';
export const POWER_EAGLE_STATE_SENTINEL = '.power-eagle-state.json';
export const OBSOLETE_POWER_EAGLE_STORAGE_KEYS = [
  'peagle.disabled.v1',
  'power-eagle.enablement.v1',
] as const;

const sentinel = {
  format: 'power-eagle/state',
  formatVersion: 1,
} as const;

export interface BrowserStorageCleanup {
  removeItem(key: string): void;
}

export interface InitializePowerEagleStateOptions {
  filesystem?: HostFilesystem;
  hostRequire?: NodeRequire;
  homeDirectory?: string;
  legacyRoot?: string;
  browserStorage?: BrowserStorageCleanup;
  obsoleteStorageKeys?: readonly string[];
}

export type PowerEagleStateInitialization = {
  status: 'initialized' | 'reset' | 'retained';
  root: string;
  sentinelPath: string;
};

export class PowerEagleStateResetError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'PowerEagleStateResetError';
  }
}

function expectedRoot(filesystem: HostFilesystem, homeDirectory: string): string {
  return filesystem.resolve(homeDirectory, POWER_EAGLE_STATE_DIRECTORY);
}

function assertSafeRoot(filesystem: HostFilesystem, homeDirectory: string, candidate: string): void {
  const home = filesystem.resolve(homeDirectory);
  const expected = expectedRoot(filesystem, home);
  const resolved = filesystem.resolve(candidate);
  const isExactChild = filesystem.samePath(resolved, expected)
    && filesystem.samePath(filesystem.dirname(resolved), home)
    && filesystem.basename(resolved) === POWER_EAGLE_STATE_DIRECTORY;
  if (!isExactChild || filesystem.samePath(resolved, home)) {
    throw new PowerEagleStateResetError(`Refusing to reset unexpected Power Eagle state path: ${resolved}`);
  }
  if (filesystem.kind(resolved) === 'symbolic-link') {
    throw new PowerEagleStateResetError(`Refusing to reset symbolic Power Eagle state path: ${resolved}`);
  }
}

function hasValidSentinel(filesystem: HostFilesystem, sentinelPath: string): boolean {
  if (!filesystem.exists(sentinelPath)) return false;
  try {
    const parsed = JSON.parse(filesystem.readText(sentinelPath)) as Partial<typeof sentinel>;
    if (parsed.format === sentinel.format && parsed.formatVersion === sentinel.formatVersion) return true;
  } catch (error) {
    throw new PowerEagleStateResetError(`Power Eagle state sentinel is unreadable: ${sentinelPath}`, error);
  }
  throw new PowerEagleStateResetError(`Power Eagle state sentinel has an unsupported format: ${sentinelPath}`);
}

/** Clear the legacy owned root once, then establish the new versioned state boundary. */
export function initializePowerEagleState(
  options: InitializePowerEagleStateOptions = {},
): PowerEagleStateInitialization {
  const filesystem = options.filesystem ?? createHostFilesystem(options.hostRequire);
  const homeDirectory = filesystem.resolve(options.homeDirectory ?? filesystem.home());
  const root = filesystem.resolve(options.legacyRoot ?? expectedRoot(filesystem, homeDirectory));
  assertSafeRoot(filesystem, homeDirectory, root);
  const sentinelPath = filesystem.join(root, POWER_EAGLE_STATE_SENTINEL);
  if (hasValidSentinel(filesystem, sentinelPath)) return { status: 'retained', root, sentinelPath };

  const existed = filesystem.exists(root);
  try {
    if (existed) filesystem.removeTree(root);
    filesystem.ensureDirectory(root);
    const keys = options.obsoleteStorageKeys ?? OBSOLETE_POWER_EAGLE_STORAGE_KEYS;
    for (const key of keys) options.browserStorage?.removeItem(key);
    filesystem.writeText(sentinelPath, `${JSON.stringify(sentinel, null, 2)}\n`);
    return { status: existed ? 'reset' : 'initialized', root, sentinelPath };
  } catch (error) {
    throw new PowerEagleStateResetError(`Failed to initialize clean Power Eagle state at ${root}`, error);
  }
}
