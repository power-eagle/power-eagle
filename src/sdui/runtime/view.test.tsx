// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { Json, RuntimeDocument, WidgetContract } from '../schema/model';
import { Column, Text } from '../authoring/foundation';
import { foundationRuntimeCatalog } from './foundation';
import { RuntimeSession, type RuntimeCatalog } from './session';
import { RuntimeView } from './view';

const tagged = (value: unknown) => value as Json;
const buttonContract: WidgetContract = {
  properties: { type: 'object', properties: { label: { type: 'string' } }, required: ['label'] }, defaults: {}, slots: {},
  events: { press: { type: 'null' } }, themeHooks: [], example: { type: 'TestButton', props: { label: 'test' } },
};
const catalog: RuntimeCatalog = { widgets: {
  ...foundationRuntimeCatalog.widgets,
  TestButton: { contract: buttonContract, render: ({ props, events }) => <button type="button" onClick={() => void events.press(null)}>{String(props.label)}</button> },
} };
const countLabel = tagged({ $expr: { op: 'format', args: ['{0}:{1}', tagged({ $ref: { scope: 'input', path: ['item', 'label'] } }), tagged({ $ref: { scope: 'state', path: ['count'] } })] } });
const increment = tagged({ $expr: { op: 'add', args: [tagged({ $ref: { scope: 'state', path: ['count'] } }), 1] } });
const document: RuntimeDocument = {
  format: 'power-eagle/runtime', formatVersion: 1, start: 'home', dependencies: [], actions: {},
  state: { items: { schema: { type: 'json' }, initial: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }] } },
  components: { Item: {
    inputs: { type: 'object', properties: { item: { type: 'json' } }, required: ['item'] },
    slots: {}, state: { count: { schema: { type: 'number', integer: true }, initial: 0 } },
    body: { type: 'TestButton', props: { label: countLabel }, events: { press: { kind: 'set', path: ['count'], value: increment } } },
  } },
  screens: { home: {
    params: { type: 'object', properties: {}, required: [] }, state: {},
    body: Column.node({}, { slots: { children: [{
      type: 'component:Item', props: { item: tagged({ $ref: { scope: 'item', path: [] } }) },
      repeat: { items: tagged({ $ref: { scope: 'state', path: ['items'] } }), key: tagged({ $ref: { scope: 'item', path: ['id'] } }) },
      empty: Text.node({ text: 'No items' }),
    }] } }),
  } },
};
afterEach(cleanup);
describe('registry renderer and keyed component identity', () => {
  it('keeps local state with item keys through reorder and disposes removed instances', async () => {
    const session = new RuntimeSession(document, catalog);
    const user = userEvent.setup();
    render(<RuntimeView session={session} />);
    await user.click(screen.getByRole('button', { name: 'Alpha:0' }));
    expect(screen.getByRole('button', { name: 'Alpha:1' })).toBeTruthy();
    const alpha = [...session.debugInstances().entries()].find(([key]) => key.includes('repeat:a'))![1];
    session.globalState.write(['items'], [{ id: 'b', label: 'Beta' }, { id: 'a', label: 'Alpha' }]);
    await waitFor(() => expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual(['Beta:0', 'Alpha:1']));
    session.globalState.write(['items'], [{ id: 'b', label: 'Beta' }]);
    await waitFor(() => expect(screen.queryByText('Alpha:1')).toBeNull());
    expect(alpha.disposed).toBe(true);
    session.globalState.write(['items'], []);
    await waitFor(() => expect(screen.getByText('No items')).toBeTruthy());
    expect(session.debugInstances().size).toBe(0);
    await session.dispose();
  });

  it('does not run event actions while resolving or rendering', async () => {
    const session = new RuntimeSession(document, catalog);
    render(<RuntimeView session={session} />);
    expect([...session.debugInstances().values()].every(scope => scope.read(['count']) === 0)).toBe(true);
    await session.dispose();
  });
});
