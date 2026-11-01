import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, posix, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { zipSync, unzipSync } from 'fflate';

const hash = value => createHash('sha256').update(value).digest('hex');
const allowed = name => ['manifest.json', 'logo.png'].includes(name) || /^(dist|_locales)\//.test(name);
const safe = name => typeof name === 'string' && name.length > 0 && !name.startsWith('/') && !/[\\:\0]/.test(name) && !name.split('/').some(part => ['.', '..', ''].includes(part));

export function validateRelease(files) {
  const names = Object.keys(files);
  for (const name of names) {
    if (!safe(name) || !allowed(name) || /(^|\/)(node_modules|src|\.git|\.env)(\/|$)|\.(tsx?|map)$/.test(name)) throw Error(`Unexpected release path: ${name}`);
  }
  const need = name => { if (!safe(name) || !files[name]) throw Error(`Missing or unsafe release asset: ${name}`); return files[name]; };
  const json = name => JSON.parse(Buffer.from(need(name)).toString('utf8'));
  const manifest = json('manifest.json');
  if (manifest.main?.url !== 'dist/index.html' || !/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][\w.-]+)?$/.test(manifest.version)) throw Error('Invalid Eagle entry or release version');
  need(String(manifest.logo).replace(/^\//, ''));
  if (!Array.isArray(manifest.languages) || !manifest.languages.includes(manifest.fallbackLanguage)) throw Error('Invalid locale declarations');
  for (const language of manifest.languages) {
    if (!/^[a-zA-Z0-9_-]+$/.test(language) || !json(`_locales/${language}.json`).manifest?.app?.name) throw Error('Invalid packaged locale');
  }
  const html = Buffer.from(need(manifest.main.url)).toString('utf8');
  const entryAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
  for (const asset of entryAssets) {
    if (/^(?:[a-z]+:|\/\/)/i.test(asset)) throw Error(`Remote entry asset: ${asset}`);
    need(posix.normalize(posix.join('dist', asset)));
  }
  const linkedJs = entryAssets.filter(name => name.endsWith('.js')).map(name => posix.normalize(posix.join('dist', name)));
  const bundledJs = names.filter(name => /^dist\/assets\/.*\.js$/.test(name));
  if (linkedJs.length !== 1 || bundledJs.length !== 1 || linkedJs[0] !== bundledJs[0]) throw Error('Unexpected or stale application bundle');
  for (const name of names.filter(name => name.endsWith('.css'))) {
    const css = Buffer.from(files[name]).toString('utf8');
    for (const match of css.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)) {
      if (match[1].startsWith('data:')) continue;
      if (/^(?:[a-z]+:|\/\/)/i.test(match[1])) throw Error(`Remote stylesheet asset: ${match[1]}`);
      need(posix.normalize(posix.join(posix.dirname(name), match[1])));
    }
  }
  need('dist/saucepan-host.cjs');
  for (const family of ['ibm-plex-mono', 'ibm-plex-sans']) {
    need(`dist/licenses/${family}.txt`);
    if (!names.some(name => name.startsWith(`dist/assets/${family}`) && /\.woff2?$/.test(name))) throw Error(`Missing font: ${family}`);
  }
  for (const asset of ['preview.svg', 'gallery.svg', 'example-audio.wav', 'example-video.mp4']) need(`dist/assets/${asset}`);
  for (const id of json('dist/builtins/index.json')) {
    if (!safe(id) || id.includes('/')) throw Error(`Invalid built-in identity: ${id}`);
    const base = `dist/builtins/${id}`;
    const builtin = json(`${base}/manifest.json`);
    if (builtin.id !== id) throw Error(`Built-in identity mismatch: ${id}`);
    for (const entry of [...Object.values(builtin.contributions), ...builtin.assets]) {
      if (!safe(entry)) throw Error(`Unsafe built-in asset: ${entry}`);
      need(`${base}/${entry}`);
    }
  }
  return manifest;
}

export async function assembleRelease(source = resolve('.'), output = resolve('.artifacts/releases')) {
  const files = {};
  async function collect(relative) {
    const location = join(source, relative);
    const info = await lstat(location);
    if (info.isSymbolicLink()) throw Error(`Release symlink is not allowed: ${relative}`);
    if (info.isDirectory()) {
      for (const name of (await readdir(location)).sort()) await collect(`${relative}/${name}`);
    } else if (info.isFile()) files[relative] = await readFile(location);
    else throw Error(`Unsupported release entry: ${relative}`);
  }
  for (const name of ['manifest.json', 'logo.png', '_locales', 'dist']) await collect(name);
  const manifest = validateRelease(files);
  const zipInput = Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, [bytes, { mtime: new Date(1980, 0, 1), os: 0 }]]));
  const archive = zipSync(zipInput, { level: 9 });
  const unpacked = unzipSync(archive);
  validateRelease(unpacked);
  for (const [name, bytes] of Object.entries(files)) if (hash(bytes) !== hash(unpacked[name])) throw Error(`Archive content changed: ${name}`);
  const extracted = await mkdtemp(join(tmpdir(), 'power-eagle-release-'));
  for (const [name, bytes] of Object.entries(unpacked)) {
    const target = join(extracted, name);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  await mkdir(output, { recursive: true });
  const archivePath = join(output, `power-eagle-${manifest.version}.eagleplugin`);
  const report = { archive: archivePath, sha256: hash(archive), bytes: archive.length, extracted,
    files: Object.entries(files).map(([name, bytes]) => ({ name, bytes: bytes.length, sha256: hash(bytes) })),
    verification: 'Allowlist, local references, archive round-trip and external extraction passed; Eagle installation is a separate live gate.' };
  await writeFile(archivePath, archive);
  await writeFile(`${archivePath}.json`, JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await assembleRelease();
  console.log(JSON.stringify({ ...report, files: report.files.length }, null, 2));
}
