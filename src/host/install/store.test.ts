import { afterEach, describe, expect, it } from 'vitest';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import * as nodeOs from 'node:os';
import * as nodeCp from 'node:child_process';
import { addRepo, installPlugin, resolveStorePaths } from './store';

// Same window.require bridge the install layer expects in the Eagle renderer,
// backed by real node modules under the test runner. homedir is overridable so
// the default (no baseDir) path can be exercised against a temp dir.
let homeOverride = nodeOs.homedir();
(globalThis as unknown as { window: { require: (m: string) => unknown } }).window = {
  require: (moduleName: string) => {
    if (moduleName === 'fs') return nodeFs;
    if (moduleName === 'path') return nodePath;
    if (moduleName === 'os') return { ...nodeOs, homedir: () => homeOverride };
    if (moduleName === 'child_process') return nodeCp;
    throw new Error(`Unexpected module request: ${moduleName}`);
  },
};

const homes: string[] = [];
function freshHome(): string {
  const home = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'pe-home-'));
  homes.push(home);
  return home;
}

function makePluginRepo(id: string, version: string): string {
  const repo = nodePath.join(nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'pe-src-')), id);
  nodeFs.mkdirSync(repo, { recursive: true });
  nodeFs.writeFileSync(
    nodePath.join(repo, 'manifest.json'),
    JSON.stringify({ id, name: 'Plugin', version, engine: 'peagle@3', main: 'index.js' }),
  );
  nodeFs.writeFileSync(nodePath.join(repo, 'index.js'), 'export default {};\n');
  nodeCp.execFileSync('git', ['init', '-q'], { cwd: repo });
  nodeCp.execFileSync('git', ['add', '-A'], { cwd: repo });
  nodeCp.execFileSync(
    'git',
    ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'init'],
    { cwd: repo },
  );
  return repo.replace(/\\/gu, '/');
}

afterEach(() => {
  homeOverride = nodeOs.homedir();
});

describe('resolveStorePaths', () => {
  it('lays out repos/, plugins/ and installed.json under an explicit base dir', () => {
    const paths = resolveStorePaths('/tmp/base');
    expect(paths.reposDir).toBe(nodePath.join('/tmp/base', 'repos'));
    expect(paths.pluginsDir).toBe(nodePath.join('/tmp/base', 'plugins'));
    expect(paths.installedFile).toBe(nodePath.join('/tmp/base', 'installed.json'));
  });

  it('defaults the base dir to ~/.powereagle when none is given', () => {
    homeOverride = '/home/someone';
    expect(resolveStorePaths().root).toBe(nodePath.join('/home/someone', '.powereagle'));
  });
});

describe('addRepo', () => {
  it('throws when the clone fails', () => {
    const home = freshHome();
    expect(() => addRepo('does-not-exist://nope/repo.git', home)).toThrow(/git clone failed/iu);
  });
});

describe('installPlugin', () => {
  it('replaces the existing installed.json entry when a plugin is re-installed', () => {
    const home = freshHome();
    addRepo(makePluginRepo('color-picker', '1.0.0'), home);
    installPlugin('color-picker', home);
    installPlugin('color-picker', home);

    const installed = JSON.parse(
      nodeFs.readFileSync(nodePath.join(home, 'installed.json'), 'utf8'),
    );
    expect(installed).toHaveLength(1);
    expect(installed[0].id).toBe('color-picker');
  });
});
