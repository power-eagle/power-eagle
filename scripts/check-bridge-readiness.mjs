// Read-only checks against installed CLIs; no model requests or store initialization.
import { mkdtemp, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

const root = await mkdtemp(join(tmpdir(), 'power-eagle-bridge-readiness-'));
try {
  await copyFile('dist/saucepan-host.cjs', join(root, 'host.cjs'));
  await build({ entryPoints: ['src/host/workspaces/agent-providers.ts'], outfile: join(root, 'providers.cjs'), bundle: true, platform: 'node', format: 'cjs', target: 'node16.17' });
  await writeFile(join(root, 'check.cjs'), String.raw`
const assert = require('assert/strict');
const { initializeSaucepan } = require('./host.cjs');
const { localProviders } = require('./providers.cjs');
(async () => {
  const manager = await initializeSaucepan({ hostRequire: require });
  assert.equal(manager.status, 'ready', JSON.stringify(manager.error));
  const cp = require('node:child_process'), versions = [];
  const hostRequire = name => name !== 'node:child_process' ? require(name) : {
    ...cp, spawn(executable, args, options) {
      assert.deepEqual(args, ['--version'], 'Readiness must not issue protocol requests');
      const child = cp.spawn(executable, args, options);
      let version = '';
      child.stdout.on('data', chunk => { version = (version + chunk).slice(0, 500); });
      child.on('close', () => versions.push(version.trim()));
      return child;
    },
  };
  const providers = localProviders(hostRequire, async () => { throw new Error('No generation in readiness acceptance'); });
  const claude = await providers.available('claude');
  const codex = await providers.available('codex');
  assert.equal(claude, true); assert.equal(codex, true);
  console.log(JSON.stringify({ node: process.version, saucepan: manager.version, claude, codex, versions, readOnly: true }));
})().catch(error => { console.error(error); process.exitCode = 1; });
`);
  const result = spawnSync(process.env.POWER_EAGLE_TEST_NODE ?? process.execPath, [join(root, 'check.cjs')], { cwd: root, encoding: 'utf8', timeout: 30_000, windowsHide: true });
  process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Installed bridge readiness failed (${result.status})`);
} finally {
  await rm(root, { recursive: true, force: true });
}
