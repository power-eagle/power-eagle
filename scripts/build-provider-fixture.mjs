import { build as bundle } from 'esbuild';
import { build as buildHost } from 'vite';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, '.artifacts/provider-host');
await mkdir(output, { recursive: true });

async function provider(revision) {
  const result = await bundle({
    entryPoints: [join(root, 'examples/provider-host/provider.tsx')],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'browser',
    target: 'chrome107',
    jsx: 'automatic',
    external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'clsx'],
    define: { PROBE_REVISION: JSON.stringify(revision), 'process.env.NODE_ENV': '"production"' },
  });
  // Scope externals to this provider factory: never patch global Node resolution.
  return `module.exports = function(sdk) {\nconst module = { exports: {} };\nconst exports = module.exports;\nconst require = id => Object.prototype.hasOwnProperty.call(sdk.sharedModules, id) ? sdk.sharedModules[id] : sdk.require(id);\n${result.outputFiles[0].text}\nreturn module.exports.default(sdk);\n};\n`;
}

const current = await provider('original');
const next = await provider('updated');
for (const [id, alias, version] of [['alpha', 'probe-clsx-v1', '1.2.1'], ['beta', 'probe-clsx-v2', '2.1.1']]) {
  const dir = join(output, 'packages', id);
  await mkdir(join(dir, 'node_modules'), { recursive: true });
  await mkdir(join(dir, 'assets'), { recursive: true });
  const dependencyRoot = join(root, 'node_modules', alias);
  const metadata = JSON.parse(await readFile(join(dependencyRoot, 'package.json'), 'utf8'));
  if (metadata.version !== version) throw new Error(`Unexpected ${alias} version`);
  await cp(dependencyRoot, join(dir, 'node_modules/clsx'), { recursive: true, dereference: true });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: `probe-${id}`, private: true, dependencies: { clsx: version } }, null, 2));
  await writeFile(join(dir, 'manifest.json'), JSON.stringify({
    format: 'power-eagle/package', formatVersion: 1, id: `probe.${id}`, name: `Probe ${id}`, version: '1.0.0',
    description: 'Isolated provider feasibility fixture', sdk: '^1.0.0',
    contributions: { runtime: 'run.json', widgets: 'types.cjs' },
    exports: [{ id: 'switch', kind: 'widget' }],
  }, null, 2));
  await writeFile(join(dir, 'run.json'), JSON.stringify({ format: 'power-eagle/runtime', formatVersion: 1, screen: { type: `probe.${id}/switch` } }, null, 2));
  await writeFile(join(dir, 'types.cjs'), current);
  await writeFile(join(dir, 'types.next.cjs'), next);
  await writeFile(join(dir, 'assets/marker.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#f5a524"/></svg>');
}

await buildHost({
  configFile: false,
  root: join(root, 'examples/provider-host'),
  base: './',
  build: { outDir: output, emptyOutDir: false, target: 'chrome107' },
});
await cp(join(root, 'logo.png'), join(output, 'logo.png'));
await writeFile(join(output, 'manifest.json'), JSON.stringify({
  id: 'd7fc7c5b-36d7-4fa8-a035-a594a6e1b2d9', version: '0.1.0', platform: 'all', arch: 'all',
  name: 'Power Eagle Provider Experiment', logo: '/logo.png', keywords: ['development'], devTools: true,
  main: { url: 'index.html', width: 910, height: 750, multiple: false },
}, null, 2));
console.log(`Built isolated Eagle fixture: ${output}`);
