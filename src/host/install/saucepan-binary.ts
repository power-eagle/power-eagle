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

const RELEASE = 'v0.1.2';
const RELEASE_BASE = `https://github.com/ZackaryW/saucepan/releases/download/${RELEASE}`;

/** Pinned assets per platform/arch (sha256 verified against the v0.1.2 release). */
const ASSETS: Record<string, ReleaseAsset> = {
  'win32:x64': {
    name: 'saucepan-x86_64-pc-windows-msvc.exe',
    sha256: 'd8647299dd8ad691485ec4e01b3b14cfe736d8de38f731eb3dad72e33c03f320',
  },
  'win32:arm64': {
    name: 'saucepan-aarch64-pc-windows-msvc.exe',
    sha256: '323c72dd2bb6174d3a2fd5326afa3abd80fdeeb7a6ae46e581eb0345d58a5868',
  },
  'darwin:x64': {
    name: 'saucepan-universal-apple-darwin',
    sha256: 'eafa42d45f8c252aac07a444e07281a82d776aaaf74e9661ba9adadf5e722bb6',
  },
  'darwin:arm64': {
    name: 'saucepan-universal-apple-darwin',
    sha256: 'eafa42d45f8c252aac07a444e07281a82d776aaaf74e9661ba9adadf5e722bb6',
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
