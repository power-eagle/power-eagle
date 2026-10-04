import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import {
  OBSOLETE_POWER_EAGLE_STORAGE_KEYS,
  POWER_EAGLE_STATE_SENTINEL,
  PowerEagleStateResetError,
  initializePowerEagleState,
} from './state-reset';

const hostRequire = createRequire(import.meta.url);
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    const temporary = resolve(tmpdir());
    const target = resolve(root);
    const rel = relative(temporary, target);
    if (!rel.startsWith('power-eagle-state-') || rel.includes(sep)) throw new Error('Unexpected cleanup directory');
    rmSync(target, { recursive: true, force: true });
  }
});

function fixture() {
  const parent = mkdtempSync(join(tmpdir(), 'power-eagle-state-'));
  roots.push(parent);
  const home = join(parent, 'home');
  const legacy = join(home, '.powereagle');
  const shared = join(home, '.saucepan');
  const external = join(parent, 'external-package');
  mkdirSync(join(legacy, 'conversations', 'old'), { recursive: true });
  mkdirSync(join(legacy, '.saucepan'), { recursive: true });
  mkdirSync(shared, { recursive: true });
  mkdirSync(external, { recursive: true });
  writeFileSync(join(legacy, 'theme.json'), '{}');
  writeFileSync(join(legacy, 'conversations', 'old', 'main.cjs'), 'legacy');
  writeFileSync(join(shared, 'index.json.enc'), 'shared');
  writeFileSync(join(external, 'manifest.json'), '{"external":true}');
  return { home, legacy, shared, external };
}

class MemoryStorage {
  readonly values = new Map<string, string>();
  removeItem(key: string): void { this.values.delete(key); }
}

describe('legacy Power Eagle state reset', () => {
  it('removes all owned legacy data while preserving shared and external locations', () => {
    const item = fixture();
    const storage = new MemoryStorage();
    for (const key of OBSOLETE_POWER_EAGLE_STORAGE_KEYS) storage.values.set(key, 'legacy');
    storage.values.set('unrelated', 'keep');

    const result = initializePowerEagleState({ homeDirectory: item.home, browserStorage: storage, hostRequire });

    expect(result.status).toBe('reset');
    expect(existsSync(join(item.legacy, 'theme.json'))).toBe(false);
    expect(existsSync(join(item.legacy, 'conversations'))).toBe(false);
    expect(JSON.parse(readFileSync(result.sentinelPath, 'utf8'))).toEqual({ format: 'power-eagle/state', formatVersion: 1 });
    expect(readFileSync(join(item.shared, 'index.json.enc'), 'utf8')).toBe('shared');
    expect(readFileSync(join(item.external, 'manifest.json'), 'utf8')).toBe('{"external":true}');
    expect([...storage.values]).toEqual([['unrelated', 'keep']]);
  });

  it('keeps new-format data after the sentinel exists', () => {
    const item = fixture();
    const first = initializePowerEagleState({ homeDirectory: item.home, hostRequire });
    writeFileSync(join(first.root, 'new-data.json'), '{"keep":true}');

    const second = initializePowerEagleState({ homeDirectory: item.home, hostRequire });

    expect(second.status).toBe('retained');
    expect(readFileSync(join(first.root, 'new-data.json'), 'utf8')).toBe('{"keep":true}');
  });

  it('initializes an empty state root when no legacy data exists', () => {
    const parent = mkdtempSync(join(tmpdir(), 'power-eagle-state-'));
    roots.push(parent);
    const home = join(parent, 'home');
    mkdirSync(home, { recursive: true });

    const result = initializePowerEagleState({ homeDirectory: home, hostRequire });

    expect(result.status).toBe('initialized');
    expect(existsSync(join(result.root, POWER_EAGLE_STATE_SENTINEL))).toBe(true);
  });

  it('rejects unexpected roots and corrupt sentinels without deleting their contents', () => {
    const item = fixture();
    expect(() => initializePowerEagleState({ homeDirectory: item.home, legacyRoot: item.shared, hostRequire }))
      .toThrow(PowerEagleStateResetError);
    expect(readFileSync(join(item.shared, 'index.json.enc'), 'utf8')).toBe('shared');

    writeFileSync(join(item.legacy, POWER_EAGLE_STATE_SENTINEL), '{"format":"unknown"}');
    expect(() => initializePowerEagleState({ homeDirectory: item.home, hostRequire }))
      .toThrow(/unsupported format/);
    expect(readFileSync(join(item.legacy, 'theme.json'), 'utf8')).toBe('{}');
  });
});
