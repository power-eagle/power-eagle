// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkbenchShell } from './workbench-shell';

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
  vi.restoreAllMocks();
});

describe('workbench shell', () => {
  it('keeps panel state while accessible rails collapse and restore from the keyboard', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 910 });
    const user = userEvent.setup();
    render(<WorkbenchShell stage={<p>Stage content</p>} />);

    expect(screen.getByRole('main', { name: 'Power Eagle workbench' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Sources' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Stage' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Agent' })).toBeTruthy();
    expect(screen.getByText('Stage content')).toBeTruthy();

    const source = screen.getByRole('textbox', { name: 'Package source' });
    await user.type(source, 'owner/repo');
    const sourceCollapse = screen.getByRole('button', { name: 'Collapse Sources' });
    sourceCollapse.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('complementary', { name: 'Sources' })).toBeTruthy();
    screen.getByRole('button', { name: 'Expand Sources' }).focus();
    await user.keyboard('{Enter}');
    expect((screen.getByRole('textbox', { name: 'Package source' }) as HTMLInputElement).value).toBe('owner/repo');

    const prompt = screen.getByRole('textbox', { name: 'Describe an extension' });
    await user.type(prompt, 'Build a folder report');
    await user.click(screen.getByRole('button', { name: 'Collapse Agent' }));
    await user.click(screen.getByRole('button', { name: 'Expand Agent' }));
    expect((screen.getByRole('textbox', { name: 'Describe an extension' }) as HTMLTextAreaElement).value).toBe('Build a folder report');
  });

  it('starts side panels as rails at narrow widths and leaves Stage available', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 640 });
    render(<WorkbenchShell stage={<p>Narrow stage</p>} />);

    expect(screen.getByRole('button', { name: 'Expand Sources' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Expand Agent' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Stage' })).toBeTruthy();
    expect(screen.getByText('Narrow stage')).toBeTruthy();
  });

  it('contains a stage render failure without removing Sources or Agent', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Broken = () => { throw new Error('provider render failed'); };
    render(<WorkbenchShell stage={<Broken />} />);

    expect(screen.getByRole('alert').textContent).toContain('provider render failed');
    expect(screen.getByRole('region', { name: 'Sources' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Agent' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry view' })).toBeTruthy();
  });
});
