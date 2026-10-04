import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { SaucepanCli, type SaucepanRunner } from './saucepan';
import {
  POWER_EAGLE_SAUCEPAN_APP,
  PowerEagleSaucepan,
  groupSaucepanArtifacts,
  type SaucepanArtifact,
  type SaucepanRecipe,
  type SaucepanSource,
} from './saucepan-client';

const hostRequire = createRequire(import.meta.url);
const roots: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) {
    const temporary = resolve(tmpdir());
    const target = resolve(root);
    const rel = relative(temporary, target);
    if (!rel.startsWith('power-eagle-saucepan-client-') || rel.includes(sep)) throw new Error('Unexpected cleanup directory');
    rmSync(target, { recursive: true, force: true });
  }
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'power-eagle-saucepan-client-'));
  roots.push(root);
  return { root, stateRoot: join(root, '.powereagle'), requestRoot: root };
}

function artifact(id: string, sourceId: string, source: SaucepanSource): SaucepanArtifact {
  return {
    id, source_id: sourceId, source, snapshot_id: `snapshot-${id}`, revision: `revision-${id}`,
    folder: null, content_id: `content-${id}`, files: { 'manifest.json': { digest: id, executable: false } },
  };
}

function commandOf(arguments_: readonly string[]): string {
  return arguments_.find(argument => !argument.startsWith('--')) ?? '';
}

function requestAfter(arguments_: readonly string[], command: string): SaucepanRecipe {
  const index = arguments_.indexOf(command);
  return JSON.parse(readFileSync(arguments_[index + 1], 'utf8')) as SaucepanRecipe;
}

function centralRunner() {
  const entries: Record<string, SaucepanArtifact> = {};
  const recipes: SaucepanRecipe[] = [];
  const runner = vi.fn<SaucepanRunner>(async (_binary, arguments_) => {
    const command = commandOf(arguments_);
    if (command === 'register') {
      return { exitCode: 0, stdout: JSON.stringify({ version: 1, app: POWER_EAGLE_SAUCEPAN_APP, token: Array(32).fill(7) }), stderr: '' };
    }
    if (command === 'acquire') {
      const recipe = requestAfter(arguments_, command);
      recipes.push(recipe);
      const sourceId = `${recipe.source.provider}-${recipes.length}`;
      const value = artifact(`artifact-${recipes.length}`, sourceId, recipe.source);
      if (arguments_.some(argument => argument.startsWith('--marker='))) entries[value.id] = value;
      return {
        exitCode: 0,
        stdout: JSON.stringify({ artifact: value, directory: join('central', value.id), fallback: false, update_checked: true, content_verified: true }),
        stderr: '',
      };
    }
    if (command === 'view') {
      return { exitCode: 0, stdout: JSON.stringify({
        version: 1, app: POWER_EAGLE_SAUCEPAN_APP,
        settings: { retain_snapshots: true, verify_content: false, allow_local_fallback: false },
        filters: { source_ids: [], providers: [] }, entries,
      }), stderr: '' };
    }
    if (command === 'configure') return { exitCode: 0, stdout: '{"configured":true}', stderr: '' };
    if (command === 'path') return { exitCode: 0, stdout: JSON.stringify(join('central', arguments_[arguments_.length - 1])), stderr: '' };
    if (command === 'history') return { exitCode: 0, stdout: JSON.stringify({ source: { provider: 'git', origin: 'one', reference: 'main' }, current: null, history: [], sequence: 1 }), stderr: '' };
    return { exitCode: 1, stdout: '', stderr: `Unexpected command ${command}` };
  });
  return { runner, recipes };
}

describe('Power Eagle Saucepan application client', () => {
  it('persists one stable registration marker and reuses it', async () => {
    const item = fixture();
    const central = centralRunner();
    const cli = new SaucepanCli({ binaryPath: 'fixture', runner: central.runner, temporaryDirectory: item.requestRoot, hostRequire });
    const client = new PowerEagleSaucepan({ cli, stateRoot: item.stateRoot, hostRequire });

    await expect(client.ensureRegistration()).resolves.toBe('registered');
    const marker = JSON.parse(readFileSync(client.markerPath, 'utf8')) as { app: string; token: number[] };
    expect(marker.app).toBe(POWER_EAGLE_SAUCEPAN_APP);
    expect(marker.token).toHaveLength(32);
    await expect(client.ensureRegistration()).resolves.toBe('existing');

    expect(central.runner.mock.calls.filter(call => commandOf(call[1]) === 'register')).toHaveLength(1);
    expect(existsSync(client.markerPath)).toBe(true);
  });

  it('separates persistent and session-only acquisition for every recipe provider', async () => {
    const item = fixture();
    const central = centralRunner();
    const cli = new SaucepanCli({ binaryPath: 'fixture', runner: central.runner, temporaryDirectory: item.requestRoot, hostRequire });
    const client = new PowerEagleSaucepan({ cli, stateRoot: item.stateRoot, hostRequire });
    await client.ensureRegistration();

    const git: SaucepanRecipe = { source: { provider: 'git', origin: 'https://example.test/one.git', reference: 'main' } };
    const url: SaucepanRecipe = { source: { provider: 'url', url: 'https://example.test/package.zip', download: { format: 'zip' } } };
    const local: SaucepanRecipe = { source: { provider: 'local', path: 'C:\\packages\\local' } };
    const persistent = await client.acquirePersistent(git);
    const sessionUrl = await client.acquireSession(url);
    const sessionLocal = await client.acquireSession(local);

    expect(central.recipes).toEqual([git, url, local]);
    expect(Object.keys((await client.view()).entries)).toEqual([persistent.artifact.id]);
    expect(client.sessionArtifacts().map(value => value.id)).toEqual([sessionUrl.artifact.id, sessionLocal.artifact.id]);
    const reopened = new PowerEagleSaucepan({ cli, stateRoot: item.stateRoot, hostRequire });
    await expect(reopened.ensureRegistration()).resolves.toBe('existing');
    expect(Object.keys((await reopened.view()).entries)).toEqual([persistent.artifact.id]);
    expect(reopened.sessionArtifacts()).toEqual([]);
    const acquireCalls = central.runner.mock.calls.filter(call => commandOf(call[1]) === 'acquire');
    expect(acquireCalls[0][1][0]).toBe(`--marker=${client.markerPath}`);
    expect(acquireCalls[1][1][0]).toBe('acquire');
    expect(acquireCalls[2][1][0]).toBe('acquire');
  });

  it('scopes configuration, view, path, and history through the stable marker', async () => {
    const item = fixture();
    const central = centralRunner();
    const cli = new SaucepanCli({ binaryPath: 'fixture', runner: central.runner, temporaryDirectory: item.requestRoot, hostRequire });
    const client = new PowerEagleSaucepan({ cli, stateRoot: item.stateRoot, hostRequire });
    await client.ensureRegistration();

    await client.configure({ settings: { retain_snapshots: true, verify_content: true, allow_local_fallback: false } });
    await client.view();
    await expect(client.path('artifact-a')).resolves.toContain('artifact-a');
    await expect(client.history('source-a')).resolves.toMatchObject({ sequence: 1 });

    for (const call of central.runner.mock.calls.filter(call => ['configure', 'view', 'path', 'history'].includes(commandOf(call[1])))) {
      expect(call[1][0]).toBe(`--marker=${client.markerPath}`);
    }
  });

  it('groups same-provider artifacts by canonical source id without a companion index', () => {
    const firstSource = { provider: 'git', origin: 'https://example.test/one.git', reference: 'main' } as const;
    const secondSource = { provider: 'git', origin: 'https://example.test/two.git', reference: 'main' } as const;
    const groups = groupSaucepanArtifacts([
      artifact('b', 'source-two', secondSource),
      artifact('a', 'source-one', firstSource),
      artifact('c', 'source-one', firstSource),
    ]);

    expect(groups.map(group => [group.sourceId, group.source.provider, group.artifacts.map(value => value.id)]))
      .toEqual([
        ['source-one', 'git', ['a', 'c']],
        ['source-two', 'git', ['b']],
      ]);
  });
});
