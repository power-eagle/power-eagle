import { describe, expect, it, vi } from 'vitest';
import { createEagleSelectionAdapter } from './eagle-selection';

describe('Eagle file selection adapter', () => {
  it('maps the runtime request to Eagle open-dialog options and preserves cancellation', async () => {
    const showOpenDialog = vi.fn()
      .mockResolvedValueOnce({ canceled: false, filePaths: ['C:\\images\\one.png', 'C:\\images\\two.png'] })
      .mockResolvedValueOnce({ canceled: true, filePaths: [] });
    const select = createEagleSelectionAdapter({ showOpenDialog });
    const signal = new AbortController().signal;

    await expect(select({
      selectionType: 'file', multiple: true, title: 'Choose images', initialPath: 'C:\\images',
      buttonLabel: 'Import', filters: [{ name: 'Images', extensions: ['png', 'jpg'] }], signal,
    })).resolves.toEqual(['C:\\images\\one.png', 'C:\\images\\two.png']);
    expect(showOpenDialog).toHaveBeenNthCalledWith(1, {
      title: 'Choose images', defaultPath: 'C:\\images', buttonLabel: 'Import',
      filters: [{ name: 'Images', extensions: ['png', 'jpg'] }], properties: ['openFile', 'multiSelections'],
    });

    await expect(select({ selectionType: 'directory', multiple: false, signal })).resolves.toBeNull();
    expect(showOpenDialog).toHaveBeenNthCalledWith(2, { properties: ['openDirectory'] });
  });

  it('does not open a dialog for an already-aborted view', async () => {
    const showOpenDialog = vi.fn();
    const controller = new AbortController();
    controller.abort();
    await expect(createEagleSelectionAdapter({ showOpenDialog })({
      selectionType: 'file', multiple: false, signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' });
    expect(showOpenDialog).not.toHaveBeenCalled();
  });
});
