// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiTab } from './ai-tab';
import type { HostContext } from '../app/host-service';
import type { GenerateResult } from './generate';

afterEach(cleanup);

const context = { services: {}, widgets: {}, theme: {}, contributions: {} } as unknown as HostContext;

describe('AiTab platform toggles', () => {
  it('defaults both surfaces on and forwards the toggle state to generate', async () => {
    const generate = vi.fn(async (): Promise<GenerateResult> => ({
      attempt: { id: 'g', prompt: 'p', name: 'G', status: 'ok' },
      dir: '/d',
      module: undefined,
    }));
    render(React.createElement(AiTab, { context, eagle: {}, attempts: [], generate, loadAttempt: async () => undefined }));

    await userEvent.click(screen.getByLabelText(/eagle api/iu)); // turn Eagle off
    await userEvent.type(screen.getByPlaceholderText(/describe the plugin/iu), 'make x');
    await userEvent.click(screen.getByRole('button', { name: /^generate$/iu }));

    expect(generate).toHaveBeenCalledWith('make x', { includeEagle: false, includeWebApi: true });
  });
});
