import { describe, it, expect, vi } from 'vitest';
import { activatePlugin } from '../sdui/activate';
import { fileCreator, type FileCreatorState } from './file-creator';
import type { EagleHost } from './eagle';

function fakeEagle(): EagleHost & { createFile: ReturnType<typeof vi.fn>; notify: ReturnType<typeof vi.fn> } {
  return {
    createFile: vi.fn(async () => true),
    notify: vi.fn(async () => {}),
    getRecentLibraries: async () => [],
    switchLibrary: async () => {},
  };
}

async function mount(eagle: EagleHost) {
  return activatePlugin(fileCreator, eagle as unknown as Record<string, unknown>);
}

describe('file-creator actions', () => {
  it('createFile builds json/md/fallback content per extension', async () => {
    const eagle = fakeEagle();
    const app = await mount(eagle);

    app.runtime.set((d: FileCreatorState) => { d.fileName = 'data'; d.fileExtension = 'json'; });
    await app.runtime.run('createFile');
    app.runtime.set((d: FileCreatorState) => { d.fileName = 'notes'; d.fileExtension = 'md'; });
    await app.runtime.run('createFile');
    app.runtime.set((d: FileCreatorState) => { d.fileName = 'plain'; d.fileExtension = 'txt'; });
    await app.runtime.run('createFile');

    expect(eagle.createFile).toHaveBeenNthCalledWith(1, expect.objectContaining({ content: '{}\n' }));
    expect(eagle.createFile).toHaveBeenNthCalledWith(2, expect.objectContaining({ content: '# notes\n\n' }));
    expect(eagle.createFile).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ content: 'I NEED TO HAVE SOMETHING OTHERWISE EAGLE FAILS' }),
    );
  });

  it('createFile notifies and returns false when name or extension is missing', async () => {
    const eagle = fakeEagle();
    const app = await mount(eagle);

    const result = await app.runtime.run('createFile');

    expect(result).toBe(false);
    expect(eagle.createFile).not.toHaveBeenCalled();
    expect(eagle.notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Missing File Details' }));
  });

  it('addExtension ignores a blank extension', async () => {
    const app = await mount(fakeEagle());
    app.runtime.set((d: FileCreatorState) => { d.fileExtension = '   '; });
    await app.runtime.run('addExtension');
    expect(app.store.get().savedExtensions).toEqual(['txt', 'json']);
  });
});
