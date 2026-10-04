// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
  Banner, Button, Column, Dialog, EmptyState, ErrorState, ProgressIndicator, Skeleton, Text, Toast, foundationCatalog,
} from '../authoring/foundation';
import { expression, feedback, ref, set } from '../authoring';
import type { Json, Node, RuntimeDocument } from '../schema/model';
import { validateRuntime } from '../schema/validate';
import { foundationRuntimeCatalog } from './foundation';
import { RuntimeSession } from './session';
import { RuntimeView } from './view';

const tagged = (value: unknown) => value as Json;
const sessions: RuntimeSession[] = [];

function documentWith(body: Node, state: RuntimeDocument['state'] = {}, screens: RuntimeDocument['screens'] = {}): RuntimeDocument {
  return {
    format: 'power-eagle/runtime', formatVersion: 1, start: 'home', dependencies: [], actions: {}, components: {}, state,
    screens: {
      home: { params: { type: 'object', properties: {}, required: [] }, state: {}, body },
      ...screens,
    },
  };
}

function renderDocument(document: RuntimeDocument) {
  const session = new RuntimeSession(document, foundationRuntimeCatalog);
  sessions.push(session);
  return { session, ...render(<RuntimeView session={session} />) };
}

afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
});

describe('feedback widgets and actions', () => {
  it('distinguishes loading, empty, error, and success with visible text and performs retry transitions', async () => {
    const phase = ref<string>('state', 'phase');
    const body = Column.node({ gap: 8 }, { slots: { children: [
      ProgressIndicator.node({ label: 'Loading packages', status: 'Connecting to source', value: 35 }, {
        visible: tagged(expression('eq', tagged(phase), 'loading')),
      }),
      Skeleton.node({ label: 'Loading package rows', lines: 2 }, { visible: tagged(expression('eq', tagged(phase), 'loading')) }),
      ErrorState.node({ title: 'Source unavailable', message: 'Connection failed.', retryLabel: 'Retry source' }, {
        visible: tagged(expression('eq', tagged(phase), 'error')), events: { retry: set('phase', 'loading') },
      }),
      EmptyState.node({ title: 'No packages', message: 'Add a source to begin.', actionLabel: 'Add source' }, {
        events: { action: set('emptyAction', true) },
      }),
      Banner.node({ title: 'Package activated', message: 'The provider is ready.', tone: 'success', dismissible: true }, {
        events: { dismiss: set('bannerDismissed', true) },
      }),
    ] } });
    const { session } = renderDocument(documentWith(body, {
      phase: { schema: { type: 'enum', values: ['error', 'loading'] }, initial: 'error' },
      emptyAction: { schema: { type: 'boolean' }, initial: false },
      bannerDismissed: { schema: { type: 'boolean' }, initial: false },
    }));
    const user = userEvent.setup();

    expect(screen.getByRole('alert').textContent).toContain('Source unavailable');
    await user.click(screen.getByRole('button', { name: 'Retry source' }));
    await waitFor(() => expect(screen.queryByText('Source unavailable')).toBeNull());
    expect(screen.getByRole('progressbar', { name: 'Loading packages' })).toBeTruthy();
    expect(screen.getAllByText('Connecting to source')).toHaveLength(2);
    expect(screen.getByRole('status', { name: 'Loading package rows' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Add source' }));
    await user.click(screen.getByRole('button', { name: 'Dismiss Package activated' }));
    expect(session.globalState.read(['emptyAction'])).toBe(true);
    expect(session.globalState.read(['bannerDismissed'])).toBe(true);
  });

  it('opens stage-local overlays from language actions, traps modal focus, and restores the invoker on close', async () => {
    const body = Column.node({ gap: 8 }, { slots: { children: [
      Button.node({ label: 'Show toast' }, { events: {
        press: feedback('toast', 'saved', { message: 'Saved through feedback action', tone: 'success' }),
      } }),
      Toast.node({ id: 'saved', message: 'Saved', duration: 0, open: false }),
      Button.node({ label: 'Open dialog' }, { events: {
        press: feedback('openDialog', 'confirm', { title: 'Confirm install', description: 'This package adds widgets.' }),
      } }),
      Dialog.node({ id: 'confirm', title: 'Install package?', description: '', open: false }, { slots: {
        children: [Text.node({ text: 'example.package/widgets' })],
        actions: [Button.node({ label: 'Cancel' }, { events: { press: feedback('closeDialog', 'confirm') } })],
      }, events: { close: set('closeReason', tagged(ref('event', 'reason'))) } }),
    ] } });
    const detail = { params: { type: 'object' as const, properties: {}, required: [] }, state: {}, body: Text.node({ text: 'Detail screen' }) };
    const { session, container } = renderDocument(documentWith(body, {
      closeReason: { schema: { type: 'enum', values: ['button', 'escape', 'backdrop', 'timeout', 'action'] }, initial: 'action' },
    }, { detail }));
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Show toast' }));
    const toast = screen.getByRole('status');
    expect(toast.textContent).toContain('Saved through feedback action');
    expect(toast.closest('[data-pe-runtime-stage]')).toBe(container.querySelector('[data-pe-runtime-stage]'));

    const invoker = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(invoker);
    const dialog = await screen.findByRole('dialog', { name: 'Confirm install' });
    expect(dialog.closest('[data-pe-runtime-stage]')).toBe(container.querySelector('[data-pe-runtime-stage]'));
    const closeButton = screen.getByRole('button', { name: 'Close Confirm install' });
    await waitFor(() => expect(document.activeElement).toBe(closeButton));
    closeButton.focus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(invoker);

    await user.click(invoker);
    const reopened = await screen.findByRole('dialog', { name: 'Confirm install' });
    fireEvent.keyDown(reopened, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(session.globalState.read(['closeReason'])).toBe('escape');
    expect(document.activeElement).toBe(invoker);

    await user.click(invoker);
    expect(session.feedback.snapshot('confirm', 'dialog')?.open).toBe(true);
    await session.navigation.navigate('replace', 'detail', {});
    expect(session.feedback.snapshot('confirm', 'dialog')).toBeUndefined();
  });

  it('publishes validated contracts and runnable examples for the complete feedback family', () => {
    for (const type of ['ProgressIndicator', 'Skeleton', 'EmptyState', 'ErrorState', 'Banner', 'Toast', 'Dialog']) {
      const contract = foundationCatalog.widgets[type];
      expect(contract, `${type} contract`).toBeTruthy();
      expect(validateRuntime(documentWith(contract.example), foundationCatalog), type).toMatchObject({ success: true });
    }
  });
});
