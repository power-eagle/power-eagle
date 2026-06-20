import { describe, it, expect, vi } from 'vitest';
import { createEagleHost, type EagleHostDeps } from './eagle-host';

function fakeDeps(overrides: Partial<EagleHostDeps> = {}): EagleHostDeps {
  return {
    notifySink: vi.fn(),
    switchLibrary: vi.fn(),
    readSettings: vi.fn(() => JSON.stringify({ libraryHistory: ['/a/Foo.library', '/b/Bar.library'] })),
    chooseSavePath: vi.fn(async (suggested: string) => `/picked/${suggested}`),
    writeFile: vi.fn(),
    ...overrides,
  };
}

describe('createEagleHost', () => {
  it('forwards notify and switchLibrary to the host', async () => {
    const deps = fakeDeps();
    const host = createEagleHost(deps);
    await host.notify({ title: 'Hi', body: 'there' });
    await host.switchLibrary('/x/Lib.library');
    expect(deps.notifySink).toHaveBeenCalledWith({ title: 'Hi', body: 'there' });
    expect(deps.switchLibrary).toHaveBeenCalledWith('/x/Lib.library');
  });

  it('reads recent libraries from the host settings history', async () => {
    const host = createEagleHost(fakeDeps());
    expect(await host.getRecentLibraries()).toEqual(['/a/Foo.library', '/b/Bar.library']);
  });

  it('returns an empty list when settings cannot be read', async () => {
    const host = createEagleHost(fakeDeps({ readSettings: () => { throw new Error('no file'); } }));
    expect(await host.getRecentLibraries()).toEqual([]);
  });

  it('creates a file at the chosen path and reports success', async () => {
    const deps = fakeDeps();
    const host = createEagleHost(deps);
    const ok = await host.createFile({ fileName: 'notes', extension: 'md', content: '# notes' });
    expect(ok).toBe(true);
    expect(deps.chooseSavePath).toHaveBeenCalledWith('notes.md');
    expect(deps.writeFile).toHaveBeenCalledWith('/picked/notes.md', '# notes');
  });

  it('does not write and reports failure when the save dialog is cancelled', async () => {
    const deps = fakeDeps({ chooseSavePath: vi.fn(async () => null) });
    const host = createEagleHost(deps);
    const ok = await host.createFile({ fileName: 'notes', extension: 'md', content: '# notes' });
    expect(ok).toBe(false);
    expect(deps.writeFile).not.toHaveBeenCalled();
  });
});
