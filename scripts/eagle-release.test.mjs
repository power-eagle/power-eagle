import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { unzipSync } from 'fflate';
import { assembleRelease, validateRelease } from './eagle-release.mjs';

const output = await mkdtemp(join(tmpdir(), 'power-eagle-release-test-'));
const first = await assembleRelease(resolve('.'), output);
const second = await assembleRelease(resolve('.'), output);
const files = unzipSync(await readFile(first.archive));
after(async () => {
  for (const root of [output, first.extracted, second.extracted]) {
    if (dirname(resolve(root)) !== resolve(tmpdir()) || !basename(root).startsWith('power-eagle-release-')) throw Error('Unexpected test cleanup root');
    await rm(root, { recursive: true, force: true });
  }
});

test('release archives reproduce and extract outside the checkout with the current entry', async () => {
  assert.equal(first.sha256, second.sha256);
  assert.equal(JSON.parse(await readFile(join(first.extracted, 'manifest.json'), 'utf8')).main.url, 'dist/index.html');
  assert.ok(first.files.length > 20);
  assert.ok(first.files.every(file => file.sha256.length === 64));
  assert.equal(validateRelease(files).version, '6.0.2');
});
test('rejects escaping paths and accidental source/dependency files', () => {
  for (const name of ['../secret', 'dist/../secret', 'dist/absolute:C', 'dist/src/private.ts', 'dist/node_modules/dep/index.js']) {
    assert.throws(() => validateRelease({ ...files, [name]: Buffer.from('bad') }), /Unexpected release path/);
  }
});
test('rejects missing entry references, required fonts and old extra application bundles', () => {
  const withoutFontLicense = { ...files }; delete withoutFontLicense['dist/licenses/ibm-plex-sans.txt'];
  assert.throws(() => validateRelease(withoutFontLicense), /Missing or unsafe release asset/);
  assert.throws(() => validateRelease({ ...files, 'dist/assets/legacy.js': Buffer.from('old') }), /stale application bundle/);
  assert.throws(() => validateRelease({ ...files, 'dist/index.html': Buffer.from('<script src="./missing.js"></script>') }), /Missing or unsafe release asset/);
});
test('rejects remote page assets and escaped built-in entry paths', () => {
  assert.throws(() => validateRelease({ ...files, 'dist/index.html': Buffer.from('<script src="https://example.invalid/app.js"></script>') }), /Remote entry asset/);
  const name = 'dist/builtins/example.runtime-flow/manifest.json';
  const manifest = JSON.parse(Buffer.from(files[name]).toString()); manifest.contributions.runtime = '../private.json';
  assert.throws(() => validateRelease({ ...files, [name]: Buffer.from(JSON.stringify(manifest)) }), /Unsafe built-in asset/);
});
