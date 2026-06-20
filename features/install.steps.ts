import { expect } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import * as nodeOs from 'node:os';
import * as nodeCp from 'node:child_process';
import { addRepo, installPlugin } from '../src/host/install/store';

// The install layer reaches the filesystem and git through the Eagle renderer's
// window.require bridge; under the Node test runner we provide the same bridge
// backed by the real node modules (matches src/tests/install-store.test.ts).
(globalThis as unknown as { window: { require: (m: string) => unknown } }).window = {
  require: (moduleName: string) => {
    if (moduleName === 'fs') return nodeFs;
    if (moduleName === 'path') return nodePath;
    if (moduleName === 'os') return nodeOs;
    if (moduleName === 'child_process') return nodeCp;
    throw new Error(`Unexpected module request: ${moduleName}`);
  },
};

const { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } = nodeFs;
const { join } = nodePath;
const { tmpdir } = nodeOs;
const { execFileSync } = nodeCp;

const feature = await loadFeature('features/install.feature');

/** Make a real local git repo with a single committed snapshot of `dir`. */
function commitGitRepo(dir: string): void {
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync(
    'git',
    ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'init'],
    { cwd: dir },
  );
}

/** Create a named git repo under a fresh temp parent so the url's last segment is `name`. */
function makeRepo(name: string, files: Record<string, string>): string {
  const parent = mkdtempSync(join(tmpdir(), 'pe-src-'));
  const repo = join(parent, name);
  mkdirSync(repo, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    writeFileSync(join(repo, rel), content);
  }
  commitGitRepo(repo);
  // Return a url-shaped (forward-slash) path: real git urls use '/', and the
  // repo-name deriver splits on '/'. git clone accepts this form on Windows too.
  return repo.replace(/\\/gu, '/');
}

const pluginFiles = (id: string): Record<string, string> => ({
  'manifest.json': JSON.stringify({
    id,
    name: 'Color Picker',
    version: '1.2.0',
    engine: 'peagle@3',
    main: 'index.js',
  }),
  'index.js': 'export default {};\n',
});

describeFeature(feature, ({ Scenario }) => {
  Scenario('Adding a plugin repository clones and classifies it', ({ Given, And, When, Then }) => {
    let home: string;
    let url: string;
    let result: ReturnType<typeof addRepo>;

    Given('an empty Power Eagle home', () => {
      home = mkdtempSync(join(tmpdir(), 'pe-home-'));
    });
    And('a git repository "color-picker" that contains a plugin manifest', () => {
      url = makeRepo('color-picker', pluginFiles('color-picker'));
    });
    When('I add the repository by its url', () => {
      result = addRepo(url, home);
    });
    Then('the repository is cloned into repos/color-picker', () => {
      expect(existsSync(join(home, 'repos', 'color-picker', 'manifest.json'))).toBe(true);
    });
    And('the repository is classified as a plugin', () => {
      expect(result.isPlugin).toBe(true);
    });
  });

  Scenario('Adding a repository with no Power Eagle manifests is rejected', ({ Given, And, When, Then }) => {
    let home: string;
    let url: string;
    let error: unknown;

    Given('an empty Power Eagle home', () => {
      home = mkdtempSync(join(tmpdir(), 'pe-home-'));
    });
    And('a git repository "not-a-plugin" with no manifest.json or marketplace.json', () => {
      url = makeRepo('not-a-plugin', { 'README.md': '# nope\n' });
    });
    When('I try to add the repository by its url', () => {
      try {
        addRepo(url, home);
      } catch (err) {
        error = err;
      }
    });
    Then('the add is rejected as not a Power Eagle repo', () => {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/not a Power Eagle repo/i);
    });
    And('no directory remains under repos/', () => {
      const repos = join(home, 'repos');
      expect(existsSync(repos) ? readdirSync(repos) : []).toEqual([]);
    });
  });

  Scenario('Installing a plugin copies its directory and records the install', ({ Given, And, When, Then }) => {
    let home: string;
    let entry: ReturnType<typeof installPlugin>;

    Given('an empty Power Eagle home', () => {
      home = mkdtempSync(join(tmpdir(), 'pe-home-'));
    });
    And('an added plugin repository "color-picker"', () => {
      const url = makeRepo('color-picker', pluginFiles('color-picker'));
      addRepo(url, home);
    });
    When('I install the plugin "color-picker"', () => {
      entry = installPlugin('color-picker', home);
    });
    Then('the whole plugin directory is copied into plugins/color-picker', () => {
      expect(existsSync(join(home, 'plugins', 'color-picker', 'manifest.json'))).toBe(true);
      expect(existsSync(join(home, 'plugins', 'color-picker', 'index.js'))).toBe(true);
    });
    And('installed.json records the plugin id, name and version', () => {
      const installed = JSON.parse(readFileSync(join(home, 'installed.json'), 'utf8'));
      expect(installed).toContainEqual(
        expect.objectContaining({ id: 'color-picker', name: 'Color Picker', version: '1.2.0' }),
      );
      expect(entry.id).toBe('color-picker');
    });
  });
});
