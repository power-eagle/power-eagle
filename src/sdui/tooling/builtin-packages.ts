import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { builtinContributionManifests, builtinTools } from '../../plugins/builtins';
import example from '../../../examples/runtime-flow/document';
import exampleManifest from '../../../examples/runtime-flow/manifest.json';
import type { PackageManifest } from '../schema/model';
import { buildContributionArtifact } from './provider-package';

export async function buildBuiltinArtifacts(repository = process.cwd(), output = join(repository, 'public/builtins')): Promise<string[]> {
  const manifests = [exampleManifest as PackageManifest, ...builtinContributionManifests];
  for (const manifest of manifests) {
    const input = join(repository, '.artifacts/builtin-source', manifest.id);
    mkdirSync(input, { recursive: true });
    const write = (path: string, value: unknown) => writeFileSync(join(input, path), `${JSON.stringify(value, null, 2)}\n`);
    write('manifest.json', manifest);
    const document = manifest.id === exampleManifest.id ? example : builtinTools.find(tool => tool.manifest.id === manifest.id)?.document;
    if (document && manifest.contributions.runtime) write(manifest.contributions.runtime, document);
    const providers: Record<string, string> = {};
    for (const kind of ['actions', 'services', 'styling', 'widgets'] as const) {
      if (!manifest.contributions[kind]) continue;
      const entry = `${kind}.ts`;
      const source = resolve(repository, kind === 'styling' ? 'src/plugins/paper-pop/styling.ts' : 'src/plugins/materialized.ts');
      writeFileSync(join(input, entry), `export { default } from ${JSON.stringify(relative(input, source).split('\\').join('/'))};\n`);
      providers[kind] = entry;
    }
    write('power-eagle.build.json', { format: 'power-eagle/build', formatVersion: 1, manifest: 'manifest.json', providers });
    await buildContributionArtifact(join(input, 'power-eagle.build.json'), join(output, manifest.id));
  }
  const ids = manifests.map(manifest => manifest.id);
  writeFileSync(join(output, 'index.json'), `${JSON.stringify(ids, null, 2)}\n`);
  return ids;
}
