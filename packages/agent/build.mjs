import { build } from 'esbuild';
import { copyFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const entries = ["index", "react"];
for (const entry of entries) for (const format of ['esm', 'cjs']) {
  await build({ entryPoints: ['src/' + entry + '.ts'], outfile: 'dist/' + entry + (format === 'esm' ? '.js' : '.cjs'), bundle: true, packages: 'external', format, platform: 'neutral', target: 'es2020', jsx: 'automatic' });
}
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json'], { stdio: 'inherit', windowsHide: true });
// Each import condition gets declarations with the matching module identity.
for (const file of readdirSync('dist').filter(file => file.endsWith('.d.ts'))) {
  writeFileSync('dist/' + file.replace(/\.d\.ts$/, '.d.cts'), readFileSync('dist/' + file, 'utf8').replace(/(from\s+['"][^'"]+)\.js(['"])/g, '$1.cjs$2'));
}
copyFileSync('src/styles.css', 'dist/styles.css');
