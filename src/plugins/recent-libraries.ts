/**
 * Recent Libraries — ported from the v2 declarative fixture to definePlugin +
 * w(). Loads recent Eagle libraries from the host on mount, filters them by a
 * search query, opens or removes one, and clears invalid entries. The visible
 * list is a reactive view over state.filtered.
 */
import { definePlugin } from '../sdui/activate';
import { w } from '../sdui/widget';
import type { Accessor } from '../sdui/state/reactive';
import { host } from './eagle';

interface Library {
  id: string;
  name: string;
  path: string;
  status: 'valid' | 'invalid';
  statusVariant: 'success' | 'error';
}

export interface RecentLibrariesState {
  libraries: Library[];
  filtered: Library[];
  search: string;
}

/** Build a library record from one recent-library path (v2 validity rule). */
function toLibrary(path: string, index: number): Library {
  const valid = !path.endsWith('Projects.library');
  return {
    id: `lib_${index}`,
    name: (path.split('/').pop() ?? '').replace('.library', ''),
    path,
    status: valid ? 'valid' : 'invalid',
    statusVariant: valid ? 'success' : 'error',
  };
}

/** Filter libraries by a case-insensitive query over name and path. */
function matching(libraries: Library[], query: string): Library[] {
  const q = query.trim().toLowerCase();
  if (!q) return libraries;
  return libraries.filter(
    (library) => library.name.toLowerCase().includes(q) || library.path.toLowerCase().includes(q),
  );
}

export const recentLibraries = definePlugin<RecentLibrariesState>({
  manifest: { id: 'recent-libraries', name: 'Recent Libraries', version: '3.0.0', keywords: ['library', 'management'] },
  state: () => ({ libraries: [], filtered: [], search: '' }),
  onMount: (rt) => rt.run('refresh'),
  actions: {
    async refresh(rt) {
      const paths = await host(rt).getRecentLibraries();
      const libraries = paths.map(toLibrary);
      rt.set((draft) => {
        draft.libraries = libraries;
        draft.filtered = matching(libraries, draft.search);
      });
    },
    filter(rt, query) {
      const search = String(query ?? '');
      rt.set((draft) => {
        draft.search = search;
        draft.filtered = matching(draft.libraries, search);
      });
    },
    remove(rt, library) {
      const target = library as Library;
      rt.set((draft) => {
        draft.libraries = draft.libraries.filter((entry) => entry.id !== target.id);
        draft.filtered = draft.filtered.filter((entry) => entry.id !== target.id);
      });
    },
    async clearInvalid(rt) {
      const invalid = rt.get().libraries.filter((library) => library.status === 'invalid');
      if (!invalid.length) {
        await host(rt).notify({ title: 'Nothing to clear', body: 'All libraries are valid' });
        return;
      }
      rt.set((draft) => {
        draft.libraries = draft.libraries.filter((library) => library.status === 'valid');
        draft.filtered = draft.filtered.filter((library) => library.status === 'valid');
      });
      await host(rt).notify({ title: 'Done', body: `Removed ${invalid.length} invalid libraries` });
    },
    async open(rt, library) {
      const target = library as Library;
      await host(rt).switchLibrary(target.path);
      await host(rt).notify({ title: 'Library Opened', body: `Switched to ${target.name}` });
    },
  },
  view: (s, rt) =>
    w('col', {
      children: [
        w('text', { data: 'Recent Libraries' }),
        w('row', {
          children: [
            w('input', {
              value: s.search,
              placeholder: 'Filter libraries...',
              onInput: (value: unknown) => rt.run('filter', value),
            }),
            w('button', { children: 'Refresh', onPress: () => rt.run('refresh') }),
            w('button', { children: 'Clear Invalid', onPress: () => rt.run('clearInvalid') }),
          ],
        }),
        w('list', {
          for: s.filtered,
          empty: w('text', { data: 'No libraries found' }),
          render: (item: Accessor<unknown>) => {
            const library = item() as Library;
            return w('row', {
              key: library.id,
              children: [
                w('text', { data: library.name }),
                w('text', { data: library.path }),
                w('text', { data: library.status }),
                w('button', { children: 'Open', onPress: () => rt.run('open', library) }),
                w('button', { children: 'Remove', onPress: () => rt.run('remove', library) }),
              ],
            });
          },
        }),
      ],
    }),
});
