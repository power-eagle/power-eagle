import {
  Payload,
  SaucepanError,
  TransportError,
  type Call,
  type Config,
  type RunOptions,
  type RunResult,
  type Transport,
} from 'saucepan-sdk';
import { resolveHostRequire } from './runtime-modules';

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function portable(value: unknown, seen = new Set<unknown>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return;
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= Number.MAX_SAFE_INTEGER
  )
    return;
  if (!record(value) && !Array.isArray(value))
    throw new TransportError('invalid_input');
  if (
    seen.has(value) ||
    (!Array.isArray(value) &&
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
  )
    throw new TransportError('invalid_input');
  seen.add(value);
  Object.values(value).forEach((item) => portable(item, seen));
  seen.delete(value);
}

/** Host I/O only: policy evaluation and command construction belong to Saucepan. */
export class EagleTransport implements Transport {
  constructor(private readonly injected?: NodeRequire) {}

  async run(
    config: Config,
    call: Call,
    options: RunOptions = {},
  ): Promise<RunResult> {
    const require = resolveHostRequire(this.injected);
    const fs = require('fs/promises') as typeof import('node:fs/promises');
    const path = require('path') as typeof import('node:path');
    const os = require('os') as typeof import('node:os');
    const process = require('process') as typeof import('node:process');
    const { Buffer } = require('buffer') as typeof import('node:buffer');
    const { spawn } =
      require('child_process') as typeof import('node:child_process');
    let directory: string | undefined;
    let started = false;
    let failure: unknown;
    let result: RunResult | undefined;
    try {
      const limit = Math.min(
        config.inputLimit,
        call.payloadLimit ?? config.inputLimit,
      );
      if (
        !Number.isSafeInteger(limit) ||
        limit <= 0 ||
        !Number.isSafeInteger(config.captureLimit) ||
        config.captureLimit <= 0
      )
        throw new TransportError('invalid_input');
      const timeout = options.timeout;
      if (
        timeout !== undefined &&
        timeout !== null &&
        (!Number.isSafeInteger(timeout) || timeout <= 0)
      )
        throw new TransportError('invalid_input');
      if (options.signal?.aborted) throw new TransportError('cancelled');
      if (
        process.platform === 'win32' &&
        /\.(cmd|bat)$/i.test(config.executable)
      )
        throw new TransportError('invalid_executable');
      const argv = ['--error-format', 'json'];
      for (const [flag, value] of [
        ['--root', config.root],
        ['--as-app', config.app],
        ['--credential-file', config.credentialFile],
      ])
        if (value !== undefined) argv.push(flag!, value);
      let index = 0;
      const payload = async (value: unknown): Promise<string> => {
        let bytes: Buffer;
        try {
          portable(value);
          bytes = Buffer.from(JSON.stringify(value), 'utf8');
        } catch {
          throw new TransportError('invalid_input');
        }
        if (bytes.byteLength > limit) throw new TransportError('input_limit');
        directory ??= await fs.mkdtemp(
          path.join(os.tmpdir(), 'power-eagle-sdk-'),
        );
        const file = path.join(directory, `${index++}.json`);
        await fs.writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
        return file;
      };
      if (call.policies !== undefined)
        argv.push('--policies', await payload(call.policies));
      for (const argument of call.argv)
        argv.push(
          argument instanceof Payload
            ? await payload(argument.value)
            : argument,
        );
      result = await new Promise<RunResult>((resolve, reject) => {
        const child = spawn(config.executable, argv, {
          shell: false,
          windowsHide: true,
          stdio: options.capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
        });
        let timer: ReturnType<typeof setTimeout> | undefined;
        let terminal: TransportError | undefined;
        let settled = false;
        const stdout: Buffer[] = [],
          stderr: Buffer[] = [];
        const finish = (exitCode: number | null, signal: string | null) => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          options.signal?.removeEventListener('abort', abort);
          if (terminal) {
            child.stdout?.destroy();
            child.stderr?.destroy();
            reject(terminal);
          } else
            resolve({
              exitCode,
              signal,
              stdout: options.capture ? Buffer.concat(stdout) : null,
              stderr: options.capture ? Buffer.concat(stderr) : null,
            });
        };
        const stop = (kind: string) => {
          terminal ??= new TransportError(kind, started);
          if (child.exitCode !== null || child.signalCode !== null)
            finish(child.exitCode, child.signalCode);
          else child.kill('SIGKILL');
        };
        const abort = () => stop('cancelled');
        child.once('spawn', () => {
          started = true;
        });
        child.once('error', () => {
          terminal ??= new TransportError('launch', started);
          finish(null, null);
        });
        for (const [stream, chunks] of [
          [child.stdout, stdout],
          [child.stderr, stderr],
        ] as const) {
          let count = 0;
          stream?.on('data', (chunk: Buffer) => {
            count += chunk.byteLength;
            if (count > config.captureLimit) stop('output_limit');
            else chunks.push(chunk);
          });
        }
        options.signal?.addEventListener('abort', abort, { once: true });
        if (options.signal?.aborted) abort();
        if (timeout !== undefined && timeout !== null)
          timer = setTimeout(() => stop('timeout'), timeout);
        child.once('exit', (exitCode, signal) => {
          if (terminal) finish(exitCode, signal);
        });
        child.once('close', finish);
      });
    } catch (error) {
      failure = error;
    }
    if (directory)
      try {
        await fs.rm(directory, { recursive: true, force: true });
      } catch (error) {
        failure ??= error;
      }
    if (failure !== undefined) {
      const error =
        failure instanceof TransportError
          ? failure
          : new TransportError('payload_io', started);
      error.indeterminate = !!call.mutates && (started || error.started);
      throw error;
    }
    return result!;
  }

  async json(config: Config, call: Call): Promise<unknown> {
    const result = await this.run(config, call, {
      capture: true,
      timeout: config.timeout,
    });
    try {
      const decode = (bytes: Uint8Array | null): unknown => {
        try {
          const text = new TextDecoder('utf-8', { fatal: true }).decode(
            bytes ?? new Uint8Array(),
          );
          for (const match of text.matchAll(
            /"(?:\\.|[^"\\])*"|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
          )) {
            if (
              match[1] !== undefined &&
              (!Number.isFinite(Number(match[1])) ||
                Math.abs(Number(match[1])) > Number.MAX_SAFE_INTEGER)
            )
              throw new Error('Unsafe JSON number');
          }
          const value: unknown = JSON.parse(text);
          portable(value);
          return value;
        } catch {
          throw new TransportError('protocol', true);
        }
      };
      if (result.exitCode !== 0) {
        const envelope = decode(result.stderr);
        const error = record(envelope) ? envelope.error : undefined;
        if (
          record(error) &&
          typeof error.code === 'string' &&
          typeof error.message === 'string' &&
          record(error.details) &&
          Object.values(error.details).every((item) => typeof item === 'string')
        )
          throw new SaucepanError(
            error.code,
            error.message,
            error.details as Record<string, string>,
          );
        throw new TransportError('protocol', true);
      }
      const value = decode(result.stdout);
      if (call.shape === 'array') {
        if (
          !Array.isArray(value) ||
          !value.every((item) =>
            call.argv[0] === 'register-policies'
              ? typeof item === 'string'
              : record(item),
          )
        )
          throw new TransportError('protocol', true);
      } else {
        if (!record(value)) throw new TransportError('protocol', true);
        const strings = new Set([
          'uuid',
          'app',
          'root',
          'integrity',
          'type',
          'entry_uuid',
          'directory',
          'path',
          'verification',
          'released',
          'removed',
          'state',
        ]);
        const objects = new Set([
          'source',
          'claim',
          'view',
          'acquired',
          'entry',
          'request',
          'descriptor',
          'ownership',
          'definition',
          'group',
          'resources',
          'paths',
          'outputs',
          'context',
          'deferred',
          'pending',
        ]);
        const arrays = new Set([
          'sources',
          'claims',
          'policy_refs',
          'reclaimed',
          'stale',
        ]);
        for (const key of call.required ?? []) {
          if (
            !(key in value) ||
            (strings.has(key) && typeof value[key] !== 'string') ||
            (objects.has(key) && !record(value[key])) ||
            (arrays.has(key) && !Array.isArray(value[key])) ||
            (['revision', 'generation', 'policy_revision'].includes(key) &&
              !Number.isSafeInteger(value[key])) ||
            (key === 'purged' && typeof value[key] !== 'boolean')
          )
            throw new TransportError('protocol', true);
        }
      }
      return value;
    } catch (error) {
      if (error instanceof TransportError) error.indeterminate = !!call.mutates;
      throw error;
    }
  }
}
