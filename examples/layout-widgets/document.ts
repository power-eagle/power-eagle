import { defineDocument } from '../../src/sdui/authoring';
import {
  Align, AspectRatio, Center, Column, ConstrainedBox, Expanded, Flexible, Padding, Positioned, Row, SizedBox, Spacer, Stack, Wrap,
} from '../../src/sdui/authoring/layout';
import { Text } from '../../src/sdui/authoring/foundation';

const label = (text: string) => Padding.node({ horizontal: 8, vertical: 4 }, {
  slots: { child: Text.node({ text }) }, style: { border: '1px solid var(--input)' },
});

export default defineDocument({
  format: 'power-eagle/runtime', formatVersion: 1, start: 'home', dependencies: [], state: {}, components: {}, actions: {},
  screens: {
    home: {
      params: { type: 'object', properties: {}, required: [] }, state: {},
      body: Column.node({ gap: 16, crossAxisAlignment: 'stretch' }, { slots: { children: [
        Text.node({ text: 'Layout vocabulary' }),
        Row.node({ gap: 8 }, { slots: { children: [
          label('fixed'),
          Expanded.node({ flex: 2 }, { slots: { child: label('expanded ×2') } }),
          Spacer.node({ flex: 1 }),
          Flexible.node({ flex: 1, fit: 'loose' }, { slots: { child: label('flexible') } }),
        ] } }),
        Wrap.node({ gap: 8, runGap: 8, alignment: 'spaceBetween' }, { slots: { children: [
          SizedBox.node({ width: 92, height: 32 }, { slots: { child: Center.node({}, { slots: { child: Text.node({ text: '92 × 32' }) } }) } }),
          SizedBox.node({ width: 116, height: 32 }, { slots: { child: Center.node({}, { slots: { child: Text.node({ text: '116 × 32' }) } }) } }),
          SizedBox.node({ width: 140, height: 32 }, { slots: { child: Center.node({}, { slots: { child: Text.node({ text: '140 × 32' }) } }) } }),
        ] } }),
        ConstrainedBox.node({ minWidth: 240, maxWidth: 520, minHeight: 160, maxHeight: 240 }, { slots: { child:
          SizedBox.node({ height: 180 }, { slots: { child: Stack.node({ alignment: 'bottomRight', overflow: 'hidden' }, { slots: { children: [
            Align.node({ alignment: 'center' }, { slots: { child:
              AspectRatio.node({ aspectRatio: 1.7777777778 }, { slots: { child: Center.node({}, { slots: { child: Text.node({ text: '16:9' }) } }) } }),
            } }),
            Positioned.node({ left: 12, top: 12 }, { slots: { child: label('positioned') } }),
            Padding.node({ all: 12 }, { slots: { child: Text.node({ text: 'bottom right' }) } }),
          ] } }) } }),
        } }),
      ] } }),
    },
  },
});
