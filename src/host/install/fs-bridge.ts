/**
 * Filesystem access for the install layer, resolved through the same runtime
 * CommonJS bridge as `src/app/utils/git.ts`. This works both in the Electron
 * renderer (where `window.require` is exposed) and under the Node test runner,
 * without a static `node:fs` import that would fail to bundle for the browser.
 */

interface RuntimeRequireWindow {
  require?: (moduleName: string) => unknown;
}

/** Resolve runtime require when the host exposes CommonJS access. */
function getRuntimeRequire(): ((moduleName: string) => unknown) | null {
  const globalWindow =
    typeof window !== 'undefined' ? (window as unknown as RuntimeRequireWindow) : null;
  if (globalWindow?.require) {
    return globalWindow.require;
  }

  try {
    return Function('return typeof require !== "undefined" ? require : null')() as (
      moduleName: string,
    ) => unknown;
  } catch {
    return null;
  }
}

/** Require one runtime module through the bridge, or throw if unavailable. */
function requireModule<T>(moduleName: string): T {
  const runtimeRequire = getRuntimeRequire();
  if (!runtimeRequire) {
    throw new Error(`module '${moduleName}' is not available in the current runtime`);
  }
  return runtimeRequire(moduleName) as T;
}

let fsModule: typeof import('node:fs') | null = null;
let pathModule: typeof import('node:path') | null = null;
let osModule: typeof import('node:os') | null = null;

function fs(): typeof import('node:fs') {
  return (fsModule ??= requireModule<typeof import('node:fs')>('fs'));
}
function pathLib(): typeof import('node:path') {
  return (pathModule ??= requireModule<typeof import('node:path')>('path'));
}
function osLib(): typeof import('node:os') {
  return (osModule ??= requireModule<typeof import('node:os')>('os'));
}

export function joinPath(...parts: string[]): string {
  return pathLib().join(...parts);
}

export function homeDir(): string {
  return osLib().homedir();
}

export function pathExists(target: string): boolean {
  return fs().existsSync(target);
}

export function ensureDir(target: string): void {
  fs().mkdirSync(target, { recursive: true });
}

export function listDir(target: string): string[] {
  return fs().readdirSync(target);
}

export function readTextFile(target: string): string {
  return fs().readFileSync(target, 'utf8');
}

export function writeTextFile(target: string, content: string): void {
  fs().writeFileSync(target, content);
}

export function writeBytes(target: string, bytes: Uint8Array): void {
  fs().writeFileSync(target, bytes);
}

/** Mark a file executable (no-op effect on Windows; guarded for safety). */
export function makeExecutable(target: string): void {
  try {
    fs().chmodSync(target, 0o755);
  } catch {
    // chmod is unsupported / unnecessary on some platforms (e.g. Windows)
  }
}

export function removeDir(target: string): void {
  fs().rmSync(target, { recursive: true, force: true });
}

/** Copy a directory tree, excluding .git VCS metadata (read-only, not runnable). */
export function copyDir(source: string, destination: string): void {
  fs().cpSync(source, destination, {
    recursive: true,
    filter: (src) => !/(?:^|[\\/])\.git(?:[\\/]|$)/u.test(src),
  });
}
