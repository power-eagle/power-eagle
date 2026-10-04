// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { DesignSystemGallery } from './gallery';

afterEach(cleanup);

describe('production component gallery', () => {
  it('exposes the blueprint controls and textual activation states', async () => {
    const user = userEvent.setup();
    render(<DesignSystemGallery />);

    expect(screen.getByRole('main', { name: 'Power Eagle component gallery' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'tokens' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'controls' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'states' })).toBeTruthy();
    expect(screen.getByText('active')).toBeTruthy();
    expect(screen.getByText('failed')).toBeTruthy();

    await user.click(screen.getByRole('switch', { name: 'Disable Clipboard' }));
    expect(screen.getByRole('switch', { name: 'Enable Clipboard' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getAllByText('off')).toHaveLength(2);

    await user.click(screen.getByRole('tab', { name: 'activation' }));
    expect(screen.getByRole('tab', { name: 'activation' }).getAttribute('aria-selected')).toBe('true');
  });
});
