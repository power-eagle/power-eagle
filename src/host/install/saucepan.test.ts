import { describe, it, expect } from 'vitest';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import * as nodeOs from 'node:os';
import * as nodeCp from 'node:child_process';
import { isSaucepanAvailable, ensureRoot, listInstalled, addBucket, listBuckets } from './saucepan';

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
