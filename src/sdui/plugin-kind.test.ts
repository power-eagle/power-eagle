import { describe, it, expect } from 'vitest';
import { definePlugin, activatePlugin, pluginKind } from './activate';
import { w } from './widget';
import type { Theme } from './types';

const aTheme: Theme = { tokens: {}, widgets: { button: { base: { background: '#123456' } } } };

describe('pluginKind', () => {
  it('classifies visual, service, and styling plugins by manifest flags', () => {
    expect(pluginKind({ service: false, styling: false })).toBe('visual');
    expect(pluginKind({ service: true })).toBe('service');
    expect(pluginKind({ styling: true })).toBe('styling');
  });

  it('rejects a plugin that is both a service and a styling plugin (XOR)', () => {
    expect(() => pluginKind({ service: true, styling: true })).toThrow(/both/iu);
  });
});

describe('styling plugins', () => {
  it('contributes a theme and has no view when manifest.styling is set', async () => {
    const stylePack = definePlugin({
      manifest: { id: 'midnight', name: 'Midnight', version: '1.0.0', styling: true },
      theme: aTheme,
    });
    const app = await activatePlugin(stylePack);
    expect(app.manifest.styling).toBe(true);
    expect(app.theme).toEqual(aTheme);
    expect(app.view).toBeUndefined();
    expect(app.provides).toBeUndefined();
  });
});

describe('plugin kind validation (XOR + invariants)', () => {
  it('rejects a styling plugin with a view or a service surface', () => {
    expect(() => definePlugin({ manifest: { id: 's', name: 'S', version: '1', styling: true }, theme: aTheme, view: () => w('text', { data: 'x' }) })).toThrow(/view/iu);
    expect(() => definePlugin({ manifest: { id: 's', name: 'S', version: '1', styling: true }, theme: aTheme, provides: () => ({}) })).toThrow(/service|provide/iu);
  });

  it('rejects a styling plugin without a theme', () => {
    expect(() => definePlugin({ manifest: { id: 's', name: 'S', version: '1', styling: true } })).toThrow(/theme/iu);
  });

  it('rejects a service plugin with a view or a theme', () => {
    expect(() => definePlugin({ manifest: { id: 'v', name: 'V', version: '1', service: true }, provides: () => ({}), view: () => w('text', { data: 'x' }) })).toThrow(/view/iu);
    expect(() => definePlugin({ manifest: { id: 'v', name: 'V', version: '1', service: true }, provides: () => ({}), theme: aTheme })).toThrow(/styling|theme/iu);
  });

  it('rejects a visual plugin without a view, or one that provides a service surface', () => {
    expect(() => definePlugin({ manifest: { id: 'x', name: 'X', version: '1' }, state: () => ({}) })).toThrow(/view/iu);
    expect(() => definePlugin({ manifest: { id: 'x', name: 'X', version: '1' }, view: () => w('text', { data: 'x' }), provides: () => ({}) })).toThrow(/service|provide/iu);
  });
});
