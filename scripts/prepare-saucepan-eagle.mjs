import { build } from 'esbuild';
import { cp, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';

// Build production first. The fixture owns every mutable file beneath a fresh temporary root.
const root = await mkdtemp(join(tmpdir(), 'power-eagle-eagle-acceptance-'));
await cp(resolve('dist'), join(root, 'dist'), { recursive: true });
await cp(resolve('examples/runtime-only'), join(root, 'source'), { recursive: true });
await mkdir(join(root, 'state'));
await writeFile(join(root, 'state', '.power-eagle-state.json'), JSON.stringify({ format: 'power-eagle/state', formatVersion: 1 }));
await build({ entryPoints: ['scripts/saucepan-eagle-fixture.tsx'], bundle: true, platform: 'browser', target: 'chrome108', format: 'iife', outfile: join(root, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"' } });
const css = (await readdir(join(root, 'dist', 'assets'))).find(file => file.endsWith('.css'));
const config = { root, binaryPath: process.env.POWER_EAGLE_TEST_SAUCEPAN ?? join(homedir(), '.saucepan', 'bin', 'saucepan.exe') };
await writeFile(join(root, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><title>Power Eagle Saucepan acceptance</title><link rel="stylesheet" href="dist/assets/${css}"></head><body><div id="fixture-actions"></div><details open><summary>Isolated acceptance results</summary><pre id="acceptance-status">Starting…</pre></details><div id="root"></div><script>globalThis.fixtureConfig=${JSON.stringify(config).replaceAll('<', '\\u003c')}</script><script src="fixture.js"></script></body></html>`);
await writeFile(join(root, 'production-index.html.txt'), await readFile('dist/index.html'));
console.log(JSON.stringify({ root, page: join(root, 'index.html'), result: join(root, 'result.json') }, null, 2));
