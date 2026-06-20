import { describe, it, expect, vi } from 'vitest';
import { activatePlugin } from '../sdui/activate';
import { recentLibraries } from './recent-libraries';
import type { EagleHost } from './eagle';

function fakeEagle(paths: string[]): EagleHost & {
  switchLibrary: ReturnType<typeof vi.fn>;
  notify: ReturnType<typeof vi.fn>;
} {
  return {
    createFile: async () => true,
    getRecentLibraries: async () => [...paths],
    switchLibrary: vi.fn(async () => {}),
    notify: vi.fn(async () => {}),
  };
}

async function mount(eagle: EagleHost) {
  return activatePlugin(recentLibraries, eagle as unknown as Record<string, unknown>);
}

describe('recent-libraries actions', () => {
  it('remove drops a library from both libraries and filtered', async () => {
    const app = await mount(fakeEagle(['/lib/Foo.library', '/lib/Bar.library']));
    const target = app.store.get().libraries.find((library) => library.name === 'Foo');

    await app.runtime.run('remove', target);

    expect(app.store.get().libraries.some((library) => library.name === 'Foo')).toBe(false);
    expect(app.store.get().filtered.some((library) => library.name === 'Foo')).toBe(false);
  });

  it('open switches to the library and notifies', async () => {
    const eagle = fakeEagle(['/lib/Foo.library']);
    const app = await mount(eagle);
    const target = app.store.get().libraries[0];

    await app.runtime.run('open', target);

    expect(eagle.switchLibrary).toHaveBeenCalledWith('/lib/Foo.library');
    expect(eagle.notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Library Opened' }));
  });

  it('clearInvalid notifies when there is nothing to clear', async () => {
    const eagle = fakeEagle(['/lib/Foo.library', '/lib/Bar.library']);
    const app = await mount(eagle);

    await app.runtime.run('clearInvalid');

    expect(eagle.notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Nothing to clear' }));
    expect(app.store.get().libraries).toHaveLength(2);
  });
});
