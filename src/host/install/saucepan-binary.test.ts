import { describe, it, expect, vi } from 'vitest';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import * as nodeOs from 'node:os';
import {
  resolveAsset,
  resolveSaucepanBinary,
  downloadVerified,
  ensureSaucepanBinary,
  sha256Hex,
} from './saucepan-binary';

(globalThis as unknown as { window: { require: (m: string) => unknown } }).window = {
  require: (moduleName: string) => {
    if (moduleName === 'fs') return nodeFs;
    if (moduleName === 'path') return nodePath;
    if (moduleName === 'os') return nodeOs;
    throw new Error(`Unexpected module request: ${moduleName}`);
  },
};

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
const sha256 = (text: string): Promise<string> => sha256Hex(bytes(text));

describe('resolveAsset / resolveSaucepanBinary', () => {
  it('maps each supported platform/arch to a release asset', () => {
    expect(resolveAsset('win32', 'x64').name).toBe('saucepan-x86_64-pc-windows-msvc.exe');
    expect(resolveAsset('win32', 'arm64').name).toBe('saucepan-aarch64-pc-windows-msvc.exe');
    expect(resolveAsset('darwin', 'arm64').name).toBe('saucepan-universal-apple-darwin');
    expect(resolveAsset('darwin', 'x64').name).toBe('saucepan-universal-apple-darwin');
  });

  it('throws for an unsupported platform', () => {
    expect(() => resolveAsset('linux', 'x64')).toThrow(/unsupported/iu);
  });

  it('joins the asset name under a bin dir', () => {
    expect(resolveSaucepanBinary('/bin', 'win32', 'x64')).toBe(
      nodePath.join('/bin', 'saucepan-x86_64-pc-windows-msvc.exe'),
    );
  });
});

describe('downloadVerified', () => {
  it('returns the bytes when the sha256 matches', async () => {
    const expected = await sha256('payload');
    const download = vi.fn(async () => bytes('payload'));
    const result = await downloadVerified('http://x/y', expected, download);
    expect(new TextDecoder().decode(result)).toBe('payload');
  });

  it('throws on a sha256 mismatch', async () => {
    const download = vi.fn(async () => bytes('tampered'));
    await expect(downloadVerified('http://x/y', 'deadbeef', download)).rejects.toThrow(/checksum/iu);
  });
});

describe('ensureSaucepanBinary', () => {
  it('returns the cached path without downloading when present', async () => {
    const cacheDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'pe-bin-'));
    const target = resolveSaucepanBinary(cacheDir, 'win32', 'x64');
    nodeFs.writeFileSync(target, 'already-here');
    const download = vi.fn();

    const resolved = await ensureSaucepanBinary({ cacheDir, platform: 'win32', arch: 'x64', download });

    expect(resolved).toBe(target);
    expect(download).not.toHaveBeenCalled();
  });

  it('rejects on an unsupported platform', async () => {
    await expect(ensureSaucepanBinary({ platform: 'linux', arch: 'x64' })).rejects.toThrow(/unsupported/iu);
  });
});
