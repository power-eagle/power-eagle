import { describe, it, expect } from 'vitest';
import { eagleSurface, webApiSurface } from './platform-surface';

describe('eagleSurface', () => {
  it('embeds the eagle global type surface from eagle.d.ts', () => {
    expect(eagleSurface).toContain('EagleIconColor'); // a token unique to eagle.d.ts
    expect(eagleSurface).toMatch(/`eagle`[^\n]*global/iu);
  });
});

describe('webApiSurface', () => {
  it('describes the Eagle web API surface', () => {
    expect(webApiSurface).toContain('41595');
    expect(webApiSurface).toContain('library.switch');
  });
});
