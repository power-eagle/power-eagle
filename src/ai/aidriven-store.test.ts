import { describe, it, expect } from 'vitest';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import * as nodeOs from 'node:os';
import { aidrivenDir, writeGeneratedPlugin, recordAttempt, listAttempts } from './aidriven-store';

// fs-bridge reaches the filesystem through the Eagle renderer's window.require bridge.
(globalThis as unknown as { window: { require: (m: string) => unknown } }).window = {
  require: (moduleName: string) => {
    if (moduleName === 'fs') return nodeFs;
    if (moduleName === 'path') return nodePath;
    if (moduleName === 'os') return nodeOs;
    throw new Error(`Unexpected module request: ${moduleName}`);
  },
};

function freshHome(): string {
  return nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'pe-ai-'));
}

describe('aidrivenDir', () => {
  it('is the aidriven subfolder of the powereagle home', () => {
    expect(aidrivenDir('/home/.powereagle')).toBe(nodePath.join('/home/.powereagle', 'aidriven'));
  });
});

describe('writeGeneratedPlugin', () => {
  it('writes a manifest.json (main -> index.mjs) and the source as index.mjs', () => {
    const home = freshHome();
    const dir = writeGeneratedPlugin(home, { id: 'gen-1', name: 'Gen One', source: 'export default 1' });

    expect(dir).toBe(nodePath.join(home, 'aidriven', 'gen-1'));
    const manifest = JSON.parse(nodeFs.readFileSync(nodePath.join(dir, 'manifest.json'), 'utf8'));
    expect(manifest).toMatchObject({ id: 'gen-1', name: 'Gen One', main: 'index.mjs' });
    expect(nodeFs.readFileSync(nodePath.join(dir, 'index.mjs'), 'utf8')).toBe('export default 1');
  });
});

describe('attempt history', () => {
  it('records attempts and lists them back, replacing by id', () => {
    const home = freshHome();
    recordAttempt(home, { id: 'a', prompt: 'p1', name: 'A', status: 'ok' });
    recordAttempt(home, { id: 'b', prompt: 'p2', name: 'B', status: 'failed', error: 'bad' });
    recordAttempt(home, { id: 'a', prompt: 'p1b', name: 'A2', status: 'ok' });

    const attempts = listAttempts(home);
    expect(attempts.map((a) => a.id)).toEqual(['b', 'a']);
    expect(attempts.find((a) => a.id === 'a')?.prompt).toBe('p1b');
    expect(attempts.find((a) => a.id === 'b')?.status).toBe('failed');
  });

  it('returns an empty list when nothing has been recorded', () => {
    expect(listAttempts(freshHome())).toEqual([]);
  });
});
