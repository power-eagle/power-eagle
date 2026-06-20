/**
 * File Creator — ported from the v2 declarative fixture to definePlugin + w().
 * Saves quick-create extensions and creates a file through the host bridge.
 * The saved-extension list is a reactive view over state.savedExtensions.
 */
import { definePlugin } from '../sdui/activate';
import { w } from '../sdui/widget';
import type { Accessor } from '../sdui/state/reactive';
import { host } from './eagle';

export interface FileCreatorState {
  fileName: string;
  fileExtension: string;
  savedExtensions: string[];
}

/** Normalize a raw extension: trim, drop leading dots, lowercase. */
function normalizeExtension(raw: string): string {
  return raw.trim().replace(/^\.+/u, '').toLowerCase();
}

/** Default file content for one extension (mirrors the v2 fixture). */
function defaultContent(fileName: string, extension: string): string {
  if (extension === 'json') return '{}\n';
  if (extension === 'md') return `# ${fileName}\n\n`;
  return 'I NEED TO HAVE SOMETHING OTHERWISE EAGLE FAILS';
}

export const fileCreator = definePlugin<FileCreatorState>({
  manifest: { id: 'file-creator', name: 'File Creator', version: '3.0.0', keywords: ['files', 'create'] },
  state: () => ({ fileName: '', fileExtension: 'txt', savedExtensions: ['txt', 'json'] }),
  actions: {
    addExtension(rt) {
      const extension = normalizeExtension(rt.get().fileExtension);
      if (!extension) return;
      rt.set((draft) => {
        if (!draft.savedExtensions.includes(extension)) {
          draft.savedExtensions = [...draft.savedExtensions, extension];
        }
      });
    },
    removeExtension(rt, extension) {
      rt.set((draft) => {
        draft.savedExtensions = draft.savedExtensions.filter((entry) => entry !== extension);
      });
    },
    async createFile(rt, extensionArg) {
      const state = rt.get();
      const fileName = state.fileName.trim();
      const extension = normalizeExtension(String(extensionArg ?? state.fileExtension));

      if (!fileName || !extension) {
        await host(rt).notify({ title: 'Missing File Details', body: 'Enter a file name and extension first.' });
        return false;
      }
      if (!state.savedExtensions.includes(extension)) {
        rt.set((draft) => {
          draft.savedExtensions = [...draft.savedExtensions, extension];
        });
      }
      return host(rt).createFile({ fileName, extension, content: defaultContent(fileName, extension) });
    },
  },
  view: (s, rt) =>
    w('col', {
      children: [
        w('text', { data: 'File Creator' }),
        w('row', {
          children: [
            w('input', {
              value: s.fileName,
              placeholder: 'File name',
              onInput: (value: unknown) => rt.set((draft) => { draft.fileName = value as string; }),
            }),
            w('input', {
              value: s.fileExtension,
              placeholder: 'Extension',
              onInput: (value: unknown) => rt.set((draft) => { draft.fileExtension = value as string; }),
            }),
          ],
        }),
        w('row', {
          children: [
            w('button', { children: 'Add Extension', onPress: () => rt.run('addExtension') }),
            w('button', { children: 'Create File', onPress: () => rt.run('createFile') }),
          ],
        }),
        w('list', {
          for: s.savedExtensions,
          empty: w('text', { data: 'No extensions saved yet' }),
          render: (item: Accessor<unknown>) => {
            const extension = item() as string;
            return w('row', {
              key: extension,
              children: [
                w('text', { data: `.${extension}` }),
                w('button', { children: 'Create', onPress: () => rt.run('createFile', extension) }),
                w('button', { children: 'Remove', onPress: () => rt.run('removeExtension', extension) }),
              ],
            });
          },
        }),
      ],
    }),
});
