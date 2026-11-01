import { mkdtemp, mkdir, writeFile, readFile, realpath, readdir, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const npm = process.env.npm_execpath;
if (!npm) throw Error('Run this harness with npm run packages:check');
const root = await mkdtemp(join(tmpdir(), 'agent-package-consumers-'));
const report = { root, node: process.version, checks: [], commands: [] };
const env = { ...process.env };
delete env.NODE_PATH;
const run = (cwd, executable, args) => {
  report.commands.push({ cwd, executable, args });
  const result = spawnSync(executable, args, { cwd, env, encoding: 'utf8', windowsHide: true, timeout: 120_000 });
  if (result.error || result.status !== 0) throw Error(`${executable} ${args.join(' ')} failed: ${result.error ?? result.stderr ?? result.stdout}`);
  return result.stdout;
};
const packageVersion = name => require(`${name}/package.json`).version;
try {
  for (const kind of ['providers', 'headless', 'react']) {
    const directory = join(root, kind); await mkdir(directory);
    const agentArchive = resolve('.artifacts/agent-packages/power-eagle-agent-0.1.0.tgz');
    const providersArchive = resolve('.artifacts/agent-packages/power-eagle-agent-providers-0.1.0.tgz');
    const dependencies = kind === 'providers' ? { '@power-eagle/agent-providers': `file:${providersArchive}` } : { '@power-eagle/agent': `file:${agentArchive}` };
    const devDependencies = { typescript: packageVersion('typescript') };
    if (kind === 'react') for (const name of ['react', 'react-dom', '@types/react', '@types/react-dom', 'esbuild']) devDependencies[name] = packageVersion(name);
    await writeFile(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies, devDependencies }, null, 2));
    run(directory, process.execPath, [npm, 'install', '--ignore-scripts', '--no-audit', '--no-fund']);
    const name = kind === 'providers' ? '@power-eagle/agent-providers' : '@power-eagle/agent';
    const installed = await realpath(join(directory, 'node_modules', name));
    if (!relative(root, installed) || relative(root, installed).startsWith('..') || isAbsolute(relative(root, installed))) throw Error('Consumer resolved a workspace link');
    const files = await readdir(installed);
    if (files.some(file => ['src', 'tests', 'node_modules'].includes(file))) throw Error('Archive contains source, test or dependency files');
    const source = kind === 'providers'
      ? `import { createClaudeProvider, createCodexProvider, type ProviderAdapter } from '${name}'; const adapters: ProviderAdapter[] = [createClaudeProvider(), createCodexProvider()]; void adapters;`
      : kind === 'headless'
        ? `import { AgentController, createConversation, conversationContext, type AgentHost } from '${name}'; void AgentController; void (null as unknown as AgentHost); createConversation('text','custom'); conversationContext('text',[]);`
        : `import { AgentPanel, AgentSettingsPanel, type AgentPanelProps } from '${name}/react'; void AgentPanel; void AgentSettingsPanel; void (null as unknown as AgentPanelProps);`;
    for (const extension of ['mts', 'cts']) {
      await writeFile(join(directory, `consumer.${extension}`), source);
      for (const resolution of ['NodeNext', 'Node16']) run(directory, process.execPath, [join(directory, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck', 'false', '--target', 'ES2020', '--module', resolution, '--moduleResolution', resolution, `consumer.${extension}`]);
    }
    run(directory, process.execPath, [join(directory, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--target', 'ES2020', '--module', 'ESNext', '--moduleResolution', 'Bundler', 'consumer.mts']);
    const entry = name + (kind === 'react' ? '/react' : '');
    const assertions = kind === 'providers'
      ? `assert.equal(typeof esm.createClaudeProvider,'function'); assert.equal(typeof cjs.createCodexProvider,'function'); for(const missing of ['react','@power-eagle/agent']) assert.throws(()=>require.resolve(missing));`
      : kind === 'headless'
        ? `assert.equal(typeof esm.AgentController,'function'); assert.equal(typeof cjs.conversationContext,'function'); for(const missing of ['react','@power-eagle/agent-providers']) assert.throws(()=>require.resolve(missing));`
        : `assert.equal(typeof esm.AgentPanel,'function'); assert.equal(typeof cjs.AgentSettingsPanel,'function'); assert.ok(require.resolve('${name}/styles.css').endsWith('.css'));`;
    await writeFile(join(directory, 'imports.mjs'), `import assert from 'node:assert/strict'; import {createRequire} from 'node:module'; const require=createRequire(import.meta.url); const esm=await import('${entry}'); const cjs=require('${entry}'); ${assertions}`);
    run(directory, process.execPath, ['imports.mjs']);
    if (kind === 'providers') {
      await copyFile(resolve('scripts/agent-provider-consumer.mjs'), join(directory, 'native.mjs'));
      run(directory, process.execPath, ['native.mjs']);
    }
    if (kind === 'headless') run(directory, process.execPath, [join(installed, 'examples/run.mjs')]);
    if (kind === 'react') {
      await copyFile(join(installed, 'examples/react-demo.jsx'), join(directory, 'demo.jsx'));
      await copyFile(join(installed, 'examples/text-editor.mjs'), join(directory, 'text-editor.mjs'));
      await writeFile(join(directory, 'build.mjs'), `import {build} from 'esbuild'; await build({entryPoints:['demo.jsx'],bundle:true,platform:'browser',format:'esm',target:'chrome108',jsx:'automatic',outfile:'demo.js'});`);
      run(directory, process.execPath, ['build.mjs']);
      await writeFile(join(directory, 'index.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Independent Agent consumer</title><link rel="stylesheet" href="demo.css"><div id="root"></div><script type="module" src="demo.js"></script></html>');
      report.reactPage = join(directory, 'index.html');
    }
    report.checks.push({ kind, installed, passed: true, importStyles: ['ESM', 'CommonJS'], declarations: ['NodeNext', 'Node16', 'Bundler'] });
  }
} finally {
  await mkdir(resolve('.artifacts/agent-packages'), { recursive: true });
  await writeFile(resolve('.artifacts/agent-packages/consumers.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ root: report.root, node: report.node, checks: report.checks, reactPage: report.reactPage, commandCount: report.commands.length }, null, 2));
}
