import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { sharedSaucepanExecutablePath } from './saucepan-binary';
import {
  SaucepanCli,
  SaucepanCommandError,
  saucepanJson,
  type SaucepanRunner,
} from './saucepan';
import { initializeSaucepan } from './saucepan-manager';

const hostRequire = createRequire(import.meta.url);
const roots: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) {
    const temporary = resolve(tmpdir());
    const target = resolve(root);
    const rel = relative(temporary, target);
    if (!rel.startsWith('power-eagle-saucepan-test-') || rel.includes(sep)) throw new Error('Unexpected cleanup directory');
    rmSync(target, { recursive: true, force: true });
  }
});

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'power-eagle-saucepan-test-'));
  roots.push(root);
  return root;
}

describe('Saucepan 0.6 CLI transport', () => {
  it('resolves the independently installed shared executable for the host platform', () => {
    const home = join('C:', 'Users', 'Ada');
    expect(sharedSaucepanExecutablePath({ homeDirectory: home, platform: 'win32', hostRequire }))
      .toBe(join(home, '.saucepan', 'bin', 'saucepan.exe'));
    expect(sharedSaucepanExecutablePath({ homeDirectory: '/home/ada', platform: 'linux', hostRequire }))
      .toBe(join('/home/ada', '.saucepan', 'bin', 'saucepan'));
  });

  it('passes literal argument arrays and removes temporary JSON after success', async () => {
    const temporaryDirectory = temporaryRoot();
    let requestPath = '';
    const runner: SaucepanRunner = async (binary, arguments_, options) => {
      expect(binary).toBe('saucepan-fixture');
      expect(arguments_.slice(0, 2)).toEqual(['--marker=C:\\marker with spaces.json', 'acquire']);
      requestPath = arguments_[2];
      expect(existsSync(requestPath)).toBe(true);
      expect(JSON.parse((hostRequire('fs') as typeof import('node:fs')).readFileSync(requestPath, 'utf8')))
        .toEqual({ source: { provider: 'local', path: 'C:\\package $(literal)' } });
      expect(options).toEqual({ timeoutMs: 0, maxBuffer: 16 * 1024 * 1024 });
      return { exitCode: 0, stdout: '{"directory":"central"}', stderr: '' };
    };
    const cli = new SaucepanCli({
      binaryPath: 'saucepan-fixture',
      temporaryDirectory,
      runner,
      hostRequire,
    });

    await expect(cli.execute('acquire', [
      '--marker=C:\\marker with spaces.json',
      'acquire',
      saucepanJson({ source: { provider: 'local', path: 'C:\\package $(literal)' } }),
    ])).resolves.toEqual({ directory: 'central' });

    expect(existsSync(requestPath)).toBe(false);
  });

  it('cleans request files after failure and preserves structured diagnostics', async () => {
    const temporaryDirectory = temporaryRoot();
    let requestPath = '';
    const runner: SaucepanRunner = async (_binary, arguments_) => {
      requestPath = arguments_[1];
      return { exitCode: 7, stdout: '', stderr: 'central store is unavailable' };
    };
    const cli = new SaucepanCli({ runner, binaryPath: 'fixture', temporaryDirectory, hostRequire });

    try {
      await cli.execute('acquire', ['acquire', saucepanJson({ source: { provider: 'url', url: 'https://example.test' } })]);
      throw new Error('Expected Saucepan to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(SaucepanCommandError);
      expect(error).toMatchObject({
        operation: 'acquire',
        kind: 'process',
        exitCode: 7,
        stderr: 'central store is unavailable',
      });
      expect((error as Error).message).not.toContain(requestPath);
    }
    expect(existsSync(requestPath)).toBe(false);
  });

  it('reports invalid JSON as a protocol failure', async () => {
    const runner: SaucepanRunner = async () => ({ exitCode: 0, stdout: 'not-json', stderr: '' });
    const cli = new SaucepanCli({ runner, binaryPath: 'fixture', hostRequire });

    await expect(cli.execute('view', ['--app=power-eagle', 'view']))
      .rejects.toMatchObject({ kind: 'protocol', code: 'INVALID_JSON' });
  });

  it('keeps built-ins available when the executable cannot launch', async () => {
    const runner: SaucepanRunner = async () => ({
      exitCode: null,
      stdout: '',
      stderr: '',
      code: 'ENOENT',
    });

    const state = await initializeSaucepan({ runner, binaryPath: 'missing-saucepan', hostRequire });

    expect(state).toMatchObject({
      status: 'unavailable',
      binaryPath: 'missing-saucepan',
      builtInsAvailable: true,
      error: { operation: 'initialize', kind: 'launch' },
    });
    if (state.status === 'unavailable') expect(state.error.recovery).toContain('Install Saucepan 0.6');
  });

  it('probes a compatible executable without initializing the store', async () => {
    const runner = vi.fn<SaucepanRunner>(async (_binary, arguments_) => ({
      exitCode: 0,
      stdout: JSON.stringify('C:\\Users\\Ada\\.saucepan\\bin\\saucepan.exe'),
      stderr: '',
      ...(arguments_.includes('init') ? { exitCode: 99 } : {}),
    }));

    const state = await initializeSaucepan({ runner, binaryPath: 'fixture', hostRequire });

    expect(state).toMatchObject({
      status: 'ready',
      sharedExecutable: 'C:\\Users\\Ada\\.saucepan\\bin\\saucepan.exe',
      builtInsAvailable: true,
    });
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner.mock.calls[0][1]).toEqual(['shared-executable']);
  });
});
