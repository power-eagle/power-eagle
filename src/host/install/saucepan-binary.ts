/**
 * Provision the saucepan binary on first use: resolve the right release asset
 * for the current platform, download it, verify its pinned sha256, and cache it
 * under the user dir. No binary is committed to the repo — it is pulled and
 * checksum-verified on initialization, then reused from the cache.
 */
import { joinPath, homeDir, pathExists, ensureDir, writeBytes, makeExecutable } from './fs-bridge';

/** One pinned release asset: its filename and expected sha256. */
export interface ReleaseAsset {
  name: string;
  sha256: string;
}

const RELEASE = 'v0.1.1';
const RELEASE_BASE = `https://github.com/ZackaryW/saucepan/releases/download/${RELEASE}`;

/** Pinned assets per platform/arch (sha256 verified against the v0.1.1 release). */
const ASSETS: Record<string, ReleaseAsset> = {
  'win32:x64': {
    name: 'saucepan-x86_64-pc-windows-msvc.exe',
    sha256: 'b8fe2ca3cd037026d75a9b4014646be8baf0cb5b91825f4698a1830144bb3e80',
  },
  'win32:arm64': {
    name: 'saucepan-aarch64-pc-windows-msvc.exe',
    sha256: 'acf50f6b5a96679db54ac0e7493353ef447878826d561e686f5d8cfb7399daa0',
  },
  'darwin:x64': {
    name: 'saucepan-universal-apple-darwin',
    sha256: 'c09aa69b3522f46c34d8081259d6ab56dc381631df38d689c8c7ec4cda8ab9e1',
  },
  'darwin:arm64': {
    name: 'saucepan-universal-apple-darwin',
    sha256: 'c09aa69b3522f46c34d8081259d6ab56dc381631df38d689c8c7ec4cda8ab9e1',
  },
};

/** Fetches a url and returns its bytes (injected in tests). */
export type Downloader = (url: string) => Promise<Uint8Array>;

/** Resolve the pinned release asset for one platform/arch, or throw. */
export function resolveAsset(
  platform: string = process.platform,
  arch: string = process.arch,
): ReleaseAsset {
  const asset = ASSETS[`${platform}:${arch}`];
  if (!asset) {
    throw new Error(`unsupported platform for saucepan: ${platform}/${arch}`);
  }
  return asset;
}

/** The cache path of the saucepan binary for one platform/arch under binDir. */
export function resolveSaucepanBinary(
  binDir: string,
  platform: string = process.platform,
  arch: string = process.arch,
): string {
  return joinPath(binDir, resolveAsset(platform, arch).name);
}

/** Lowercase hex sha256 of some bytes (Web Crypto — no native dependency). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Default downloader using the global fetch (renderer + Node 18+). */
async function defaultDownload(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`download failed (${response.status}) for ${url}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

/** Download a url and return its bytes only if the sha256 matches; else throw. */
export async function downloadVerified(
  url: string,
  expectedSha256: string,
  download: Downloader = defaultDownload,
): Promise<Uint8Array> {
  const bytes = await download(url);
  const digest = await sha256Hex(bytes);
  if (digest !== expectedSha256) {
    throw new Error(`saucepan binary checksum mismatch: expected ${expectedSha256}, got ${digest}`);
  }
  return bytes;
}

/** How to provision the binary: cache dir, platform/arch, and a downloader. */
export interface EnsureBinaryOptions {
  cacheDir?: string;
  platform?: string;
  arch?: string;
  download?: Downloader;
}

/** Ensure the saucepan binary is cached locally, downloading + verifying once. */
export async function ensureSaucepanBinary(options: EnsureBinaryOptions = {}): Promise<string> {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const asset = resolveAsset(platform, arch);
  const cacheDir = options.cacheDir ?? joinPath(homeDir(), '.powereagle', 'bin');
  const target = joinPath(cacheDir, asset.name);

  if (pathExists(target)) {
    return target;
  }

  const bytes = await downloadVerified(`${RELEASE_BASE}/${asset.name}`, asset.sha256, options.download);
  ensureDir(cacheDir);
  writeBytes(target, bytes);
  makeExecutable(target);
  return target;
}
