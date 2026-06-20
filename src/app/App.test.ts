// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import type { HostService } from './host-service';
import { getBuiltin } from '../plugins/builtins';
import type { EagleHost } from '../plugins/eagle';

// jsdom under Node 22 ships no localStorage without --localstorage-file; the real
// Eagle/Electron renderer has it. Shim a minimal in-memory Storage for the tests.
class MemStorage {
  private store = new Map<string, string>();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.has(key) ? (this.store.get(key) as string) : null; }
  key(index: number): string | null { return [...this.store.keys()][index] ?? null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(key, String(value)); }
}
Object.defineProperty(window, 'localStorage', { value: new MemStorage(), configurable: true });

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function fakeService(): HostService {
  return {
    listAvailable: () => [
      { id: 'file-creator', name: 'File Creator', version: '3.0.0', source: 'builtin', kind: 'visual', launchable: true },
      { id: 'recent-libraries', name: 'Recent Libraries', version: '3.0.0', source: 'builtin', kind: 'visual', launchable: true },
      { id: 'clipboard', name: 'Clipboard', version: '1.0.0', source: 'builtin', kind: 'service', launchable: false },
    ],
    listBuckets: () => [],
    install: () => {},
    addBucket: () => {},
    loadModule: async (id) => getBuiltin(id),
  };
}

function fakeEagle(): EagleHost {
  return {
    createFile: async () => true,
    getRecentLibraries: async () => [],
    switchLibrary: async () => {},
    notify: async () => {},
  };
}

describe('App shell (v3)', () => {
  it('lists available plugins from the host service and launches one into its view', async () => {
    render(React.createElement(App, { service: fakeService(), eagle: fakeEagle() }));

    expect(screen.getByText('File Creator')).toBeTruthy();
    expect(screen.getByText('Recent Libraries')).toBeTruthy();

    await userEvent.click(screen.getByText('File Creator'));

    // The file-creator plugin view rendered (control unique to that plugin).
    expect(await screen.findByText('Add Extension')).toBeTruthy();
  });

  it('shows a service plugin overview of its provided methods when selected', async () => {
    render(React.createElement(App, { service: fakeService(), eagle: fakeEagle() }));

    await userEvent.click(screen.getByText('Clipboard'));

    // Overview lists the clipboard service's methods (copy/read), built from the live context.
    expect(await screen.findByText(/methods:\s*copy, read/iu)).toBeTruthy();
  });

  it('toggles a plugin off and persists the disabled id across a remount', async () => {
    const { unmount } = render(React.createElement(App, { service: fakeService(), eagle: fakeEagle() }));

    const row = screen.getByText('Clipboard').closest('div') as HTMLElement;
    await userEvent.click(within(row).getByTitle('disable'));
    expect(within(row).getByTitle('enable')).toBeTruthy();

    // Remount: the toggle survives because disabled ids are read back from localStorage.
    unmount();
    render(React.createElement(App, { service: fakeService(), eagle: fakeEagle() }));
    const remounted = screen.getByText('Clipboard').closest('div') as HTMLElement;
    expect(within(remounted).getByTitle('enable')).toBeTruthy();
  });
});
