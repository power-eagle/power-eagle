// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
  GridView, ListView, ScrollView, Text, VirtualGrid, VirtualList,
} from '../authoring/foundation';
import { forEach, ref, set } from '../authoring';
import type { Json, Node, RuntimeDocument, WidgetContract } from '../schema/model';
import { validateRuntime } from '../schema/validate';
import { foundationRuntimeCatalog } from './foundation';
import { RuntimeSession, type RuntimeCatalog } from './session';
import { RuntimeView } from './view';

const tagged = (value: unknown) => value as Json;
const itemsRef = ref<Json[]>('state', 'items');
const selectedRef = ref<string[]>('state', 'selected');
const itemIdRef = ref<string>('item', 'id');
const itemLabelRef = ref<string>('item', 'label');
const fixtures = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `item-${index}`, label: `Item ${index}` }));
const sessions: RuntimeSession[] = [];

function documentWith(body: Node, items: Json = []): RuntimeDocument {
  return {
    format: 'power-eagle/runtime', formatVersion: 1, start: 'home', dependencies: [], actions: {}, components: {},
    state: {
      items: { schema: { type: 'json' }, initial: items },
      selected: { schema: { type: 'array', items: { type: 'string' } }, initial: [] },
      scroll: { schema: { type: 'json' }, initial: null },
    },
    screens: { home: { params: { type: 'object', properties: {}, required: [] }, state: {}, body } },
  };
}

function repeated(type = 'Text'): Node {
  return forEach({ type, props: { [type === 'Text' ? 'text' : 'label']: tagged(itemLabelRef) } }, tagged(itemsRef), tagged(itemIdRef));
}

function renderDocument(document: RuntimeDocument, catalog: RuntimeCatalog = foundationRuntimeCatalog) {
  const session = new RuntimeSession(document, catalog);
  sessions.push(session);
  return { session, ...render(<RuntimeView session={session} />) };
}

afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
});

describe('collection widget family', () => {
  it('keeps selection attached to stable keys across reorder and renders declared empty content', async () => {
    const body = ListView.node({
      label: 'Packages', selectionMode: 'multiple', selection: selectedRef,
    }, { slots: {
      children: [repeated()], empty: Text.node({ text: 'No packages installed' }),
    }, events: { selectionChange: set('selected', tagged(ref('event'))) } });
    const { session, container } = renderDocument(documentWith(body, [
      { id: 'alpha', label: 'Alpha' }, { id: 'beta', label: 'Beta' }, { id: 'gamma', label: 'Gamma' },
    ]));
    const user = userEvent.setup();

    await user.click(container.querySelector<HTMLElement>('[data-pe-key="beta"]')!);
    await waitFor(() => expect(session.globalState.read(['selected'])).toEqual(['beta']));
    expect(container.querySelector('[data-pe-key="beta"]')?.getAttribute('aria-selected')).toBe('true');

    session.globalState.write(['items'], [
      { id: 'gamma', label: 'Gamma' }, { id: 'alpha', label: 'Alpha' }, { id: 'beta', label: 'Beta' },
    ]);
    await waitFor(() => expect([...container.querySelectorAll('[data-pe-key]')].map(item => item.getAttribute('data-pe-key'))).toEqual(['gamma', 'alpha', 'beta']));
    expect(container.querySelector('[data-pe-key="beta"]')?.getAttribute('aria-selected')).toBe('true');

    session.globalState.write(['items'], []);
    await waitFor(() => expect(screen.getByText('No packages installed')).toBeTruthy());
    expect(container.querySelectorAll('[data-pe-collection-item]')).toHaveLength(0);
  });

  it('reports scrolling and provides keyboard selection and activation for list and grid layouts', async () => {
    const body = ScrollView.node({ direction: 'vertical', height: 64 }, {
      slots: { children: [
        GridView.node({ label: 'Selectable grid', columns: 2, selectionMode: 'single', selection: selectedRef }, {
          slots: { children: [
            Text.node({ text: 'Alpha' }, { key: 'alpha' }), Text.node({ text: 'Beta' }, { key: 'beta' }),
            Text.node({ text: 'Gamma' }, { key: 'gamma' }),
          ] }, events: { selectionChange: set('selected', tagged(ref('event'))), activate: set('activated', tagged(ref('event'))) },
        }),
      ] }, events: { scroll: set('scroll', tagged(ref('event'))) },
    });
    const document = documentWith(body);
    document.state.activated = { schema: { type: 'string' }, initial: '' };
    const { session } = renderDocument(document);
    const user = userEvent.setup();
    const grid = screen.getByRole('listbox', { name: 'Selectable grid' });

    grid.focus();
    await user.keyboard('{ArrowRight} ');
    await waitFor(() => expect(session.globalState.read(['selected'])).toEqual(['beta']));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(session.globalState.read(['activated'])).toBe('beta'));

    const scroll = screen.getByText('Alpha').closest('[data-pe-widget="ScrollView"]') as HTMLElement;
    Object.defineProperty(scroll, 'scrollTop', { configurable: true, value: 32, writable: true });
    Object.defineProperty(scroll, 'scrollLeft', { configurable: true, value: 4, writable: true });
    fireEvent.scroll(scroll);
    await waitFor(() => expect(session.globalState.read(['scroll'])).toEqual({ x: 4, y: 32 }));
  });

  it('limits a five-thousand-item virtual list to its viewport while revealing the correct keyed item', async () => {
    let renders = 0;
    const probeContract: WidgetContract = {
      properties: { type: 'object', properties: { label: { type: 'string' } }, required: ['label'] },
      defaults: {}, slots: {}, events: {}, themeHooks: ['collection'],
      example: { type: 'Probe', props: { label: 'Probe' } },
    };
    const catalog: RuntimeCatalog = { widgets: {
      ...foundationRuntimeCatalog.widgets,
      Probe: { contract: probeContract, render: ({ props }) => { renders += 1; return <span>{String(props.label)}</span>; } },
    } };
    const body = VirtualList.node({
      label: 'Five thousand rows', height: 120, itemExtent: 24, overscan: 2,
      selectionMode: 'single', selection: selectedRef,
    }, { slots: {
      children: [repeated('Probe')], empty: Text.node({ text: 'No rows' }),
    }, events: { selectionChange: set('selected', tagged(ref('event'))) } });
    const { session, container } = renderDocument(documentWith(body, fixtures(5000)), catalog);
    const list = screen.getByRole('listbox', { name: 'Five thousand rows' });

    expect(container.querySelectorAll('[data-pe-collection-item]').length).toBeLessThanOrEqual(10);
    expect(renders).toBeLessThanOrEqual(10);
    expect(screen.queryByText('Item 4000')).toBeNull();
    Object.defineProperty(list, 'scrollTop', { configurable: true, value: 4000 * 24, writable: true });
    fireEvent.scroll(list);
    await waitFor(() => expect(screen.getByText('Item 4000')).toBeTruthy());
    expect(container.querySelectorAll('[data-pe-collection-item]').length).toBeLessThanOrEqual(10);

    await userEvent.setup().click(container.querySelector<HTMLElement>('[data-pe-key="item-4000"]')!);
    await waitFor(() => expect(session.globalState.read(['selected'])).toEqual(['item-4000']));
    expect(container.querySelector('[data-pe-key="item-4000"]')?.getAttribute('aria-selected')).toBe('true');
  });

  it('bounds virtual grid rendering by visible rows and updates the window on scroll', async () => {
    const body = VirtualGrid.node({
      label: 'Four thousand tiles', height: 120, columns: 4, rowExtent: 32, gap: 4, overscan: 1,
      selectionMode: 'multiple', selection: [],
    }, { slots: { children: [repeated()], empty: Text.node({ text: 'No tiles' }) } });
    const { container } = renderDocument(documentWith(body, fixtures(4000)));
    const grid = screen.getByRole('listbox', { name: 'Four thousand tiles' });

    expect(container.querySelectorAll('[data-pe-collection-item]').length).toBeLessThanOrEqual(28);
    Object.defineProperty(grid, 'scrollTop', { configurable: true, value: 500 * 36, writable: true });
    fireEvent.scroll(grid);
    await waitFor(() => expect(screen.getByText('Item 2000')).toBeTruthy());
    expect(container.querySelectorAll('[data-pe-collection-item]').length).toBeLessThanOrEqual(28);
  });

  it('publishes validated contracts and runnable examples for every first collection checkpoint type', () => {
    const document = documentWith(ListView.node({ label: 'Empty list' }, {
      slots: { children: [], empty: Text.node({ text: 'Nothing here' }) },
    }));
    expect(validateRuntime(document, {
      widgets: Object.fromEntries(Object.entries(foundationRuntimeCatalog.widgets).map(([type, item]) => [type, item.contract])),
    }).success).toBe(true);
    expect(Object.keys(foundationRuntimeCatalog.widgets)).toEqual(expect.arrayContaining([
      'ScrollView', 'ListView', 'GridView', 'VirtualList', 'VirtualGrid',
    ]));
  });
});
