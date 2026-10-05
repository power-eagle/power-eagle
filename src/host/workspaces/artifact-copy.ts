import { discoverContributionPackage, type DiscoveredPackage } from '../install/contribution-package';

export interface CopyOptions {
  signal?: AbortSignal;
  progress?: (files: number, bytes: number) => void;
  maxFiles?: number;
  maxBytes?: number;
}

/** Copy artifact bytes only. Host conversation/state records live outside artifact roots. */
export async function snapshotArtifact(source: string, destination: string, ownedRoot: string, hostRequire: NodeRequire, options: CopyOptions = {}): Promise<DiscoveredPackage> {
  const fs = hostRequire('node:fs') as typeof import('node:fs');
  const path = hostRequire('node:path') as typeof import('node:path');
  const root = fs.realpathSync(ownedRoot);
  const sourceRoot = fs.realpathSync(source);
  const output = path.resolve(destination);
  const inside = (base: string, file: string) => {
    const rel = path.relative(base, file);
    return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
  };
  if (!inside(root, output) || output === sourceRoot || inside(sourceRoot, output) || inside(output, sourceRoot)) throw new Error('Snapshot destination must be an independent path beneath the owned workspace root');
  if (fs.existsSync(output)) throw new Error('Snapshot destination already exists');
  let parent = path.dirname(output);
  while (!fs.existsSync(parent)) parent = path.dirname(parent);
  const canonicalParent = fs.realpathSync(parent);
  if (canonicalParent !== root && !inside(root, canonicalParent)) throw new Error('Snapshot parent escapes the owned workspace root');
  discoverContributionPackage(sourceRoot, hostRequire);
  options.signal?.throwIfAborted();
  fs.mkdirSync(output, { recursive: true });
  let files = 0;
  let bytes = 0;
  const visit = async (from: string, to: string, depth: number): Promise<void> => {
    options.signal?.throwIfAborted();
    if (depth > 128) throw new Error('Artifact directory depth exceeds 128');
    const stat = fs.lstatSync(from);
    // Reject all links, including Windows junctions; do not copy through their targets.
    if (stat.isSymbolicLink()) throw new Error(`Artifact contains a linked path: ${path.relative(sourceRoot, from)}`);
    if (stat.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      for (const name of fs.readdirSync(from)) {
        if (name === '.git' || name === '.power-eagle-workspace') continue;
        await visit(path.join(from, name), path.join(to, name), depth + 1);
      }
    } else if (stat.isFile()) {
      files += 1; bytes += stat.size;
      if (files > (options.maxFiles ?? 100000) || bytes > (options.maxBytes ?? 1024 ** 3)) throw new Error('Artifact exceeds snapshot size limits');
      fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
      options.progress?.(files, bytes);
      // Yield so a user cancellation is observed during large node_modules copies.
      if (files % 32 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
    } else throw new Error(`Unsupported artifact file: ${from}`);
  };
  try {
    await visit(sourceRoot, output, 0);
    options.signal?.throwIfAborted();
    return discoverContributionPackage(output, hostRequire);
  } catch (error) {
    // output was verified above, created exclusively by this operation, and contains no links.
    fs.rmSync(output, { recursive: true, force: true });
    throw error;
  }
}
