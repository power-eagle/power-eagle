/**
 * Adapter over the bundled `saucepan` binary — power-eagle's install/distribution
 * backend. saucepan manages a `.saucepan/` index + clones under a root directory
 * (resolved under the user's home); this adapter shells to it through the same
 * runtime-require bridge as git.ts, points it at that root, and parses its
 * `--json` / `cat` output. saucepan's exit codes are mapped to typed errors.
 */
import { joinPath, homeDir, pathExists, ensureDir, writeTextFile } from './fs-bridge';
import { resolveSaucepanBinary } from './saucepan-binary';

/** One spawn result from the saucepan binary. */
export interface SaucepanResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

/** Runs the saucepan binary with the given argv (used to inject in tests). */
export type SaucepanRunner = (binaryPath: string, args: string[]) => SaucepanResult;

/** How to reach saucepan: a root dir (default ~/.powereagle) and the binary. */
export interface SaucepanOptions {
  root?: string;
  binaryPath?: string;
  binDir?: string;
  runner?: SaucepanRunner;
}

/** Choose the binary to invoke: explicit path, else resolved-by-platform, else PATH. */
function binaryFor(options: SaucepanOptions): string {
  if (options.binaryPath) return options.binaryPath;
  if (options.binDir) return resolveSaucepanBinary(options.binDir);
  return 'saucepan';
}

/** One installed plugin record as saucepan reports it (`index.json` entry). */
export interface SaucepanEntry {
  source_type: 'local' | 'github' | 'customgit';
  sauce: { name: string; version: string; description: string; [key: string]: unknown };
  [key: string]: unknown;
}

/** saucepan's stable exit codes (see its README). */
const EXIT = { NOT_FOUND: 1, SOURCE: 2, CONFIG: 3, CONFLICT: 4 } as const;

const DEFAULT_TOML = '[local]\n\n[github]\nmanifest = "manifest.json"\n';

/** Resolve the saucepan root, defaulting to the user's ~/.powereagle. */
export function resolveSaucepanRoot(root?: string): string {
  return root ?? joinPath(homeDir(), '.powereagle');
}

/** Spawn the saucepan binary via the runtime child_process bridge. */
function defaultRunner(binaryPath: string, args: string[]): SaucepanResult {
  const childProcess = requireChildProcess();
  if (!childProcess) {
    return { ok: false, exitCode: null, stdout: '', stderr: 'child_process unavailable' };
  }
  const result = childProcess.spawnSync(binaryPath, args, { encoding: 'utf8' });
  return {
    ok: result.status === 0 && !result.error,
    exitCode: result.status,
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: result.error ? result.error.message : typeof result.stderr === 'string' ? result.stderr : '',
  };
}

/** Run one saucepan subcommand against the resolved root. */
function run(options: SaucepanOptions, subcommand: string[]): SaucepanResult {
  const runner = options.runner ?? defaultRunner;
  return runner(binaryFor(options), [resolveSaucepanRoot(options.root), ...subcommand]);
}

/** Whether the saucepan binary can be spawned at all. */
export function isSaucepanAvailable(options: SaucepanOptions = {}): boolean {
  const runner = options.runner ?? defaultRunner;
  return runner(binaryFor(options), ['--help']).exitCode === 0;
}

/** Ensure the root exists and carries a saucepan.toml (config error otherwise). */
export function ensureRoot(options: SaucepanOptions = {}): string {
  const root = resolveSaucepanRoot(options.root);
  ensureDir(root);
  const config = joinPath(root, 'saucepan.toml');
  if (!pathExists(config)) {
    writeTextFile(config, DEFAULT_TOML);
  }
  return root;
}

/** Map a non-zero saucepan result to a thrown Error tagged with its meaning. */
function fail(action: string, result: SaucepanResult): never {
  const reason =
    result.exitCode === EXIT.NOT_FOUND ? 'not found'
      : result.exitCode === EXIT.SOURCE ? 'source error'
        : result.exitCode === EXIT.CONFIG ? 'config error'
          : result.exitCode === EXIT.CONFLICT ? 'conflict'
            : 'saucepan error';
  throw new Error(`saucepan ${action} failed (${reason}): ${result.stderr.trim()}`);
}

/** Parse newline-delimited JSON (saucepan's --json output) into objects. */
function parseNdjson<T>(stdout: string): T[] {
  return stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T);
}

/** List installed plugins from saucepan's index. */
export function listInstalled(options: SaucepanOptions = {}): SaucepanEntry[] {
  ensureRoot(options);
  const result = run(options, ['list', '--json']);
  if (!result.ok) fail('list', result);
  return parseNdjson<SaucepanEntry>(result.stdout);
}

/** Install a sauce by name (`owner/repo` for github sources). */
export function install(options: SaucepanOptions, name: string): void {
  ensureRoot(options);
  const result = run(options, ['install', name]);
  if (!result.ok) fail('install', result);
}

/** Register a bucket source by path or file:// url. */
export function addBucket(options: SaucepanOptions, url: string): void {
  ensureRoot(options);
  const result = run(options, ['bucket', 'add', url]);
  if (!result.ok) fail('bucket add', result);
}

/**
 * Resolve the on-disk artifact path of an installed sauce, or undefined if it
 * is not installed. Delegates to saucepan's own `path` command so the path
 * formula stays the binary's single source of truth (no TS reconstruction).
 */
export function installedPath(options: SaucepanOptions, name: string): string | undefined {
  ensureRoot(options);
  const result = run(options, ['path', name]);
  if (result.exitCode === EXIT.NOT_FOUND) return undefined;
  if (!result.ok) fail('path', result);
  return result.stdout.trim();
}

/** List registered bucket source urls. */
export function listBuckets(options: SaucepanOptions = {}): string[] {
  ensureRoot(options);
  const result = run(options, ['bucket', 'list', '--json']);
  if (!result.ok) fail('bucket list', result);
  return parseNdjson<{ url: string }>(result.stdout).map((entry) => entry.url);
}

interface RuntimeChildProcess {
  spawnSync(
    command: string,
    args: string[],
    options?: { encoding?: 'utf8' },
  ): { status: number | null; stdout?: string; stderr?: string; error?: Error };
}

interface RuntimeRequireWindow {
  require?: (moduleName: string) => unknown;
}

/** Resolve child_process through the runtime CommonJS bridge. */
function requireChildProcess(): RuntimeChildProcess | null {
  const globalWindow =
    typeof window !== 'undefined' ? (window as unknown as RuntimeRequireWindow) : null;
  const runtimeRequire =
    globalWindow?.require ??
    (() => {
      try {
        return Function('return typeof require !== "undefined" ? require : null')() as
          | ((moduleName: string) => unknown)
          | null;
      } catch {
        return null;
      }
    })();
  if (!runtimeRequire) return null;
  try {
    return runtimeRequire('child_process') as RuntimeChildProcess;
  } catch {
    return null;
  }
}
