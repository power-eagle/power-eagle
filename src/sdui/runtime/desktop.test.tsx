// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { navigate, ref, set } from '../authoring';
import {
  Accordion, Breadcrumbs, Button, ContextMenu, IconButton, Menu, SegmentedControl, SplitPane, Tabs,
} from '../authoring/desktop';
import { Column } from '../authoring/layout';
import { Text } from '../authoring/content';
import { foundationCatalog } from '../authoring/foundation';
import type { Json, RuntimeDocument } from '../schema/model';
import { validateRuntime } from '../schema/validate';
import { foundationRuntimeCatalog } from './foundation';
import { RuntimeSession } from './session';
import { RuntimeView } from './view';

const value = <T extends Json>(name: string) => ref<T>('state', name);
const change = (name: string) => set(name, ref('event'));
const sessions: RuntimeSession[] = [];

afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
});

const runtimeDocument: RuntimeDocument = {
  format: 'power-eagle/runtime', formatVersion: 1, start: 'home', dependencies: [], components: {}, actions: {},
  state: {
    pressed: { schema: { type: 'boolean' }, initial: false },
    iconPressed: { schema: { type: 'boolean' }, initial: false },
    density: { schema: { type: 'string' }, initial: 'compact' },
    tab: { schema: { type: 'string' }, initial: 'preview' },
    sections: { schema: { type: 'array', items: { type: 'string' } }, initial: [] },
    menuAction: { schema: { type: 'string' }, initial: '' },
    contextAction: { schema: { type: 'string' }, initial: '' },
    split: { schema: { type: 'number' }, initial: 50 },
    splitEnded: { schema: { type: 'number' }, initial: 50 },
  },
  screens: {
    home: {
      params: { type: 'object', properties: {}, required: [] }, state: {},
      body: Column.node({ gap: 8 }, { slots: { children: [
        Button.node({ label: 'Run action', variant: 'secondary' }, { events: { press: set('pressed', true) } }),
        IconButton.node({ icon: 'plus', label: 'Add item', selected: true, selectedIcon: 'check' }, { events: { press: set('iconPressed', true) } }),
        SegmentedControl.node({ label: 'Density', value: value<string>('density'), options: [
          { value: 'compact', label: 'Compact' }, { value: 'blocked', label: 'Blocked', disabled: true },
          { value: 'comfortable', label: 'Comfortable' },
        ] }, { events: { change: change('density') } }),
        Tabs.node({ label: 'Package view', value: value<string>('tab'), tabs: [
          { value: 'preview', label: 'Preview' }, { value: 'activation', label: 'Activation' },
        ] }, { events: { change: change('tab') }, slots: { children: [
          Text.node({ text: 'Preview panel' }), Text.node({ text: 'Activation panel' }),
        ] } }),
        Accordion.node({ label: 'Package sections', value: value<string[]>('sections'), multiple: true, items: [
          { id: 'details', label: 'Details' }, { id: 'dependencies', label: 'Dependencies' },
        ] }, { events: { change: change('sections') }, slots: { children: [
          Text.node({ text: 'Package metadata' }), Text.node({ text: 'No dependencies' }),
        ] } }),
        Menu.node({ label: 'Package actions', items: [
          { id: 'open', label: 'Open' }, { id: 'edit', label: 'Edit' }, { id: 'remove', label: 'Remove', destructive: true, separatorBefore: true },
        ] }, { events: { select: change('menuAction') } }),
        ContextMenu.node({ label: 'Package context actions', items: [
          { id: 'inspect', label: 'Inspect' }, { id: 'disable', label: 'Disable' },
        ] }, { events: { select: change('contextAction') }, slots: { child: Text.node({ text: 'Package row' }) } }),
        SplitPane.node({ label: 'Inspector split', value: value<number>('split'), minimumStart: 25, minimumEnd: 25, step: 5 }, {
          events: { resize: change('split'), resizeEnd: change('splitEnded') },
          slots: { start: Text.node({ text: 'Stage pane' }), end: Text.node({ text: 'Inspector pane' }) },
        }),
        Breadcrumbs.node({ label: 'Package location', items: [
          { id: 'home', label: 'Home', current: true }, { id: 'detail', label: 'Detail' },
        ] }, { events: { select: navigate('detail', { source: ref('event') }) } }),
      ] } }),
    },
    detail: {
      params: { type: 'object', properties: { source: { type: 'string' } }, required: ['source'] }, state: {},
      body: Text.node({ text: 'Detail screen' }),
    },
  },
};

describe('desktop interaction widget family', () => {
  it('keeps focus and selection predictable across buttons, tabs, accordions, and menus', async () => {
    expect(validateRuntime(runtimeDocument, foundationCatalog).success).toBe(true);
    const session = new RuntimeSession(runtimeDocument, foundationRuntimeCatalog);
    sessions.push(session);
    const user = userEvent.setup();
    const { container } = render(<RuntimeView session={session} />);

    await user.click(screen.getByRole('button', { name: 'Run action' }));
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(session.globalState.read(['pressed'])).toBe(true);
    expect(session.globalState.read(['iconPressed'])).toBe(true);

    const compact = screen.getByRole('radio', { name: 'Compact' });
    compact.focus();
    await user.keyboard('{ArrowRight}');
    expect(session.globalState.read(['density'])).toBe('comfortable');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Comfortable' }));

    const preview = screen.getByRole('tab', { name: 'Preview' });
    preview.focus();
    await user.keyboard('{ArrowRight}');
    expect(session.globalState.read(['tab'])).toBe('activation');
    expect(screen.getByRole('tabpanel', { name: 'Activation' }).textContent).toContain('Activation panel');

    const details = screen.getByRole('button', { name: /Details/u });
    await user.click(details);
    expect(session.globalState.read(['sections'])).toEqual(['details']);
    expect(screen.getByRole('region', { name: /Details/u }).hidden).toBe(false);
    details.focus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Dependencies/u }));
    expect(session.globalState.read(['sections'])).toEqual(['details', 'dependencies']);

    await user.click(screen.getByRole('button', { name: 'Package actions' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Open' })));
    await user.keyboard('{ArrowDown}{Enter}');
    expect(session.globalState.read(['menuAction'])).toBe('edit');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Package actions' })));

    const context = container.querySelector<HTMLElement>('[data-pe-widget="ContextMenu"]')!;
    context.focus();
    await user.keyboard('{Shift>}{F10}{/Shift}');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Inspect' })));
    await user.keyboard('{Enter}');
    expect(session.globalState.read(['contextAction'])).toBe('inspect');
  });

  it('clamps pointer and keyboard split resizing and executes breadcrumb navigation actions', async () => {
    const session = new RuntimeSession(runtimeDocument, foundationRuntimeCatalog);
    sessions.push(session);
    const user = userEvent.setup();
    const { container } = render(<RuntimeView session={session} />);
    const split = container.querySelector<HTMLElement>('[data-pe-widget="SplitPane"]')!;
    split.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 200, width: 400, height: 200, toJSON: () => ({}),
    });
    const divider = screen.getByRole('separator', { name: 'Inspector split' });

    fireEvent.pointerDown(divider, { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 390, pointerId: 1 });
    expect(session.globalState.read(['split'])).toBe(75);
    fireEvent.pointerUp(window, { clientX: 390, pointerId: 1 });
    expect(session.globalState.read(['splitEnded'])).toBe(75);

    divider.focus();
    await user.keyboard('{Home}{ArrowLeft}');
    expect(session.globalState.read(['split'])).toBe(25);
    await user.keyboard('{End}{ArrowRight}');
    expect(session.globalState.read(['split'])).toBe(75);

    await user.click(screen.getByRole('button', { name: 'Detail' }));
    await waitFor(() => expect(session.navigation.current.screen).toBe('detail'));
    expect(session.navigation.current.params).toEqual({ source: 'detail' });
    expect(screen.getByText('Detail screen')).toBeTruthy();
  });
});
