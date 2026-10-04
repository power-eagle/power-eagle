import { defineComponent, defineDocument, ref } from '../../src/sdui/authoring';
import { Column, Text } from '../../src/sdui/authoring/foundation';

const Note = defineComponent('Note', {
  inputs: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
  slots: { content: { cardinality: 'one', required: true } },
  state: { count: { schema: { type: 'number', integer: true }, initial: 0 } },
  body: Column.node({}, { slots: { children: [Text.node({ text: ref<string>('input', 'title') }), { type: 'slot:content' }] } }),
});
export default defineDocument({
  format: 'power-eagle/runtime', formatVersion: 1, start: 'home', state: {}, actions: {}, dependencies: [],
  components: { Note: Note.definition },
  screens: { home: {
    params: { type: 'object', properties: {}, required: [] }, state: {},
    body: Column.node({ gap: 24 }, { slots: { children: [
      Note.instance('first', { title: 'Power Eagle' }, { content: Text.node({ text: 'A new declarative language.' }) }),
      Note.instance('second', { title: 'Composable packages' }, { content: Text.node({ text: 'Runtime, widgets, styling, actions, and services can be mixed.' }) }),
    ] } }),
  } },
});
