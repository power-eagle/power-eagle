import { describe, it, expect } from 'vitest';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import * as nodeOs from 'node:os';
import { generatePlugin } from './generate';
import { listAttempts } from './aidriven-store';
import type { HostContext } from '../app/host-service';
import type { AiModule } from './ai-bridge';

(globalThis as unknown as { window: { require: (m: string) => unknown } }).window = {
  require: (moduleName: string) => {
    if (moduleName === 'fs') return nodeFs;
    if (moduleName === 'path') return nodePath;
    if (moduleName === 'os') return nodeOs;
    throw new Error(`Unexpected module request: ${moduleName}`);
  },
};

const context = { services: {}, widgets: {}, theme: {}, contributions: {} } as unknown as HostContext;
const freshHome = (): string => nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'pe-gen-'));
const fakeAi = (text: string): AiModule => ({
  getDefaultModel: () => 'm',
  getModel: (id) => id,
  generateText: async () => ({ text }),
});

/** A fake ai that captures the prompt it was asked to generate from. */
function capturingAi(): AiModule & { lastPrompt: string } {
  const ai = {
    lastPrompt: '',
    getDefaultModel: () => 'm',
    getModel: (id: string) => id,
    generateText: async ({ prompt }: { prompt: string }) => {
      ai.lastPrompt = prompt;
      return { text: 'export default {}' };
    },
  };
  return ai;
}

describe('generatePlugin', () => {
  it('generates, writes, loads, renders-ready and records a successful attempt', async () => {
    const home = freshHome();
    const result = await generatePlugin('make notes', {
      ai: fakeAi('export default {}'),
      home,
      context,
      newId: () => 'gen-1',
      importModule: async () => ({ default: { manifest: { id: 'gen-1', name: 'Notes', version: '1.0.0' } } }),
    });

    expect(result.attempt.status).toBe('ok');
    expect(result.module?.manifest.id).toBe('gen-1');
    expect(nodeFs.existsSync(nodePath.join(home, 'aidriven', 'gen-1', 'index.mjs'))).toBe(true);
    expect(listAttempts(home).find((a) => a.id === 'gen-1')?.status).toBe('ok');
  });

  it('forwards promptOptions so opted-out surfaces are excluded from the prompt', async () => {
    const ai = capturingAi();
    await generatePlugin('x', {
      ai,
      home: freshHome(),
      context,
      newId: () => 'gen-opts',
      importModule: async () => ({ default: { manifest: { id: 'gen-opts', name: 'O', version: '1' } } }),
      promptOptions: { includeEagle: false, includeWebApi: false },
    });

    expect(ai.lastPrompt).not.toContain('EagleIconColor');
    expect(ai.lastPrompt).not.toContain('41595');
  });

  it('records a failed attempt (no module) when the generated module does not load', async () => {
    const home = freshHome();
    const result = await generatePlugin('broken', {
      ai: fakeAi('not a module'),
      home,
      context,
      newId: () => 'gen-2',
      importModule: async () => ({ default: { nope: true } }),
    });

    expect(result.attempt.status).toBe('failed');
    expect(result.attempt.error).toBeTruthy();
    expect(result.module).toBeUndefined();
    expect(listAttempts(home).find((a) => a.id === 'gen-2')?.status).toBe('failed');
  });
});
