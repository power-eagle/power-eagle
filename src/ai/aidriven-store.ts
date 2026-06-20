/**
 * Persistence for AI-generated plugins under ~/.powereagle/aidriven. Each
 * generated plugin lands in its own <id>/ folder in the installed-plugin format
 * (manifest.json + index.mjs) so the existing disk loader can load it; an
 * attempts.json index records what was generated for the AI tab's history.
 */
import { joinPath, homeDir, ensureDir, writeTextFile, readTextFile, pathExists } from '../host/install/fs-bridge';

/** One recorded generation attempt shown in the AI tab history. */
export interface Attempt {
  id: string;
  prompt: string;
  name: string;
  status: 'ok' | 'failed';
  error?: string;
}

/** The powereagle home directory (~/.powereagle) — shared with the install layer. */
export function powereagleHome(): string {
  return joinPath(homeDir(), '.powereagle');
}

/** The aidriven folder under the powereagle home (defaults to ~/.powereagle). */
export function aidrivenDir(home: string = powereagleHome()): string {
  return joinPath(home, 'aidriven');
}

/** Write a generated plugin into aidriven/<id>/ in the installed-plugin format; returns its dir. */
export function writeGeneratedPlugin(home: string, plugin: { id: string; name: string; source: string }): string {
  const dir = joinPath(aidrivenDir(home), plugin.id);
  ensureDir(dir);
  const manifest = { name: plugin.name, version: '1.0.0', description: `AI-generated: ${plugin.name}`, id: plugin.id, main: 'index.mjs' };
  writeTextFile(joinPath(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeTextFile(joinPath(dir, 'index.mjs'), plugin.source);
  return dir;
}

/** Path to the attempts index file. */
function attemptsFile(home: string): string {
  return joinPath(aidrivenDir(home), 'attempts.json');
}

/** All recorded attempts (empty on any read/parse failure). */
export function listAttempts(home: string): Attempt[] {
  const file = attemptsFile(home);
  if (!pathExists(file)) return [];
  try {
    const parsed = JSON.parse(readTextFile(file)) as unknown;
    return Array.isArray(parsed) ? (parsed as Attempt[]) : [];
  } catch {
    return [];
  }
}

/** Record an attempt, replacing any prior entry with the same id (kept newest-last). */
export function recordAttempt(home: string, attempt: Attempt): void {
  const next = [...listAttempts(home).filter((entry) => entry.id !== attempt.id), attempt];
  ensureDir(aidrivenDir(home));
  writeTextFile(attemptsFile(home), JSON.stringify(next, null, 2));
}
