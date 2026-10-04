import { runtimeSchema, type ExportDescriptor, type PackageManifest, type RuntimeDocument } from '../../sdui/schema/model';
import type {
  CompiledContribution, CompiledProviderExport, ExecutableExportKind, ProviderSdk, SharedRuntimeModules,
} from '../../sdui/sdk/provider';
import { validatePackage, type Diagnostic } from '../../sdui/schema/validate';

export type ExecutableContribution = 'widgets' | 'styling' | 'actions' | 'services';

export interface PackageDiagnostic extends Diagnostic {
  packageRoot: string;
}

export class ContributionPackageError extends Error {
  constructor(public readonly diagnostics: PackageDiagnostic[]) {
    super(diagnostics.map(item => `${item.packageRoot}${item.path || '/'}: ${item.message}`).join('\n'));
    this.name = 'ContributionPackageError';
  }
}

export interface DiscoveredPackage {
  root: string;
  manifestPath: string;
  manifest: PackageManifest;
  entries: Partial<Record<keyof PackageManifest['contributions'], string>>;
  assets: Readonly<Record<string, string>>;
  runtime?: RuntimeDocument;
}

export interface LoadedContribution {
  entry: string;
  contribution: ExecutableContribution;
  kind: ExecutableExportKind;
  exports: CompiledProviderExport[];
}

export interface ProviderLoadOptions {
  hostRequire: NodeRequire;
  sharedModules: SharedRuntimeModules;
}

interface HostModules {
  fs: typeof import('node:fs');
  path: typeof import('node:path');
  pathToFileURL: typeof import('node:url')['pathToFileURL'];
  createRequire: typeof import('node:module')['createRequire'];
}

const executableKinds: Record<ExecutableContribution, ExecutableExportKind> = {
  widgets: 'widget',
  styling: 'styling',
  actions: 'action',
  services: 'service',
};

const executableEntries = Object.keys(executableKinds) as ExecutableContribution[];
const escapePointer = (value: string | number) => String(value).replace(/~/g, '~0').replace(/\//g, '~1');
const pointer = (base: string, key: string | number) => `${base}/${escapePointer(key)}`;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

function modules(hostRequire: NodeRequire): HostModules {
  return {
    fs: hostRequire('fs') as typeof import('node:fs'),
    path: hostRequire('path') as typeof import('node:path'),
    pathToFileURL: (hostRequire('url') as typeof import('node:url')).pathToFileURL,
    createRequire: (hostRequire('module') as typeof import('node:module')).createRequire,
  };
}

function within(path: typeof import('node:path'), root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function ownedPath(host: Pick<HostModules, 'fs' | 'path'>, root: string, relative: string, diagnosticPath: string, diagnostics: PackageDiagnostic[]): string | undefined {
  const candidate = host.path.resolve(root, relative);
  if (!within(host.path, root, candidate)) {
    diagnostics.push({ packageRoot: root, path: diagnosticPath, code: 'path', message: `Declared path escapes the package: ${relative}` });
    return undefined;
  }
  if (!host.fs.existsSync(candidate)) {
    diagnostics.push({ packageRoot: root, path: diagnosticPath, code: 'missing-file', message: `Declared file does not exist: ${relative}` });
    return undefined;
  }
  const canonical = host.fs.realpathSync(candidate);
  if (!within(host.path, root, canonical)) {
    diagnostics.push({ packageRoot: root, path: diagnosticPath, code: 'path', message: `Declared path resolves outside the package: ${relative}` });
    return undefined;
  }
  return canonical;
}

function readJson(host: Pick<HostModules, 'fs'>, file: string, packageRoot: string, path: string, diagnostics: PackageDiagnostic[]): unknown {
  try {
    return JSON.parse(host.fs.readFileSync(file, 'utf8')) as unknown;
  } catch (error) {
    diagnostics.push({ packageRoot, path, code: 'json', message: `Invalid JSON: ${errorMessage(error)}` });
    return undefined;
  }
}

function zodDiagnostics(packageRoot: string, base: string, result: ReturnType<typeof runtimeSchema.safeParse>): PackageDiagnostic[] {
  if (result.success) return [];
  return result.error.issues.flatMap<PackageDiagnostic>(issue => {
    const issuePath = issue.path.reduce<string>((path, key) => pointer(path, String(key)), base);
    return issue.code === 'unrecognized_keys'
      ? issue.keys.map(key => ({ packageRoot, path: pointer(issuePath, String(key)), code: issue.code, message: 'Unknown field' }))
      : [{ packageRoot, path: issuePath, code: issue.code, message: issue.message }];
  });
}

export function discoverContributionPackage(packageRoot: string, hostRequire: NodeRequire, sdkVersion = '1.0.0'): DiscoveredPackage {
  const host = modules(hostRequire);
  const canonicalRoot = host.fs.realpathSync(packageRoot);
  const diagnostics: PackageDiagnostic[] = [];
  const manifestPath = host.path.join(canonicalRoot, 'manifest.json');
  if (!host.fs.existsSync(manifestPath)) {
    throw new ContributionPackageError([{ packageRoot: canonicalRoot, path: '/manifest.json', code: 'missing-file', message: 'Package manifest does not exist' }]);
  }
  const manifestValue = readJson(host, manifestPath, canonicalRoot, '/manifest.json', diagnostics);
  if (diagnostics.length) throw new ContributionPackageError(diagnostics);
  const validated = validatePackage(manifestValue, sdkVersion);
  if (!validated.success) {
    throw new ContributionPackageError(validated.diagnostics.map(item => ({ ...item, packageRoot: canonicalRoot })));
  }
  const manifest = validated.data;
  const entries: DiscoveredPackage['entries'] = {};
  for (const [key, relative] of Object.entries(manifest.contributions) as Array<[keyof typeof manifest.contributions, string]>) {
    const entry = ownedPath(host, canonicalRoot, relative, `/contributions/${key}`, diagnostics);
    if (entry) entries[key] = entry;
  }
  const assets: Record<string, string> = {};
  manifest.assets.forEach((relative, index) => {
    const asset = ownedPath(host, canonicalRoot, relative, `/assets/${index}`, diagnostics);
    if (asset) assets[relative] = asset;
  });

  let runtime: RuntimeDocument | undefined;
  if (entries.runtime) {
    const runtimeValue = readJson(host, entries.runtime, canonicalRoot, '/contributions/runtime', diagnostics);
    if (runtimeValue !== undefined) {
      const parsed = runtimeSchema.safeParse(runtimeValue);
      diagnostics.push(...zodDiagnostics(canonicalRoot, '/contributions/runtime', parsed));
      if (parsed.success) {
        runtime = parsed.data;
        manifest.exports.forEach((descriptor, exportIndex) => {
          if (descriptor.kind !== 'runtime') return;
          descriptor.screens.forEach((screen, screenIndex) => {
            if (!Object.prototype.hasOwnProperty.call(runtime!.screens, screen)) {
              diagnostics.push({
                packageRoot: canonicalRoot,
                path: `/exports/${exportIndex}/screens/${screenIndex}`,
                code: 'export-mismatch',
                message: `Runtime entry does not declare screen ${screen}`,
              });
            }
          });
        });
      }
    }
  }
  if (diagnostics.length) throw new ContributionPackageError(diagnostics);
  return { root: canonicalRoot, manifestPath, manifest, entries, assets, runtime };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function providerShape(value: unknown, kind: ExecutableExportKind, expected: ExportDescriptor[], packageRoot: string, path: string): CompiledContribution {
  const diagnostics: PackageDiagnostic[] = [];
  const fail = (suffix: string, code: string, message: string) => diagnostics.push({ packageRoot, path: `${path}${suffix}`, code, message });
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('', 'provider-contract', 'Provider factory must return an object');
  }
  const candidate = value as Partial<CompiledContribution>;
  if (candidate.format !== 'power-eagle/provider' || candidate.formatVersion !== 1) fail('', 'provider-contract', 'Unsupported compiled provider format');
  if (candidate.kind !== kind) fail('/kind', 'provider-contract', `Expected ${kind} contribution`);
  if (!Array.isArray(candidate.exports)) fail('/exports', 'provider-contract', 'Provider exports must be an array');
  const exports = Array.isArray(candidate.exports) ? candidate.exports : [];
  const expectedById = new Map(expected.map(descriptor => [descriptor.id, descriptor]));
  const seen = new Set<string>();
  exports.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      fail(`/exports/${index}`, 'provider-contract', 'Provider export must be an object');
      return;
    }
    const providerExport = item as Partial<CompiledProviderExport>;
    const descriptor = providerExport.descriptor;
    if (!descriptor || typeof descriptor !== 'object' || typeof descriptor.id !== 'string') {
      fail(`/exports/${index}/descriptor`, 'provider-contract', 'Provider export requires a descriptor');
      return;
    }
    if (seen.has(descriptor.id)) fail(`/exports/${index}/descriptor/id`, 'export-mismatch', `Duplicate provider export ${descriptor.id}`);
    seen.add(descriptor.id);
    const declared = expectedById.get(descriptor.id);
    if (!declared) fail(`/exports/${index}/descriptor/id`, 'export-mismatch', `Undeclared provider export ${descriptor.id}`);
    else if (canonicalJson(declared) !== canonicalJson(descriptor)) fail(`/exports/${index}/descriptor`, 'export-mismatch', `Provider descriptor does not match manifest export ${descriptor.id}`);
    if (providerExport.implementation === undefined) fail(`/exports/${index}/implementation`, 'provider-contract', `Provider export ${descriptor.id} has no implementation`);
  });
  expected.forEach(descriptor => {
    if (!seen.has(descriptor.id)) fail('/exports', 'export-mismatch', `Provider omitted manifest export ${descriptor.id}`);
  });
  if (diagnostics.length) throw new ContributionPackageError(diagnostics);
  return candidate as CompiledContribution;
}

export function loadCompiledContributions(discovered: DiscoveredPackage, options: ProviderLoadOptions): LoadedContribution[] {
  const host = modules(options.hostRequire);
  const localRequire = host.createRequire(discovered.manifestPath);
  const loaded: LoadedContribution[] = [];
  for (const id of ['react', 'react-dom', 'react/jsx-runtime'] as const) {
    if (!options.sharedModules[id]) {
      throw new ContributionPackageError([{ packageRoot: discovered.root, path: '/host/sharedModules', code: 'host-contract', message: `Missing shared runtime module ${id}` }]);
    }
  }
  for (const contribution of executableEntries) {
    const entry = discovered.entries[contribution];
    if (!entry) continue;
    const kind = executableKinds[contribution];
    const expected = discovered.manifest.exports.filter(descriptor => descriptor.kind === kind);
    const path = `/contributions/${contribution}`;
    try {
      const factory = localRequire(entry) as unknown;
      if (typeof factory !== 'function') {
        throw new ContributionPackageError([{ packageRoot: discovered.root, path, code: 'provider-contract', message: 'Compiled entry must export a provider factory function' }]);
      }
      const sdk: ProviderSdk = {
        packageId: discovered.manifest.id,
        packageRoot: discovered.root,
        require: localRequire,
        sharedModules: options.sharedModules,
        assetUrl: relative => {
          const asset = discovered.assets[relative];
          if (!asset) throw new Error(`Undeclared package asset: ${relative}`);
          return host.pathToFileURL(asset).href;
        },
      };
      const result = (factory as (sdk: ProviderSdk) => unknown)(sdk);
      const provider = providerShape(result, kind, expected, discovered.root, path);
      loaded.push({ entry, contribution, kind, exports: provider.exports });
    } catch (error) {
      if (error instanceof ContributionPackageError) throw error;
      const code = (error as NodeJS.ErrnoException | undefined)?.code === 'MODULE_NOT_FOUND' ? 'missing-dependency' : 'provider-load';
      throw new ContributionPackageError([{ packageRoot: discovered.root, path, code, message: `Failed to load ${entry}: ${errorMessage(error)}` }]);
    }
  }
  return loaded;
}
