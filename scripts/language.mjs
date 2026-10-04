import { build } from 'esbuild';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const outfile = resolve('.artifacts/tooling/language.mjs');
await build({ entryPoints: ['src/sdui/tooling/cli.ts'], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
try {
  const { main } = await import(pathToFileURL(outfile).href);
  await main(process.argv[2], process.argv.slice(3));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
