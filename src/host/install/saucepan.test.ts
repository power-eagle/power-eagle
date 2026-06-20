import { describe, it, expect, vi } from 'vitest';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import * as nodeOs from 'node:os';
import * as nodeCp from 'node:child_process';
import { isSaucepanAvailable, ensureRoot, listInstalled, addBucket, listBuckets, installedPath } from './saucepan';

// The adapter reaches fs and the saucepan binary through the Eagle renderer's
// window.require bridge; under the node test runner we back it with the real
// modules (matches src/tests/install-store.test.ts).
(globalThis as unknown as { window: { require: (m: string) => unknown } }).window = {
  require: (moduleName: string) => {
    if (moduleName === 'fs') return nodeFs;
    if (moduleName === 'path') return nodePath;
    if (moduleName === 'os') return nodeOs;
    if (moduleName === 'child_process') return nodeCp;
    throw new Error(`Unexpected module request: ${moduleName}`);
  },
};

function freshRoot(): string {
  return nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'pe-sauce-'));
}

// Real-binary integration runs against the binary named by POWEREAGLE_SAUCEPAN_BIN
// (the local build during development); skipped when unset so the committed
// suite stays green without a saucepan binary present.
const BIN = process.env.POWEREAGLE_SAUCEPAN_BIN;
const realBinaryAvailable = Boolean(BIN) && isSaucepanAvailable({ binaryPath: BIN });

describe('saucepan adapter availability', () => {
  it('reports unavailable when the binary cannot be spawned', () => {
    expect(isSaucepanAvailable({ binaryPath: 'no-such-saucepan-binary-xyz' })).toBe(false);
  });
});

describe('installedPath', () => {
  it('shells `path <name>` against the root and returns the artifact path', () => {
    const root = freshRoot();
    let calledArgs: string[] | undefined;
    const runner = vi.fn((_bin: string, args: string[]) => {
      calledArgs = args;
      return { ok: true, exitCode: 0, stdout: `${root}/github/owner--repo\n`, stderr: '' };
    });

    expect(installedPath({ root, runner }, 'my-lib')).toBe(`${root}/github/owner--repo`);
    expect(calledArgs).toEqual([root, 'path', 'my-lib']);
  });

  it('returns undefined when the sauce is not installed (saucepan NotFound, exit 1)', () => {
    const root = freshRoot();
    const runner = vi.fn(() => ({ ok: false, exitCode: 1, stdout: '', stderr: "'x' is not installed" }));

    expect(installedPath({ root, runner }, 'x')).toBeUndefined();
  });

  it('throws on a non-NotFound saucepan failure', () => {
    const root = freshRoot();
    const runner = vi.fn(() => ({ ok: false, exitCode: 3, stdout: '', stderr: 'invalid saucepan.toml' }));

    expect(() => installedPath({ root, runner }, 'x')).toThrow(/config error/u);
  });
});

describe.skipIf(!realBinaryAvailable)('saucepan adapter against the real binary', () => {
  it('initializes a fresh root with a saucepan.toml and lists nothing', () => {
    const root = freshRoot();
    ensureRoot({ root, binaryPath: BIN });
    expect(nodeFs.existsSync(nodePath.join(root, 'saucepan.toml'))).toBe(true);
    expect(listInstalled({ root, binaryPath: BIN })).toEqual([]);
  });

  it('registers a bucket and reflects it in the bucket list', () => {
    const root = freshRoot();
    ensureRoot({ root, binaryPath: BIN });
    const bucketFile = nodePath.join(root, 'bucket.json');
    nodeFs.writeFileSync(bucketFile, '[]');

    addBucket({ root, binaryPath: BIN }, bucketFile);

    expect(listBuckets({ root, binaryPath: BIN })).toContain(bucketFile);
  });
});
