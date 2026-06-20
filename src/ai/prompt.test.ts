import { describe, it, expect } from 'vitest';
import { buildGenerationPrompt } from './prompt';
import type { HostContext } from '../app/host-service';

const context = {
  services: {},
  widgets: {},
  theme: {},
  contributions: {
    clipboard: { services: { methods: ['copy', 'read'], vars: ['name'] } },
    neon: { widgets: ['badge'], theme: true },
  },
} as unknown as HostContext;

describe('buildGenerationPrompt', () => {
  it('includes the user instruction verbatim', () => {
    expect(buildGenerationPrompt('make a notes plugin', context)).toContain('make a notes plugin');
  });

  it('lists available services with their methods and vars', () => {
    const prompt = buildGenerationPrompt('x', context);
    expect(prompt).toContain('clipboard');
    expect(prompt).toContain('copy, read');
    expect(prompt).toContain('name');
  });

  it('lists available styling widget types and theme availability', () => {
    const prompt = buildGenerationPrompt('x', context);
    expect(prompt).toContain('neon');
    expect(prompt).toContain('badge');
  });

  it('instructs the model to default-export a definePlugin ESM module', () => {
    const prompt = buildGenerationPrompt('x', context);
    expect(prompt).toContain('definePlugin');
    expect(prompt).toContain('export default');
  });

  it('does not invent a services section when none are registered', () => {
    const bare = { services: {}, widgets: {}, theme: {}, contributions: {} } as unknown as HostContext;
    expect(buildGenerationPrompt('x', bare)).not.toContain('Available services');
  });

  it('includes a complete self-contained sample plugin source to mimic', () => {
    const prompt = buildGenerationPrompt('x', context);
    expect(prompt).toContain('const definePlugin');
    expect(prompt).toContain('const w =');
    expect(prompt).toMatch(/view:\s*\(s, rt\)/u);
    expect(prompt).toContain('export default definePlugin');
  });

  it('states the module must be self-contained with no imports', () => {
    expect(buildGenerationPrompt('x', context)).toMatch(/no imports|self-contained/iu);
  });

  it('embeds both platform surfaces by default', () => {
    const prompt = buildGenerationPrompt('x', context);
    expect(prompt).toContain('EagleIconColor');
    expect(prompt).toContain('41595');
  });

  it('omits the eagle surface when includeEagle is false', () => {
    const prompt = buildGenerationPrompt('x', context, { includeEagle: false });
    expect(prompt).not.toContain('EagleIconColor');
    expect(prompt).toContain('41595');
  });

  it('omits the web api surface when includeWebApi is false', () => {
    const prompt = buildGenerationPrompt('x', context, { includeWebApi: false });
    expect(prompt).not.toContain('41595');
    expect(prompt).toContain('EagleIconColor');
  });

  it('documents the widget types and runtime methods a plugin uses', () => {
    const prompt = buildGenerationPrompt('x', context);
    for (const token of ["w('col'", "w('text'", "w('input'", "w('button'", "w('list'", 'rt.set', 'rt.run', 'rt.service']) {
      expect(prompt).toContain(token);
    }
  });
});
