import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('workbench layout contract', () => {
  it('uses the Eagle window dimensions, scaffold panel tokens, local fonts, and contained scrolling', () => {
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf8')) as { main: { width: number; height: number } };
    const tokens = readFileSync('src/components/ui/tokens.css', 'utf8');
    const components = readFileSync('src/components/ui/components.css', 'utf8');
    const root = readFileSync('src/index.css', 'utf8');

    expect(manifest.main).toMatchObject({ width: 910, height: 750 });
    expect(tokens).toContain('--panel-source: 208px');
    expect(tokens).toContain('--panel-agent: 272px');
    expect(components).toContain('grid-template-columns: var(--panel-source) minmax(220px, 1fr) var(--panel-agent)');
    expect(components).toContain('.pe-panel-body { flex: 1; min-height: 0; overflow: auto; }');
    expect(root).toContain('html, body, #root { width: 100%; height: 100%; min-height: 0; overflow: hidden; }');
    expect(readFileSync('src/main.tsx', 'utf8')).toContain("@fontsource/ibm-plex-sans/latin-400.css");
  });
});
