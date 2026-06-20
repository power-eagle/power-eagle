// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import type { HostService } from './host-service';
import type { EagleHost } from '../plugins/eagle';

afterEach(cleanup);

function fakeService(): HostService {
  return {
    listAvailable: () => [
      { id: 'file-creator', name: 'File Creator', version: '3.0.0', source: 'builtin', kind: 'visual', launchable: true },
      { id: 'recent-libraries', name: 'Recent Libraries', version: '3.0.0', source: 'builtin', kind: 'visual', launchable: true },
    ],
    listBuckets: () => [],
    install: () => {},
    addBucket: () => {},
    getLaunchable: () => undefined,
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
});
