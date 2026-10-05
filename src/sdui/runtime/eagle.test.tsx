// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssetRecord, EagleCapabilities } from '../../host/eagle-capabilities';
import { builtinCatalogEntries } from '../catalog/builtins';
import { validatePackage, validateRuntime } from '../schema/validate';
import { assetBrowserTool } from '../../plugins/asset-browser';
import { builtinToolValidationCatalog, createBuiltinToolSession } from '../../plugins/builtin-tool';
import { foundationRuntimeCatalog } from './foundation';
import type { RuntimeSession } from './session';
import { RuntimeView } from './view';

const sessions: RuntimeSession[] = [];
afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
});

const one: AssetRecord = {
  id: 'asset-one', name: 'One', extension: 'png', width: 640, height: 480,
  url: 'eagle://asset-one', annotation: '', tags: ['blue'], folderIds: ['folder-a'], rating: 4,
  fileUrl: 'file:///one.png', thumbnailUrl: 'file:///one-thumb.png', modifiedAt: 1,
};
const two: AssetRecord = {
  ...one, id: 'asset-two', name: 'Two', extension: 'jpg', tags: ['red'],
  fileUrl: 'file:///two.jpg', thumbnailUrl: 'file:///two-thumb.jpg', modifiedAt: 2,
};

function capabilities(list: EagleCapabilities['assets']['list'], select = vi.fn(async () => true)): EagleCapabilities {
  return {
    assets: { list, select, updateMetadata: vi.fn(), importPath: vi.fn(), importUrl: vi.fn() },
  } as unknown as EagleCapabilities;
}

describe('Eagle asset widgets', () => {
  it('publishes valid contracts and runnable catalog examples', () => {
    expect(validatePackage(assetBrowserTool.manifest).success).toBe(true);
    expect(validateRuntime(assetBrowserTool.document, builtinToolValidationCatalog(assetBrowserTool)).success).toBe(true);
    for (const type of ['AssetCard', 'AssetGrid', 'AssetPicker']) {
      expect(foundationRuntimeCatalog.widgets[type]).toBeDefined();
      expect(builtinCatalogEntries.find(entry => entry.type === type)).toMatchObject({ family: 'eagle', availability: 'active' });
    }
  });

  it('shows host loading, retains stable selection across reordered results, and passes exact ids to Eagle', async () => {
    let release!: (value: AssetRecord[]) => void;
    const pending = new Promise<AssetRecord[]>(resolve => { release = resolve; });
    const list = vi.fn(() => pending);
    const select = vi.fn(async () => true);
    const session = createBuiltinToolSession(assetBrowserTool, capabilities(list, select));
    sessions.push(session);
    const user = userEvent.setup();
    render(<RuntimeView session={session} />);

    expect(screen.getByRole('status').textContent).toBe('Loading Eagle assets');
    const loading = session.run('load');
    release([one, two]);
    await loading;
    expect(await screen.findByRole('option', { name: /One/u })).toBeTruthy();

    await user.click(screen.getByRole('option', { name: /One/u }));
    expect(session.globalState.read(['selection'])).toEqual(['asset-one']);

    list.mockResolvedValueOnce([two, one]);
    await session.run('load');
    expect(screen.getByRole('option', { name: /One/u }).getAttribute('aria-selected')).toBe('true');

    await user.click(screen.getByRole('button', { name: 'Use selection' }));
    await waitFor(() => expect(select).toHaveBeenCalledWith(['asset-one']));
    expect(screen.getByText('Selected 1 assets in Eagle.')).toBeTruthy();
  });

  it('distinguishes empty and error results and retries through the declared host action', async () => {
    const list = vi.fn<EagleCapabilities['assets']['list']>()
      .mockRejectedValueOnce(new Error('Eagle asset query failed'))
      .mockResolvedValueOnce([]);
    const session = createBuiltinToolSession(assetBrowserTool, capabilities(list));
    sessions.push(session);
    const user = userEvent.setup();
    render(<RuntimeView session={session} />);

    await session.run('load');
    expect(await screen.findAllByText('Eagle asset query failed')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('No Eagle assets')).toBeTruthy();
    expect(screen.getByText('Loaded 0 Eagle assets.')).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(2);
  });
});
