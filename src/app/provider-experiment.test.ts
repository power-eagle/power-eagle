import { describe, expect, it } from 'vitest';
import { win32 } from 'node:path';
import { pluginRootFromEagleUrl } from './provider-experiment-path';

describe('provider experiment path discovery', () => {
  const rootUrl = 'eagleplugin://5cef2ac5-9d8f-46cb-b0ad-0000dd99d328//C:/Users/ZackaryW/Desktop/+workplace/power-eagle-revised/dist/index.html';
  const fixtureUrl = 'eagleplugin://d7fc7c5b-36d7-4fa8-a035-a594a6e1b2d9//C:/Users/ZackaryW/Desktop/+workplace/power-eagle-revised/.artifacts/provider-host/index.html';

  it('recovers the repository root from an Eagle plugin document URL', () => {
    expect(pluginRootFromEagleUrl(rootUrl, 'repository', win32)).toBe('C:\\Users\\ZackaryW\\Desktop\\+workplace\\power-eagle-revised');
  });

  it('recovers the isolated fixture root from an Eagle plugin document URL', () => {
    expect(pluginRootFromEagleUrl(fixtureUrl, 'standalone', win32)).toBe('C:\\Users\\ZackaryW\\Desktop\\+workplace\\power-eagle-revised\\.artifacts\\provider-host');
  });

  it('does not treat ordinary web URLs as local plugin paths', () => {
    expect(pluginRootFromEagleUrl('http://localhost:5173/', 'repository', win32)).toBeUndefined();
  });
});
