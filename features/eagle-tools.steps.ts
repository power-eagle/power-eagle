// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, vi } from 'vitest';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { createElement } from 'react';
import type { EagleCapabilities, LibraryHistoryRecord } from '../src/host/eagle-capabilities';
import { RuntimeView } from '../src/sdui/runtime/view';
import type { RuntimeSession } from '../src/sdui/runtime/session';
import { createBuiltinToolSession, openBuiltinTool } from '../src/plugins/builtin-tool';
import { fileCreatorTool } from '../src/plugins/file-creator';
import { recentLibrariesTool } from '../src/plugins/recent-libraries';

function capabilities(options: {
  createText?: EagleCapabilities['files']['createText'];
  history?: EagleCapabilities['library']['history'];
  switchLibrary?: EagleCapabilities['library']['switch'];
} = {}): EagleCapabilities {
  return {
    files: {
      createText: options.createText ?? vi.fn(async suggestedName => ({ status: 'created', path: suggestedName })),
      inspect: vi.fn(async path => ({ path, status: 'missing' as const })),
    },
    library: {
      current: vi.fn(async () => ({ name: 'Current', path: 'C:\\Current.library', modificationTime: 1 })),
      history: options.history ?? vi.fn(async () => []),
      switch: options.switchLibrary ?? vi.fn(async path => ({ path, switched: true })),
    },
  } as unknown as EagleCapabilities;
}

const history: LibraryHistoryRecord[] = [
  { id: 'available', name: 'Available', path: 'C:\\Available.library', status: 'available' },
  { id: 'missing', name: 'Missing', path: 'D:\\Missing.library', status: 'missing', reason: 'Directory does not exist' },
  { id: 'private', name: 'Private', path: 'E:\\Private.library', status: 'inaccessible', reason: 'Access denied' },
];

const feature = await loadFeature('features/eagle-tools.feature');
describeFeature(feature, ({ Scenario, AfterEachScenario }) => {
  let session: RuntimeSession | undefined;

  AfterEachScenario(async () => {
    cleanup();
    await session?.dispose();
    session = undefined;
  });

  Scenario('Create a file with a normalized extension', ({ Given, When, Then }) => {
    const createText = vi.fn(async (suggestedName: string) => ({
      status: 'created' as const, path: `C:\\created\\${suggestedName}`,
    }));

    Given('the File Creator is open with an Eagle file capability', () => {
      session = createBuiltinToolSession(fileCreatorTool, capabilities({ createText }));
      render(createElement(RuntimeView, { session }));
    });
    When('I create notes with the extension .MD', async () => {
      const user = userEvent.setup();
      await user.type(screen.getByRole('textbox', { name: /File name/u }), 'notes');
      const extension = screen.getByRole('textbox', { name: /Extension/u });
      await user.clear(extension);
      await user.type(extension, '.MD');
      await user.click(screen.getByRole('button', { name: 'Create file' }));
    });
    Then('Eagle receives notes.md with Markdown starter content', async () => {
      await waitFor(() => expect(createText).toHaveBeenCalledWith('notes.md', '# notes\n\n'));
      expect(screen.getByText('Created C:\\created\\notes.md')).toBeTruthy();
    });
  });

  Scenario('Clear only verified missing libraries and open an available library', ({ Given, When, Then }) => {
    const switchLibrary = vi.fn(async (path: string) => ({ path, switched: true }));

    Given('Recent Libraries contains available, missing, and inaccessible entries', async () => {
      session = await openBuiltinTool(recentLibrariesTool, capabilities({
        history: vi.fn(async () => history), switchLibrary,
      }));
      render(createElement(RuntimeView, { session }));
      expect(screen.getByText('Loaded 3 recent libraries.')).toBeTruthy();
    });
    When('I clear verified missing entries and open the available library', async () => {
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Clear verified missing' }));
      await waitFor(() => expect(screen.queryByText('Missing')).toBeNull());
      await user.click(screen.getByRole('button', { name: 'Open Available' }));
    });
    Then('the missing entry is removed and Eagle receives the exact available path', async () => {
      expect(screen.getByText('Private')).toBeTruthy();
      await waitFor(() => expect(switchLibrary).toHaveBeenCalledWith('C:\\Available.library', expect.any(AbortSignal)));
      expect(screen.getByText('Opened C:\\Available.library')).toBeTruthy();
    });
  });
});
