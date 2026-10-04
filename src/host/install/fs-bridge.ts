import { resolveHostRequire } from './runtime-modules';

export interface HostFilesystem {
  join(...parts: string[]): string;
  resolve(...parts: string[]): string;
  dirname(path: string): string;
  basename(path: string): string;
  samePath(left: string, right: string): boolean;
  home(): string;
  exists(path: string): boolean;
  kind(path: string): 'directory' | 'symbolic-link' | 'other' | undefined;
  ensureDirectory(path: string): void;
  removeTree(path: string): void;
  readBytes(path: string): Uint8Array;
  readText(path: string): string;
  writeBytes(path: string, bytes: Uint8Array): void;
  writeText(path: string, contents: string): void;
  makeExecutable(path: string): void;
}

/** Filesystem primitives resolved through Eagle's runtime module bridge. */
export function createHostFilesystem(injected?: NodeRequire): HostFilesystem {
  const require = resolveHostRequire(injected);
  const fs = require('fs') as typeof import('node:fs');
  const path = require('path') as typeof import('node:path');
  const os = require('os') as typeof import('node:os');
  const process = require('process') as NodeJS.Process;
  const comparable = (value: string) => {
    const resolved = path.resolve(value);
    return process.platform === 'win32' ? resolved.toLocaleLowerCase('en-US') : resolved;
  };
  return {
    join: (...parts) => path.join(...parts),
    resolve: (...parts) => path.resolve(...parts),
    dirname: target => path.dirname(target),
    basename: target => path.basename(target),
    samePath: (left, right) => comparable(left) === comparable(right),
    home: () => os.homedir(),
    exists: target => fs.existsSync(target),
    kind: target => {
      if (!fs.existsSync(target)) return undefined;
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) return 'symbolic-link';
      return stat.isDirectory() ? 'directory' : 'other';
    },
    ensureDirectory: target => fs.mkdirSync(target, { recursive: true }),
    removeTree: target => fs.rmSync(target, { recursive: true, force: true }),
    readBytes: target => new Uint8Array(fs.readFileSync(target)),
    readText: target => fs.readFileSync(target, 'utf8'),
    writeBytes: (target, bytes) => fs.writeFileSync(target, bytes),
    writeText: (target, contents) => fs.writeFileSync(target, contents),
    makeExecutable: target => {
      try { fs.chmodSync(target, 0o755); } catch { /* Windows does not require an executable mode bit. */ }
    },
  };
}
