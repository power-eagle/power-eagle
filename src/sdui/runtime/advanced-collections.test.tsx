// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DataTable, PropertyGrid, ReorderableList, Text, TreeView, foundationCatalog,
} from '../authoring/foundation';
import { forEach, ref, sequence, set } from '../authoring';
import type { Json, Node, RuntimeDocument } from '../schema/model';
import { validateRuntime } from '../schema/validate';
import { foundationRuntimeCatalog } from './foundation';
import { RuntimeSession } from './session';
import { RuntimeView } from './view';

const tagged = (value: unknown) => value as Json;
const sessions: RuntimeSession[] = [];

function documentWith(body: Node, state: RuntimeDocument['state']): RuntimeDocument {
  return {
    format: 'power-eagle/runtime', formatVersion: 1, start: 'home', dependencies: [], actions: {}, components: {}, state,
    screens: { home: { params: { type: 'object', properties: {}, required: [] }, state: {}, body } },
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

describe('advanced collection widgets', () => {
  it('emits stable reordered identities from keyboard and drag operations', async () => {
    const item = forEach(Text.node({ text: ref<string>('item', 'label') }), tagged(ref('state', 'items')), tagged(ref('item', 'id')));
    const body = ReorderableList.node({ label: 'Priority', selectionMode: 'none', selection: [] }, {
      slots: { children: [item], empty: Text.node({ text: 'No priorities' }) },
      events: { reorder: set('order', tagged(ref('event'))) },
    });
    const { session, container } = renderDocument(documentWith(body, {
      items: { schema: { type: 'json' }, initial: [
        { id: 'alpha', label: 'Alpha' }, { id: 'beta', label: 'Beta' }, { id: 'gamma', label: 'Gamma' },
      ] },
      order: { schema: { type: 'array', items: { type: 'string' } }, initial: [] },
    }));
    const list = screen.getByRole('list', { name: 'Priority' });
    list.focus();
    fireEvent.keyDown(list, { key: 'ArrowDown', altKey: true });
    await waitFor(() => expect(session.globalState.read(['order'])).toEqual(['beta', 'alpha', 'gamma']));

    fireEvent.dragStart(container.querySelector<HTMLElement>('[data-pe-key="alpha"]')!);
    fireEvent.drop(container.querySelector<HTMLElement>('[data-pe-key="gamma"]')!);
    await waitFor(() => expect(session.globalState.read(['order'])).toEqual(['beta', 'gamma', 'alpha']));
  });

  it('expands a flat typed tree and selects hierarchical identities from the keyboard', async () => {
    const body = TreeView.node({
      label: 'Package tree', items: ref('state', 'tree'), expanded: ref<string[]>('state', 'expanded'),
      selection: ref<string[]>('state', 'selected'), selectionMode: 'single',
    }, { events: {
      expandedChange: set('expanded', tagged(ref('event'))), selectionChange: set('selected', tagged(ref('event'))),
    } });
    const { session } = renderDocument(documentWith(body, {
      tree: { schema: { type: 'json' }, initial: [
        { id: 'root', label: 'Package' }, { id: 'runtime', label: 'Runtime', parentId: 'root' },
        { id: 'widgets', label: 'Widgets', parentId: 'root' }, { id: 'forms', label: 'Forms', parentId: 'widgets' },
      ] },
      expanded: { schema: { type: 'array', items: { type: 'string' } }, initial: [] },
      selected: { schema: { type: 'array', items: { type: 'string' } }, initial: [] },
    }));
    const tree = screen.getByRole('tree', { name: 'Package tree' });
    tree.focus();
    fireEvent.keyDown(tree, { key: 'ArrowRight' });
    await waitFor(() => expect(session.globalState.read(['expanded'])).toEqual(['root']));
    expect(screen.getByRole('treeitem', { name: 'Runtime' }).getAttribute('aria-level')).toBe('2');

    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    fireEvent.keyDown(tree, { key: ' ' });
    await waitFor(() => expect(session.globalState.read(['selected'])).toEqual(['runtime']));
    expect(screen.getByRole('treeitem', { name: 'Runtime' }).getAttribute('aria-selected')).toBe('true');
  });

  it('sorts typed table columns while retaining controlled row selection by identity', async () => {
    const body = DataTable.node({
      label: 'Packages', rows: ref('state', 'rows'), columns: [
        { key: 'name', label: 'Name', type: 'string', sortable: true },
        { key: 'rank', label: 'Rank', type: 'number', sortable: true, align: 'end' },
      ], rowKey: 'id', selectionMode: 'single', selection: ref<string[]>('state', 'selected'),
      sortColumn: ref<string>('state', 'sortColumn'), sortDirection: ref<'ascending' | 'descending'>('state', 'sortDirection'),
    }, { events: {
      selectionChange: set('selected', tagged(ref('event'))),
      sortChange: sequence(
        set('sortColumn', tagged(ref('event', 'column'))),
        set('sortDirection', tagged(ref('event', 'direction'))),
      ),
    } });
    const { session } = renderDocument(documentWith(body, {
      rows: { schema: { type: 'json' }, initial: [
        { id: 'alpha', name: 'Alpha', rank: 10 }, { id: 'beta', name: 'Beta', rank: 2 },
      ] },
      selected: { schema: { type: 'array', items: { type: 'string' } }, initial: [] },
      sortColumn: { schema: { type: 'string' }, initial: '' },
      sortDirection: { schema: { type: 'enum', values: ['ascending', 'descending'] }, initial: 'ascending' },
    }));
    const user = userEvent.setup();
    await user.click(screen.getByText('Beta'));
    await waitFor(() => expect(session.globalState.read(['selected'])).toEqual(['beta']));

    await user.click(screen.getByRole('button', { name: 'Rank' }));
    const rows = within(screen.getByRole('table', { name: 'Packages' })).getAllByRole('row').slice(1);
    expect(rows.map(row => within(row).getAllByRole('cell')[0].textContent)).toEqual(['Beta', 'Alpha']);
    expect(rows[0].getAttribute('data-row-id')).toBe('beta');
    expect(rows[0].getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('columnheader', { name: 'Rank' }).getAttribute('aria-sort')).toBe('ascending');
  });

  it('emits typed property edits and keeps read-only values out of editor controls', async () => {
    const body = PropertyGrid.node({ label: 'Settings', columns: 2, items: [
      { id: 'retries', label: 'Retries', value: 2, editor: 'number', editable: true },
      { id: 'enabled', label: 'Enabled', value: true, editor: 'boolean', editable: true },
      { id: 'channel', label: 'Channel', value: 'stable', editor: 'select', editable: true, options: [
        { value: 'stable', label: 'Stable' }, { value: 'preview', label: 'Preview' },
      ] },
      { id: 'version', label: 'Version', value: '1.0.0', description: 'Read only' },
    ] }, { events: { change: set('lastChange', tagged(ref('event'))) } });
    const { session } = renderDocument(documentWith(body, {
      lastChange: { schema: { type: 'json' }, initial: null },
    }));
    const user = userEvent.setup();

    fireEvent.change(screen.getByLabelText('Retries'), { target: { value: '7' } });
    await waitFor(() => expect(session.globalState.read(['lastChange'])).toEqual({ id: 'retries', value: 7 }));
    await user.click(screen.getByLabelText('Enabled'));
    await waitFor(() => expect(session.globalState.read(['lastChange'])).toEqual({ id: 'enabled', value: false }));
    await user.selectOptions(screen.getByLabelText('Channel'), 'preview');
    await waitFor(() => expect(session.globalState.read(['lastChange'])).toEqual({ id: 'channel', value: 'preview' }));
    expect(screen.getByText('1.0.0').tagName).toBe('OUTPUT');
    expect(screen.queryByDisplayValue('1.0.0')).toBeNull();
  });

  it('publishes validated schemas and runnable examples for every advanced collection type', () => {
    expect(Object.keys(foundationCatalog.widgets)).toEqual(expect.arrayContaining([
      'ReorderableList', 'TreeView', 'DataTable', 'PropertyGrid',
    ]));
    for (const type of ['ReorderableList', 'TreeView', 'DataTable', 'PropertyGrid']) {
      const contract = foundationCatalog.widgets[type];
      const document = documentWith(contract.example, {});
      expect(validateRuntime(document, foundationCatalog), type).toMatchObject({ success: true });
    }
  });
});
