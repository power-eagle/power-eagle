import { asset, defineDocument } from '../../src/sdui/authoring';
import { Badge, Card, CodeBlock, Divider, Icon, Image, Markdown, RichText, SelectableText, Text, Tooltip } from '../../src/sdui/authoring/content';
import { Column, Row, SizedBox } from '../../src/sdui/authoring/layout';

export default defineDocument({
  format: 'power-eagle/runtime', formatVersion: 1, start: 'home', dependencies: [], state: {}, components: {}, actions: {},
  screens: {
    home: {
      params: { type: 'object', properties: {}, required: [] }, state: {},
      body: Column.node({ gap: 12 }, { slots: { children: [
        Text.node({ text: 'Content vocabulary', variant: 'title' }),
        RichText.node({ spans: [
          { text: 'Runtime ', tone: 'muted' }, { text: 'active', tone: 'primary', weight: 'semibold' }, { text: ' · executable markup stays off', code: true },
        ] }),
        SelectableText.node({ text: 'example.content-widgets/main', variant: 'code' }),
        Divider.node({ decorative: false }),
        Markdown.node({ text: '### Markdown\n\n- **Typed** content\n- [Safe links](https://docs.stac.dev)\n- raw `<script>` markup is filtered' }),
        CodeBlock.node({ code: 'const packageState = "active";\nconsole.log(packageState);', language: 'typescript', label: 'provider.ts', lineNumbers: true }),
        Row.node({ gap: 8 }, { slots: { children: [
          Badge.node({ text: 'widget', variant: 'outline' }),
          Tooltip.node({ message: 'Compiled Lucide icon', side: 'right' }, { slots: { child: Icon.node({ name: 'sparkles', semanticLabel: 'Generated' }) } }),
        ] } }),
        Card.node({ title: 'Local asset', description: 'Package-relative images resolve through the runtime asset adapter.' }, { slots: {
          child: SizedBox.node({ width: 320, height: 160 }, { slots: {
            child: Image.node({ src: asset('assets/blueprint.svg'), alt: 'Blueprint grid with a framed amber signal', width: 320, height: 160, fit: 'cover' }),
          } }),
          footer: Text.node({ text: 'No remote font or image dependency.', variant: 'meta' }),
        } }),
      ] } }),
    },
  },
});
