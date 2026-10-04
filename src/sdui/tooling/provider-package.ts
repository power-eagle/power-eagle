import { randomUUID } from 'node:crypto';
import {
  cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { rename } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { build as bundle } from 'esbuild';
import { z } from 'zod';
import { discoverContributionPackage } from '../../host/install/contribution-package';
import { packageSchema, relativePath, type PackageManifest } from '../schema/model';
import { unwrap, validatePackage } from '../schema/validate';

const buildConfigSchema = z.strictObject({
  format: z.literal('power-eagle/build'),
  formatVersion: z.literal(1),
  manifest: relativePath,
  providers: z.strictObject({
    widgets: relativePath.optional(),
    styling: relativePath.optional(),
    actions: relativePath.optional(),
    services: relativePath.optional(),
  }),
  externalDependencies: z.array(z.string().min(1)).default([]),
});

export type ProviderBuildConfig = z.infer<typeof buildConfigSchema>;

export interface PackageBuildResult {
  outputDirectory: string;
  manifest: PackageManifest;
  providers: string[];
  dependencies: Record<string, string>;
}

const sharedModules = ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'];
const executableContributions = ['widgets', 'styling', 'actions', 'services'] as const;

function inside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function sourcePath(root: string, path: string, label: string): string {
  const candidate = resolve(root, path);
  if (!inside(root, candidate)) throw new Error(`${label} escapes the source package: ${path}`);
  if (!existsSync(candidate)) throw new Error(`${label} does not exist: ${path}`);
  const canonical = realpathSync(candidate);
  if (!inside(root, canonical)) throw new Error(`${label} resolves outside the source package: ${path}`);
  return canonical;
}

function write(destination: string, content: string | Uint8Array): void {
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, content);
}

function copyFile(source: string, destination: string): void {
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: statSync(source).isDirectory(), dereference: true });
}

function packageRoot(dependency: string, fromRoot: string): string {
  const localRequire = createRequire(join(fromRoot, 'package.json'));
  let cursor = dirname(localRequire.resolve(dependency));
  while (cursor) {
    const metadataFile = join(cursor, 'package.json');
    if (existsSync(metadataFile)) {
      const metadata = JSON.parse(readFileSync(metadataFile, 'utf8')) as { name?: string };
      if (metadata.name === dependency) return realpathSync(cursor);
    }
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  throw new Error(`Unable to locate package root for production dependency ${dependency}`);
}

async function renameWithRetry(source: string, destination: string): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await rename(source, destination);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!['EBUSY', 'EPERM'].includes(code ?? '') || attempt === 5) throw error;
      await new Promise(resolveDelay => setTimeout(resolveDelay, 20 * (2 ** attempt)));
    }
  }
}

async function publishDirectory(source: string, destination: string): Promise<void> {
  try {
    await renameWithRetry(source, destination);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (!['EBUSY', 'EPERM'].includes(code ?? '')) throw error;
    cpSync(source, destination, { recursive: true, dereference: true, errorOnExist: true });
    rmSync(source, { recursive: true, force: true });
  }
}

function dependencyDestination(nodeModules: string, name: string): string {
  return name.startsWith('@') ? join(nodeModules, ...name.split('/')) : join(nodeModules, name);
}

function copyPackageFiles(source: string, destination: string): void {
  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, {
    recursive: true,
    dereference: true,
    filter: path => {
      const rel = relative(source, path);
      return rel === '' || (!rel.split(/[\\/]/).includes('node_modules') && !rel.split(/[\\/]/).includes('.git'));
    },
  });
}

function copyDependency(name: string, fromRoot: string, targetNodeModules: string, stack: string[]): string {
  if (stack.includes(name)) throw new Error(`Production dependency cycle cannot be assembled: ${[...stack, name].join(' -> ')}`);
  const source = packageRoot(name, fromRoot);
  const metadata = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8')) as {
    version?: string;
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  };
  if (!metadata.version) throw new Error(`Production dependency ${name} has no version`);
  const destination = dependencyDestination(targetNodeModules, name);
  copyPackageFiles(source, destination);
  const children = { ...metadata.dependencies, ...metadata.optionalDependencies };
  for (const child of Object.keys(children).sort()) {
    try {
      copyDependency(child, source, join(destination, 'node_modules'), [...stack, name]);
    } catch (error) {
      if (!metadata.optionalDependencies?.[child]) throw error;
    }
  }
  return metadata.version;
}

function wrapProvider(code: string): string {
  return `'use strict';\nmodule.exports = function powerEagleProvider(sdk) {\n` +
    `const module = { exports: {} };\nconst exports = module.exports;\n` +
    `function require(id) { return Object.prototype.hasOwnProperty.call(sdk.sharedModules, id) ? sdk.sharedModules[id] : sdk.require(id); }\n` +
    `require.resolve = sdk.require.resolve.bind(sdk.require);\nrequire.cache = sdk.require.cache;\n` +
    `${code}\nconst providerFactory = module.exports && module.exports.default;\n` +
    `if (typeof providerFactory !== 'function') throw new Error('Compiled provider entry must default-export an SDK provider factory');\n` +
    `return providerFactory(sdk);\n};\n`;
}

async function compileProvider(source: string, externalDependencies: string[]): Promise<string> {
  const result = await bundle({
    entryPoints: [source], bundle: true, write: false, format: 'cjs', platform: 'browser', target: ['chrome108', 'node16.17'],
    jsx: 'automatic', external: [...sharedModules, ...externalDependencies],
    define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
  });
  return wrapProvider(result.outputFiles[0].text);
}

function loadBuildInput(configFile: string): { root: string; config: ProviderBuildConfig; manifest: PackageManifest; sourcePackage: { dependencies?: Record<string, string>; name?: string } } {
  const root = realpathSync(dirname(resolve(configFile)));
  const config = buildConfigSchema.parse(JSON.parse(readFileSync(resolve(configFile), 'utf8')));
  const manifestPath = sourcePath(root, config.manifest, 'Manifest');
  const manifest = unwrap(validatePackage(packageSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')))));
  const sourcePackageFile = join(root, 'package.json');
  const sourcePackage = existsSync(sourcePackageFile)
    ? JSON.parse(readFileSync(sourcePackageFile, 'utf8')) as { dependencies?: Record<string, string>; name?: string }
    : {};
  for (const dependency of config.externalDependencies) {
    if (!sourcePackage.dependencies?.[dependency]) throw new Error(`External production dependency ${dependency} must be declared in package.json dependencies`);
  }
  for (const contribution of executableContributions) {
    if (manifest.contributions[contribution] && !config.providers[contribution]) throw new Error(`Missing provider source for ${contribution}`);
    if (!manifest.contributions[contribution] && config.providers[contribution]) throw new Error(`Provider source ${contribution} has no manifest contribution`);
  }
  return { root, config, manifest, sourcePackage };
}

export async function buildContributionArtifact(configFile: string, outputDirectory: string): Promise<PackageBuildResult> {
  const { root, config, manifest, sourcePackage } = loadBuildInput(configFile);
  const output = resolve(outputDirectory);
  if (inside(root, output)) throw new Error('Package output must be outside the source package');
  const parent = dirname(output);
  const temporary = join(parent, `.${basename(output)}.tmp-${randomUUID()}`);
  const backup = join(parent, `.${basename(output)}.backup-${randomUUID()}`);
  mkdirSync(parent, { recursive: true });
  mkdirSync(temporary);
  let backedUp = false;
  let publishing = false;
  try {
    write(join(temporary, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    if (manifest.contributions.runtime) copyFile(sourcePath(root, manifest.contributions.runtime, 'Runtime entry'), join(temporary, manifest.contributions.runtime));
    for (const asset of manifest.assets) copyFile(sourcePath(root, asset, 'Asset'), join(temporary, asset));
    const providers: string[] = [];
    for (const contribution of executableContributions) {
      const sourceEntry = config.providers[contribution];
      const outputEntry = manifest.contributions[contribution];
      if (!sourceEntry || !outputEntry) continue;
      const compiled = await compileProvider(sourcePath(root, sourceEntry, `${contribution} provider source`), config.externalDependencies);
      write(join(temporary, outputEntry), compiled);
      providers.push(outputEntry);
    }
    const dependencies: Record<string, string> = {};
    for (const dependency of [...config.externalDependencies].sort()) {
      dependencies[dependency] = copyDependency(dependency, root, join(temporary, 'node_modules'), []);
    }
    write(join(temporary, 'package.json'), `${JSON.stringify({
      name: sourcePackage.name ?? manifest.id, private: true, version: manifest.version, type: 'commonjs', dependencies,
      powerEagle: { sdk: manifest.sdk, target: manifest.target ?? null },
    }, null, 2)}\n`);
    discoverContributionPackage(temporary, createRequire(join(temporary, 'manifest.json')), { hostTarget: false });
    if (existsSync(output)) {
      await renameWithRetry(output, backup);
      backedUp = true;
    }
    publishing = true;
    await publishDirectory(temporary, output);
    if (backedUp) rmSync(backup, { recursive: true, force: true });
    return { outputDirectory: output, manifest, providers, dependencies };
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    if (backedUp && existsSync(backup)) {
      rmSync(output, { recursive: true, force: true });
      await publishDirectory(backup, output);
    } else if (publishing) {
      rmSync(output, { recursive: true, force: true });
    }
    throw error;
  }
}

export async function main(configFile = process.argv[2], outputDirectory = process.argv[3]): Promise<void> {
  if (!configFile || !outputDirectory) throw new Error('Usage: npm run package:build -- <power-eagle.build.json> <output-directory>');
  const result = await buildContributionArtifact(configFile, outputDirectory);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
