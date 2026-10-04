import { back, defineDocument, expression, forEach, navigate, parallel, ref, run, sequence, set } from '../../src/sdui/authoring';
import { Button, Column, Text } from '../../src/sdui/authoring/foundation';

const count = ref<number>('state', 'count');
export default defineDocument({
  format: 'power-eagle/runtime', formatVersion: 1, start: 'home', dependencies: [], components: {},
  state: {
    count: { schema: { type: 'number', integer: true, minimum: 0 }, initial: 0 },
    message: { schema: { type: 'string' }, initial: 'Ready' },
    items: { schema: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' } }, required: ['id', 'label'] } }, initial: [
      { id: 'widgets', label: 'Declarative widgets' }, { id: 'packages', label: 'Composable packages' },
    ] },
  },
  actions: {
    increment: sequence(
      set('count', expression<number>('add', count, 1)),
      set('message', expression<string>('format', 'Sequence result: {0}', ref('result'))),
    ),
    reset: parallel(set('count', 0), set('message', 'Reset in parallel')),
  },
  screens: {
    home: {
      params: { type: 'object', properties: {}, required: [] }, state: {},
      body: Column.node({ gap: 12 }, { slots: { children: [
        Text.node({ text: expression<string>('format', 'Count: {0}', count) }),
        Text.node({ text: ref<string>('state', 'message') }),
        Text.node({ text: expression<string>('format', 'Increment status: {0}', ref('action', 'increment', 'status')) }),
        Button.node({ label: 'Increment' }, { events: { press: run('increment') } }),
        Button.node({ label: 'Reset' }, { events: { press: run('reset') } }),
        forEach(Text.node({ text: ref<string>('item', 'label') }), ref('state', 'items'), ref('item', 'id'), Text.node({ text: 'Nothing here' })),
        Button.node({ label: 'Open details' }, { events: { press: navigate('detail', { fromCount: count }) } }),
      ] } }),
    },
    detail: {
      params: { type: 'object', properties: { fromCount: { type: 'number' } }, required: ['fromCount'] },
      state: { note: { schema: { type: 'string' }, initial: 'Screen-local state is restored after back.' } },
      body: Column.node({}, { slots: { children: [
        Text.node({ text: expression<string>('format', 'Opened at count {0}', ref('params', 'fromCount')) }),
        Text.node({ text: ref<string>('state', 'note') }),
        Button.node({ label: 'Back' }, { events: { press: back() } }),
      ] } }),
    },
  },
});
