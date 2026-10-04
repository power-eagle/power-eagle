import { build } from 'esbuild';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const tooling = resolve('.artifacts/tooling/provider-package.mjs');
await build({ entryPoints: ['src/sdui/tooling/provider-package.ts'], outfile: tooling, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
const { buildContributionArtifact } = await import(`${pathToFileURL(tooling).href}?v=${Date.now()}`);
const outputRoot = resolve(process.argv[2] ?? '.artifacts/package-examples');

for (const name of ['provider-only', 'mixed-package']) {
  const result = await buildContributionArtifact(
    resolve(`examples/${name}/power-eagle.build.json`),
    resolve(outputRoot, name),
  );
  console.log(`Built ${result.manifest.id}: ${result.outputDirectory}`);
}
