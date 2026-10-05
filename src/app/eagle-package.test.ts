import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface EagleManifest {
  name: string;
  logo: string;
  fallbackLanguage: string;
  languages: string[];
  main: { url: string };
}

describe('Eagle package localization contract', () => {
  it('ships every declared locale and a valid fallback application name', async () => {
    const manifest = JSON.parse(await readFile(resolve('manifest.json'), 'utf8')) as EagleManifest;
    expect(manifest.languages).toContain(manifest.fallbackLanguage);
    expect(manifest.main.url).toBe('dist/index.html');
    expect(manifest.logo).toBe('/logo.png');
    for (const language of manifest.languages) {
      const locale = JSON.parse(await readFile(resolve(`_locales/${language}.json`), 'utf8')) as { manifest?: { app?: { name?: unknown } } };
      expect(locale.manifest?.app?.name).toEqual(expect.any(String));
      expect((locale.manifest!.app!.name as string).trim()).not.toBe('');
    }
    await access(resolve(manifest.logo.slice(1)));
  });

  it('ships every local catalog media fixture', async () => {
    await Promise.all([
      'preview.svg', 'gallery.svg', 'example-audio.wav', 'example-video.mp4',
    ].map(name => access(resolve('public/assets', name))));
  });
});
