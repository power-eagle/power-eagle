import { resolveHostRequire } from './runtime-modules';
import { sharedSaucepanExecutablePath } from './saucepan-binary';

export interface SaucepanProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  code?: string;
  signal?: string | null;
  killed?: boolean;
}

export interface SaucepanExecutionOptions {
  timeoutMs: number;
  maxBuffer: number;
}

export type SaucepanRunner = (
  binaryPath: string,
  arguments_: readonly string[],
  options: SaucepanExecutionOptions,
) => Promise<SaucepanProcessResult>;

export type SaucepanFailureKind = 'launch' | 'process' | 'protocol' | 'temporary-file';

export class SaucepanCommandError extends Error {
  constructor(
    public readonly operation: string,
    public readonly kind: SaucepanFailureKind,
    public readonly exitCode: number | null,
    public readonly stdout: string,
    public readonly stderr: string,
    public readonly recovery: string,
    public readonly code?: string,
    public readonly signal: string | null = null,
    public readonly killed = false,
    public readonly originalCause?: unknown,
  ) {
    const detail = kind === 'process' && exitCode !== null
      ? `exited with code ${exitCode}${stderr.trim() ? `: ${stderr.trim()}` : ''}`
      : kind === 'launch'
        ? `could not start${code ? ` (${code})` : ''}`
        : kind === 'protocol'
          ? 'returned an invalid JSON response'
          : 'could not prepare or remove a temporary request file';
    super(`Saucepan ${operation} ${detail}. ${recovery}`);
    this.name = 'SaucepanCommandError';
  }
}

export interface SaucepanJsonArgument {
  readonly json: unknown;
}

export type SaucepanArgument = string | SaucepanJsonArgument;

export function saucepanJson(value: unknown): SaucepanJsonArgument {
  return { json: value };
}

export interface SaucepanCliOptions {
  binaryPath?: string;
  timeoutMs?: number;
  maxBuffer?: number;
  temporaryDirectory?: string;
  runner?: SaucepanRunner;
  hostRequire?: NodeRequire;
}

function validateOptions(options: SaucepanCliOptions): void {
  if (options.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 0)) {
    throw new TypeError('timeoutMs must be an integer >= 0');
  }
  if (options.maxBuffer !== undefined && (!Number.isSafeInteger(options.maxBuffer) || options.maxBuffer < 1)) {
    throw new TypeError('maxBuffer must be an integer >= 1');
  }
}

function defaultRunner(hostRequire?: NodeRequire): SaucepanRunner {
  const childProcess = resolveHostRequire(hostRequire)('child_process') as typeof import('node:child_process');
  return (binaryPath, arguments_, options) => new Promise(resolve => {
    childProcess.execFile(binaryPath, [...arguments_], {
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
      timeout: options.timeoutMs,
      maxBuffer: options.maxBuffer,
    }, (error, stdout, stderr) => {
      if (!error) {
        resolve({ exitCode: 0, stdout, stderr });
        return;
      }
      resolve({
        exitCode: typeof error.code === 'number' ? error.code : null,
        stdout,
        stderr,
        ...(typeof error.code === 'string' ? { code: error.code } : {}),
        signal: error.signal ?? null,
        killed: error.killed ?? false,
      });
    });
  });
}

function recoveryFor(result: SaucepanProcessResult): string {
  if (result.code === 'ENOENT') {
    return 'Install Saucepan 0.6 in the shared user-level location or configure an explicit executable path';
  }
  if (result.exitCode === null) return 'Check the executable path and host process permissions, then retry';
  return 'Review the Saucepan diagnostic and central-store state, then retry';
}

/** Node 16-compatible, asynchronous, shell-free transport for Saucepan JSON commands. */
export class SaucepanCli {
  readonly binaryPath: string;
  readonly timeoutMs: number;
  readonly maxBuffer: number;
  readonly temporaryDirectory: string;
  readonly #runner: SaucepanRunner;
  readonly #hostRequire: NodeRequire;

  constructor(options: SaucepanCliOptions = {}) {
    validateOptions(options);
    this.#hostRequire = resolveHostRequire(options.hostRequire);
    const os = this.#hostRequire('os') as typeof import('node:os');
    this.binaryPath = options.binaryPath ?? sharedSaucepanExecutablePath({ hostRequire: this.#hostRequire });
    this.timeoutMs = options.timeoutMs ?? 0;
    this.maxBuffer = options.maxBuffer ?? 16 * 1024 * 1024;
    this.temporaryDirectory = options.temporaryDirectory ?? os.tmpdir();
    this.#runner = options.runner ?? defaultRunner(this.#hostRequire);
  }

  async execute<T>(operation: string, arguments_: readonly SaucepanArgument[]): Promise<T> {
    const fs = this.#hostRequire('fs/promises') as typeof import('node:fs/promises');
    const path = this.#hostRequire('path') as typeof import('node:path');
    let requestDirectory: string | undefined;
    let requestIndex = 0;
    let value!: T;
    let failure: unknown;
    try {
      const serialized: string[] = [];
      for (const argument of arguments_) {
        if (typeof argument === 'string') {
          serialized.push(argument);
          continue;
        }
        requestDirectory ??= await fs.mkdtemp(path.join(this.temporaryDirectory, 'power-eagle-saucepan-'));
        const requestPath = path.join(requestDirectory, `${requestIndex++}.json`);
        await fs.writeFile(requestPath, JSON.stringify(argument.json), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        serialized.push(requestPath);
      }
      const result = await this.#runner(this.binaryPath, serialized, {
        timeoutMs: this.timeoutMs,
        maxBuffer: this.maxBuffer,
      });
      if (result.exitCode !== 0) {
        failure = new SaucepanCommandError(
          operation,
          result.exitCode === null ? 'launch' : 'process',
          result.exitCode,
          result.stdout,
          result.stderr,
          recoveryFor(result),
          result.code,
          result.signal ?? null,
          result.killed ?? false,
        );
      } else {
        try {
          value = JSON.parse(result.stdout) as T;
        } catch (error) {
          failure = new SaucepanCommandError(
            operation,
            'protocol',
            0,
            result.stdout,
            result.stderr,
            'Use a compatible Saucepan 0.6 executable and retry',
            'INVALID_JSON',
            null,
            false,
            error,
          );
        }
      }
    } catch (error) {
      failure = error instanceof SaucepanCommandError ? error : new SaucepanCommandError(
        operation, 'temporary-file', null, '', '',
        'Check access to the host temporary directory and retry',
        undefined, null, false, error,
      );
    }
    if (requestDirectory) {
      try {
        await fs.rm(requestDirectory, { recursive: true, force: true });
      } catch (error) {
        if (failure === undefined) {
          failure = new SaucepanCommandError(
            operation, 'temporary-file', null, '', '',
            'Remove the stale request directory, check temporary-directory permissions, and retry',
            undefined, null, false, error,
          );
        }
      }
    }
    if (failure !== undefined) throw failure;
    return value;
  }
}
