import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('design-system assets', () => {
  it('uses complete color tokens and local font packages with shipped licenses', async () => {
    const [tokens, components, root, main, tailwind, sansLicense, monoLicense] = await Promise.all([
      readFile('src/components/ui/tokens.css', 'utf8'),
      readFile('src/components/ui/components.css', 'utf8'),
      readFile('src/index.css', 'utf8'),
      readFile('src/main.tsx', 'utf8'),
      readFile('tailwind.config.js', 'utf8'),
      readFile('public/licenses/ibm-plex-sans.txt', 'utf8'),
      readFile('public/licenses/ibm-plex-mono.txt', 'utf8'),
    ]);

    expect(tokens).toContain('--background: #121212');
    expect(tokens).toContain('--primary: hsl(37 91% 55%)');
    expect(tailwind).not.toContain('hsl(var(--');
    expect(tailwind).toContain('DEFAULT: "var(--primary)"');
    expect(`${tokens}\n${components}\n${root}\n${main}`).not.toMatch(/(?:@import\s+url|https?:\/\/)/);
    expect(main).toContain("@fontsource/ibm-plex-sans/latin-400.css");
    expect(main).toContain("@fontsource/ibm-plex-mono/latin-600.css");
    expect(sansLicense).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(monoLicense).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });
});
