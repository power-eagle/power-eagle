// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EagleCapabilities, LibraryHistoryRecord } from '../host/eagle-capabilities';
import { RuntimeView } from '../sdui/runtime/view';
import { validatePackage, validateRuntime } from '../sdui/schema/validate';
import { builtinToolValidationCatalog, createBuiltinToolSession, openBuiltinTool } from './builtin-tool';
import {
  fileCreatorTool, initialFileContent, normalizeExtension, normalizeFileName,
} from './file-creator';
import {
  clearMissingLibraries, filterLibraries, recentLibrariesTool, removeLibraryFromList,
} from './recent-libraries';

const sessions: import('../sdui/runtime/session').RuntimeSession[] = [];

afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
});

function capabilities(options: {
  createText?: EagleCapabilities['files']['createText'];
  history?: EagleCapabilities['library']['history'];
  switchLibrary?: EagleCapabilities['library']['switch'];
} = {}): EagleCapabilities {
  return {
    files: {
      createText: options.createText ?? vi.fn(async suggestedName => ({ status: 'created', path: `C:\\created\\${suggestedName}` })),
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
  { id: 'one', name: 'One', path: 'C:\\One.library', status: 'available' },
  { id: 'two', name: 'Two', path: 'D:\\Two.library', status: 'missing', reason: 'Directory does not exist' },
  { id: 'three', name: 'Three', path: 'E:\\Three.library', status: 'inaccessible', reason: 'Access denied' },
];

describe('new-format File Creator built-in', () => {
  it('publishes valid package/runtime contracts and normalizes supported file details', () => {
    expect(validatePackage(fileCreatorTool.manifest).success).toBe(true);
    expect(validateRuntime(fileCreatorTool.document, builtinToolValidationCatalog(fileCreatorTool)).success).toBe(true);
    expect(normalizeExtension(' ..MD ')).toBe('md');
    expect(normalizeFileName(' Notes ')).toBe('Notes');
    expect(() => normalizeExtension('   ')).toThrow('Enter an extension');
    expect(() => normalizeFileName('../notes')).toThrow('without path separators');
    expect(initialFileContent('Notes', 'json')).toBe('{}\n');
    expect(initialFileContent('Notes', 'md')).toBe('# Notes\n\n');
  });

  it('adds/removes normalized quick choices and shows the actual creation result', async () => {
    const createText = vi.fn(async (suggestedName: string) => ({ status: 'created' as const, path: `C:\\created\\${suggestedName}` }));
    const session = createBuiltinToolSession(fileCreatorTool, capabilities({ createText }));
    sessions.push(session);
    const user = userEvent.setup();
    render(<RuntimeView session={session} />);

    const extension = screen.getByRole('textbox', { name: /Extension/u });
    await user.clear(extension);
    await user.type(extension, '..YAML ');
    await user.click(screen.getByRole('button', { name: 'Add extension' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use .yaml' })).toBeTruthy());
    expect((extension as HTMLInputElement).value).toBe('yaml');

    await user.click(screen.getByRole('button', { name: 'Remove .json' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Use .json' })).toBeNull());

    await user.type(screen.getByRole('textbox', { name: /File name/u }), 'notes');
    await user.clear(extension);
    await user.type(extension, '.MD');
    await user.click(screen.getByRole('button', { name: 'Create file' }));

    await waitFor(() => expect(createText).toHaveBeenCalledWith('notes.md', '# notes\n\n'));
    expect(screen.getByText('Created C:\\created\\notes.md')).toBeTruthy();
  });

  it('uses form validation to prevent creation without a file name', async () => {
    const createText = vi.fn<EagleCapabilities['files']['createText']>();
    const session = createBuiltinToolSession(fileCreatorTool, capabilities({ createText }));
    sessions.push(session);
    const user = userEvent.setup();
    render(<RuntimeView session={session} />);

    await user.click(screen.getByRole('button', { name: 'Create file' }));

    expect(await screen.findByText('File name is required.')).toBeTruthy();
    expect(createText).not.toHaveBeenCalled();
  });
});

describe('new-format Recent Libraries built-in', () => {
  it('filters by name/path and removes only from the in-memory list', () => {
    expect(validatePackage(recentLibrariesTool.manifest).success).toBe(true);
    expect(validateRuntime(recentLibrariesTool.document, builtinToolValidationCatalog(recentLibrariesTool)).success).toBe(true);
    expect(filterLibraries(history, 'd:\\two')).toEqual([history[1]]);
    expect(removeLibraryFromList(history, 'one')).toEqual(history.slice(1));
    expect(clearMissingLibraries(history)).toEqual({ libraries: [history[0], history[2]], removed: 1 });
  });

  it('loads host history, filters it, keeps inaccessible entries, and switches the exact selected path', async () => {
    const switchLibrary = vi.fn(async (path: string) => ({ path, switched: true }));
    const host = capabilities({ history: vi.fn(async () => history), switchLibrary });
    const session = await openBuiltinTool(recentLibrariesTool, host);
    sessions.push(session);
    const user = userEvent.setup();
    render(<RuntimeView session={session} />);

    expect(screen.getByText('Loaded 3 recent libraries.')).toBeTruthy();
    const query = screen.getByRole('searchbox', { name: 'Filter by name or path' });
    await user.type(query, 'd:\\two');
    await waitFor(() => expect(screen.getByText('Two')).toBeTruthy());
    expect(screen.queryByText('One')).toBeNull();
    await user.clear(query);

    await user.click(screen.getByRole('button', { name: 'Clear verified missing' }));
    await waitFor(() => expect(screen.queryByText('Two')).toBeNull());
    expect(screen.getByText('Three')).toBeTruthy();
    expect(screen.getByText(/Removed 1 verified-missing entr/u)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Open One' }));
    await waitFor(() => expect(switchLibrary).toHaveBeenCalledWith('C:\\One.library', expect.any(AbortSignal)));
    expect(screen.getByText('Opened C:\\One.library')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Remove One' }));
    await waitFor(() => expect(screen.queryByText('One')).toBeNull());
    expect(screen.getByText(/Eagle history and library contents are unchanged/u)).toBeTruthy();
  });

  it('shows a switch rejection and never reports the library as opened', async () => {
    const host = capabilities({
      history: vi.fn(async () => [history[0]]),
      switchLibrary: vi.fn(async () => { throw new Error('switch rejected by Eagle'); }),
    });
    const session = await openBuiltinTool(recentLibrariesTool, host);
    sessions.push(session);
    const user = userEvent.setup();
    render(<RuntimeView session={session} />);

    await user.click(screen.getByRole('button', { name: 'Open One' }));

    expect(await screen.findByText('switch rejected by Eagle')).toBeTruthy();
    expect(screen.queryByText('Opened C:\\One.library')).toBeNull();
  });
});
