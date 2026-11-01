import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const npm = process.env.npm_execpath;
if (!npm) throw Error('Run with npm run release:clean');
const source = resolve('.');
const root = await mkdtemp(join(tmpdir(), 'power-eagle-clean-release-'));
const env = { ...process.env }; delete env.NODE_PATH;
const report = { source, root, node: process.version, inventory: [], checks: [] };
const listing = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: source, encoding: 'utf8', windowsHide: true });
if (listing.status !== 0) throw Error('Could not inventory the working tree');
for (const name of [...new Set(listing.stdout.split('\0'))].filter(Boolean).sort()) {
  if (/^(\.git|\.zmem|\.artifacts|node_modules)(\/|$)/.test(name)) continue;
  if (name.startsWith('/') || name.includes('\\') || name.split('/').some(part => part === '..')) throw Error(`Unsafe inventory path: ${name}`);
  const from = join(source, name);
  let info;
  try { info = await lstat(from); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  if (!info.isFile() || info.isSymbolicLink()) throw Error(`Non-file inventory entry: ${name}`);
  const to = join(root, name); await mkdir(dirname(to), { recursive: true }); await copyFile(from, to);
  report.inventory.push({ name, sha256: createHash('sha256').update(await readFile(to)).digest('hex') });
}
console.log(`Clean copy: ${root} (${report.inventory.length} files; independent node_modules)`);
try {
  const commands = [
    ['ci', '--no-audit', '--no-fund'],
    ['run', 'release:build'],
    ['run', 'release:test'],
    ['run', 'packages:test'],
    ['test', '--', '--reporter=dot'],
    ['run', 'typecheck'],
    ['run', 'lint'],
  ];
  for (const [index, args] of commands.entries()) {
    console.log(`Checking: npm ${args.join(' ')}`);
    const started = Date.now();
    const result = spawnSync(process.execPath, [npm, ...args], { cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 240_000 });
    const log = join(root, `verification-${index + 1}.log`);
    await writeFile(log, `${result.stdout ?? ''}\n${result.stderr ?? ''}`);
    report.checks.push({ executable: process.execPath, args: [npm, ...args], cwd: root, exitCode: result.status, durationMs: Date.now() - started, log });
    if (result.error || result.status !== 0) throw Error(`Failed npm ${args.join(' ')}: ${result.error ?? ''}\n${result.stderr}\n${result.stdout.slice(-3000)}`);
    console.log(`Passed: npm ${args.join(' ')}`);
  }
} finally {
  await mkdir(resolve('.artifacts/releases'), { recursive: true });
  await writeFile(resolve('.artifacts/releases/clean-verification.json'), JSON.stringify(report, null, 2));
  console.log(`Clean verification report: ${resolve('.artifacts/releases/clean-verification.json')}`);
}
