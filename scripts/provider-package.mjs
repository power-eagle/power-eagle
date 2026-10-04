import { build } from 'esbuild';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const outfile = resolve('.artifacts/tooling/provider-package.mjs');
await build({ entryPoints: ['src/sdui/tooling/provider-package.ts'], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
try {
  const { main } = await import(`${pathToFileURL(outfile).href}?v=${Date.now()}`);
  await main(process.argv[2], process.argv[3]);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
