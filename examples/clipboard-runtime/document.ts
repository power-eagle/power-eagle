import { call, defineDocument, expression, ref, sequence, set } from '../../src/sdui/authoring';
import { Text } from '../../src/sdui/authoring/content';
import { Button } from '../../src/sdui/authoring/desktop';
import { TextField } from '../../src/sdui/authoring/forms';
import { Column, Row } from '../../src/sdui/authoring/layout';

const clipboard = 'power-eagle.clipboard/clipboard';

export default defineDocument({
  format: 'power-eagle/runtime', formatVersion: 1, start: 'home', components: {},
  dependencies: [{ package: 'power-eagle.clipboard', version: '^1.0.0', export: 'clipboard', kind: 'service' }],
  state: {
    draft: { schema: { type: 'string' }, initial: 'Power Eagle clipboard' },
    value: { schema: { type: 'string' }, initial: '' },
    status: { schema: { type: 'string' }, initial: 'Ready' },
  },
  actions: {
    copy: {
      ...call(clipboard, ref('state', 'draft'), 'write'),
      success: set('status', 'Copied through the clipboard service.'),
      error: set('status', ref('error', 'message')),
    },
    paste: {
      ...call(clipboard, null, 'read'),
      success: sequence(
        set('value', ref('result')),
        set('status', expression('format', 'Read: {0}', ref('state', 'value'))),
      ),
      error: set('status', ref('error', 'message')),
    },
  },
  screens: {
    home: {
      params: { type: 'object', properties: {}, required: [] }, state: {},
      body: Column.node({ gap: 12 }, { slots: { children: [
        Text.node({ text: 'Clipboard consumer', variant: 'title' }),
        TextField.node({ id: 'draft', label: 'Text', value: ref('state', 'draft') }, {
          events: { change: set('draft', ref('event')) },
        }),
        Row.node({ gap: 8 }, { slots: { children: [
          Button.node({ label: 'Copy' }, { events: { press: { kind: 'run', action: 'copy' } } }),
          Button.node({ label: 'Paste', variant: 'outline' }, { events: { press: { kind: 'run', action: 'paste' } } }),
        ] } }),
        Text.node({ text: ref('state', 'status'), variant: 'small' }),
      ] } }),
    },
  },
});
