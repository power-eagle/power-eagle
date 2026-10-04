import type { WidgetContract } from '../schema/model';
import { defineWidget } from './index';

const string = { type: 'string' as const };
const nonnegative = { type: 'number' as const, minimum: 0 };
const child = { child: { cardinality: 'one' as const, required: true } };
const textVariant = { type: 'enum' as const, values: ['body', 'title', 'rowName', 'small', 'label', 'meta', 'code'] };
const textAlign = { type: 'enum' as const, values: ['start', 'center', 'end', 'justify'] };
const textWrap = { type: 'enum' as const, values: ['wrap', 'nowrap', 'preserve'] };
const textProperties = {
  text: string, variant: textVariant, align: textAlign, wrap: textWrap,
  maxLines: { type: 'number' as const, minimum: 1, integer: true }, semanticLabel: string,
};

export const Text = defineWidget('Text', {
  properties: { type: 'object', properties: textProperties, required: ['text'] },
  defaults: { variant: 'body', align: 'start', wrap: 'wrap' }, slots: {}, events: {}, themeHooks: ['text'],
  example: { type: 'Text', props: { text: 'Plain declarative text' } },
});

const richSpan = {
  type: 'object' as const,
  properties: {
    text: string,
    tone: { type: 'enum' as const, values: ['default', 'muted', 'primary', 'destructive'] },
    weight: { type: 'enum' as const, values: ['normal', 'medium', 'semibold'] },
    italic: { type: 'boolean' as const },
    decoration: { type: 'enum' as const, values: ['none', 'underline', 'lineThrough'] },
    code: { type: 'boolean' as const },
  },
  required: ['text'] as ['text'],
};
export const RichText = defineWidget('RichText', {
  properties: {
    type: 'object', properties: {
      spans: { type: 'array', items: richSpan }, align: textAlign,
      maxLines: { type: 'number', minimum: 1, integer: true }, semanticLabel: string,
    }, required: ['spans'],
  },
  defaults: { align: 'start' }, slots: {}, events: {}, themeHooks: ['text', 'richText'],
  example: { type: 'RichText', props: { spans: [{ text: 'Status: ' }, { text: 'active', tone: 'primary', weight: 'semibold' }] } },
});

export const SelectableText = defineWidget('SelectableText', {
  properties: { type: 'object', properties: textProperties, required: ['text'] },
  defaults: { variant: 'code', align: 'start', wrap: 'preserve' }, slots: {}, events: {}, themeHooks: ['text', 'selectable'],
  example: { type: 'SelectableText', props: { text: 'example.package/widget' } },
});

export const Markdown = defineWidget('Markdown', {
  properties: {
    type: 'object', properties: { text: string, allowLinks: { type: 'boolean' } }, required: ['text'],
  },
  defaults: { allowLinks: true }, slots: {}, events: {}, themeHooks: ['text', 'markdown'],
  example: { type: 'Markdown', props: { text: '## Safe Markdown\n\nRaw HTML is filtered; **formatting** remains.' } },
});

export const CodeBlock = defineWidget('CodeBlock', {
  properties: {
    type: 'object', properties: {
      code: string, language: string, label: string, wrap: { type: 'boolean' }, lineNumbers: { type: 'boolean' },
    }, required: ['code'],
  },
  defaults: { wrap: false, lineNumbers: false }, slots: {}, events: {}, themeHooks: ['text', 'code'],
  example: { type: 'CodeBlock', props: { code: 'const ready = true;', language: 'typescript', lineNumbers: true } },
});

export const Image = defineWidget('Image', {
  properties: {
    type: 'object', properties: {
      src: string, alt: string, width: nonnegative, height: nonnegative,
      fit: { type: 'enum', values: ['fill', 'contain', 'cover', 'none', 'scaleDown'] },
      loading: { type: 'enum', values: ['eager', 'lazy'] }, failureText: string,
    }, required: ['src', 'alt'],
  },
  defaults: { fit: 'contain', loading: 'lazy', failureText: 'Image unavailable' },
  slots: { failure: { cardinality: 'one', required: false } },
  events: { load: { type: 'null' }, error: { type: 'object', properties: { src: string }, required: ['src'] } },
  themeHooks: ['image'],
  example: { type: 'Image', props: { src: 'assets/preview.png', alt: 'Preview', fit: 'cover' } },
});

export const iconNames = [
  'image', 'file', 'folder', 'search', 'settings', 'info', 'alert', 'check', 'close', 'plus', 'minus',
  'chevronDown', 'chevronRight', 'copy', 'download', 'upload', 'externalLink', 'code', 'sparkles',
] as const;
export const Icon = defineWidget('Icon', {
  properties: {
    type: 'object', properties: {
      name: { type: 'enum', values: [...iconNames] }, size: { type: 'number', minimum: 8, maximum: 96 },
      strokeWidth: { type: 'number', minimum: 1, maximum: 4 }, semanticLabel: string,
    }, required: ['name'],
  },
  defaults: { size: 20, strokeWidth: 2 }, slots: {}, events: {}, themeHooks: ['icon'],
  example: { type: 'Icon', props: { name: 'sparkles', semanticLabel: 'Generated', size: 20 } },
});

export const Badge = defineWidget('Badge', {
  properties: {
    type: 'object', properties: {
      text: string, variant: { type: 'enum', values: ['default', 'secondary', 'destructive', 'outline'] },
    }, required: ['text'],
  },
  defaults: { variant: 'outline' }, slots: {}, events: {}, themeHooks: ['badge'],
  example: { type: 'Badge', props: { text: 'widget', variant: 'outline' } },
});

export const Divider = defineWidget('Divider', {
  properties: {
    type: 'object', properties: {
      orientation: { type: 'enum', values: ['horizontal', 'vertical'] }, decorative: { type: 'boolean' },
    }, required: [],
  },
  defaults: { orientation: 'horizontal', decorative: true }, slots: {}, events: {}, themeHooks: ['divider'],
  example: { type: 'Divider', props: { orientation: 'horizontal', decorative: false } },
});

export const Card = defineWidget('Card', {
  properties: {
    type: 'object', properties: { title: string, description: string }, required: [],
  },
  defaults: {}, slots: { ...child, footer: { cardinality: 'one', required: false } }, events: {}, themeHooks: ['card'],
  example: { type: 'Card', props: { title: 'Package' }, slots: { child: { type: 'Text', props: { text: 'Composable content' } } } },
});

export const Tooltip = defineWidget('Tooltip', {
  properties: {
    type: 'object', properties: {
      message: string, side: { type: 'enum', values: ['top', 'right', 'bottom', 'left'] },
      delay: { type: 'number', minimum: 0, integer: true },
    }, required: ['message'],
  },
  defaults: { side: 'top', delay: 200 }, slots: child, events: {}, themeHooks: ['tooltip'],
  example: { type: 'Tooltip', props: { message: 'Inspect package' }, slots: { child: { type: 'Text', props: { text: 'Focus or hover' } } } },
});

export const contentWidgets = { Text, RichText, SelectableText, Markdown, CodeBlock, Image, Icon, Badge, Divider, Card, Tooltip } as const;
export const contentContracts: Record<string, WidgetContract> = Object.fromEntries(
  Object.entries(contentWidgets).map(([type, widget]) => [type, widget.contract]),
);
