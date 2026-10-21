import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
const result = await build({ entryPoints: ['src/host/install/entry.ts'], bundle: true, platform: 'node', target: 'node16.17', format: 'cjs', outfile: 'dist/saucepan-host.cjs', write: false });
await mkdir('dist', { recursive: true });
await writeFile('dist/saucepan-host.cjs', result.outputFiles[0].text.replace(/[ \t]+$/gm, ''));
