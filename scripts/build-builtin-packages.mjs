import { build } from 'esbuild';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const outfile = resolve('.artifacts/tooling/builtin-packages.mjs');
await build({ entryPoints: ['src/sdui/tooling/builtin-packages.ts'], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
const { buildBuiltinArtifacts } = await import(pathToFileURL(outfile).href);
console.log(`Assembled ${(await buildBuiltinArtifacts()).length} built-in plugin artifacts.`);
