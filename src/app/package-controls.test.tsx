// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { PackageControls } from './package-controls';
import type { WorkbenchAcquisition } from '../host/install/workbench-acquisition';
import type { CatalogEntry } from '../host/workspaces/catalog';

afterEach(cleanup);
function fixture() {
  const api = { setup: vi.fn().mockResolvedValue(undefined), install: vi.fn().mockResolvedValue({ instanceId: 'installed' }),
    preview: vi.fn().mockResolvedValue('preview'), refresh: vi.fn().mockResolvedValue({ instanceId: 'installed' }),
    remove: vi.fn().mockResolvedValue(undefined), closePreview: vi.fn().mockResolvedValue(undefined) };
  const onSelect = vi.fn();
  return { api, onSelect, acquisition: api as unknown as WorkbenchAcquisition, user: userEvent.setup() };
}
it('explains unavailable management without offering mutations', () => {
  render(<PackageControls onSelect={() => {}} unavailableReason="Saucepan is incompatible. Install 0.10." />);
  expect(screen.getByRole('status').textContent).toContain('Install 0.10');
  expect(screen.queryByRole('button')).toBeNull();
});
it('initializes only on request and installs a local package', async () => {
  const f = fixture(); render(<PackageControls {...f} />);
  expect(f.api.setup).not.toHaveBeenCalled();
  await f.user.click(screen.getByText('Package store setup'));
  await f.user.click(screen.getByRole('button', { name: 'Initialize store' }));
  expect(f.api.setup).toHaveBeenCalledOnce();
  await f.user.click(screen.getByText('Add package'));
  await f.user.type(screen.getByLabelText('Package source'), 'C:\\packages\\sample');
  await f.user.click(screen.getByRole('button', { name: 'Install' }));
  await waitFor(() => expect(f.onSelect).toHaveBeenCalledWith('installed'));
  expect(f.api.install).toHaveBeenCalledWith({ source: { type: 'local', path: 'C:\\packages\\sample' }, selector: { type: 'local' } });
});
it('maps Git commit/subfolder preview and URL file acquisition', async () => {
  const f = fixture(); render(<PackageControls {...f} />);
  await f.user.click(screen.getByText('Add package'));
  await f.user.selectOptions(screen.getByLabelText('Source type'), 'git');
  await f.user.type(screen.getByLabelText('Package source'), 'https://example.test/repo');
  await f.user.selectOptions(screen.getByLabelText('Git selection'), 'commit');
  await f.user.clear(screen.getByLabelText('Git revision')); await f.user.type(screen.getByLabelText('Git revision'), 'abcdef');
  await f.user.type(screen.getByLabelText('Package subfolder (optional)'), 'plugins/demo');
  await f.user.click(screen.getByRole('button', { name: 'Preview' }));
  expect(f.api.preview).toHaveBeenCalledWith({ source: { type: 'git', origin: 'https://example.test/repo' }, selector: { type: 'commit', commit: 'abcdef' }, selection: { folder: 'plugins/demo' } });
  await f.user.selectOptions(screen.getByLabelText('Source type'), 'url');
  await f.user.selectOptions(screen.getByLabelText('Download format'), 'raw');
  await f.user.clear(screen.getByLabelText('Package subfolder (optional)'));
  await f.user.click(screen.getByRole('button', { name: 'Install' }));
  expect(f.api.install).toHaveBeenCalledWith({ source: { type: 'url', url: 'https://example.test/repo' }, selector: { type: 'url' }, selection: { format: 'raw', filename: 'manifest.json' } });
});
it('surfaces failed refresh and allows removal and explicit preview close', async () => {
  const f = fixture(); f.api.refresh.mockRejectedValueOnce(new Error('Prior revision retained'));
  const selected = { instance: { instanceId: 'installed', acquisition: { revision: 1 } } } as CatalogEntry;
  const view = render(<PackageControls {...f} selected={selected} />);
  await f.user.click(screen.getByRole('button', { name: 'Refresh source' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Prior revision retained');
  await f.user.click(screen.getByRole('button', { name: 'Remove installation' }));
  expect(f.api.remove).toHaveBeenCalledWith('installed');
  view.rerender(<PackageControls {...f} selected={{ ...selected, session: true }} />);
  await f.user.click(screen.getByRole('button', { name: 'Close preview' }));
  expect(f.api.closePreview).toHaveBeenCalledWith('installed');
});
