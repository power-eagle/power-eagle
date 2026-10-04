/* eslint-disable react-refresh/only-export-components -- Runtime renderers are registered as component factories. */
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Check, ChevronDown, ChevronRight, CircleAlert, Code as CodeIcon, Copy, Download, ExternalLink, File, Folder,
  Image as ImageIcon, Info, Minus, Plus, Search, Settings, Sparkles, Upload, X, type LucideIcon,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge as UiBadge, Card as UiCard, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Separator } from '../../components/ui';
import {
  Badge, Card, CodeBlock, Divider, Icon, Image, Markdown, RichText, SelectableText, Text, Tooltip,
} from '../authoring/content';
import type { Json } from '../schema/model';
import type { WidgetDefinition } from './session';
import type { WidgetRenderProps } from './view';

const only = (slot: ReactNode): ReactNode => Array.isArray(slot) ? slot[0] : slot;
const string = (value: Json | undefined, fallback = ''): string => typeof value === 'string' ? value : fallback;
const number = (value: Json | undefined): number | undefined => typeof value === 'number' ? value : undefined;
const bool = (value: Json | undefined, fallback = false): boolean => typeof value === 'boolean' ? value : fallback;
const styled = (base: CSSProperties, style: CSSProperties): CSSProperties => ({ ...base, ...style });
const imageFits: Record<string, CSSProperties['objectFit']> = {
  fill: 'fill', contain: 'contain', cover: 'cover', none: 'none', scaleDown: 'scale-down',
};

function textStyle(props: Record<string, Json>): CSSProperties {
  const wrap = string(props.wrap, 'wrap');
  const maxLines = number(props.maxLines);
  return {
    textAlign: string(props.align, 'start') as CSSProperties['textAlign'],
    whiteSpace: wrap === 'preserve' ? 'pre-wrap' : wrap === 'nowrap' ? 'nowrap' : 'normal',
    overflowWrap: wrap === 'nowrap' ? 'normal' : 'anywhere',
    ...(maxLines === undefined ? {} : {
      display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: maxLines, overflow: 'hidden',
    }),
  };
}

function TextWidget({ props, style }: WidgetRenderProps) {
  const variant = string(props.variant, 'body');
  return <span
    data-pe-widget="Text"
    className={`pe-content-text pe-text-${variant}`}
    aria-label={string(props.semanticLabel) || undefined}
    style={styled(textStyle(props), style)}
  >{string(props.text)}</span>;
}

function RichTextWidget({ props, style }: WidgetRenderProps) {
  const spans = Array.isArray(props.spans) ? props.spans : [];
  return <span
    data-pe-widget="RichText"
    className="pe-content-text pe-text-body"
    aria-label={string(props.semanticLabel) || undefined}
    style={styled(textStyle(props), style)}
  >{spans.map((value, index) => {
    const span = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const tone = string(span.tone, 'default');
    const weight = string(span.weight, 'normal');
    const decoration = string(span.decoration, 'none');
    return <span
      key={index}
      className={`pe-rich-tone-${tone}${bool(span.code) ? ' pe-rich-code' : ''}`}
      style={{
        fontWeight: weight === 'semibold' ? 600 : weight === 'medium' ? 500 : 400,
        fontStyle: bool(span.italic) ? 'italic' : 'normal',
        textDecoration: decoration === 'lineThrough' ? 'line-through' : decoration,
      }}
    >{string(span.text)}</span>;
  })}</span>;
}

function SelectableTextWidget({ props, style }: WidgetRenderProps) {
  const variant = string(props.variant, 'code');
  return <span
    data-pe-widget="SelectableText"
    className={`pe-content-text pe-selectable-text pe-text-${variant}`}
    tabIndex={0}
    aria-label={string(props.semanticLabel) || undefined}
    style={styled(textStyle(props), style)}
  >{string(props.text)}</span>;
}

function safeMarkdownUrl(url: string): string {
  if (url.startsWith('#')) return url;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? url : '';
  } catch {
    return '';
  }
}

function MarkdownWidget({ props, style }: WidgetRenderProps) {
  const allowLinks = bool(props.allowLinks, true);
  return <div data-pe-widget="Markdown" className="pe-markdown" style={style}>
    <ReactMarkdown
      skipHtml
      remarkPlugins={[remarkGfm]}
      urlTransform={safeMarkdownUrl}
      components={{
        a: ({ children, href }) => allowLinks && href
          ? <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>
          : <span>{children}</span>,
        img: ({ alt }) => <span className="pe-markdown-image">[image: {alt || 'omitted'}]</span>,
      }}
    >{string(props.text)}</ReactMarkdown>
  </div>;
}

function CodeBlockWidget({ props, style }: WidgetRenderProps) {
  const code = string(props.code);
  const numbered = bool(props.lineNumbers);
  return <figure data-pe-widget="CodeBlock" className="pe-code-block" style={style}>
    {string(props.label) && <figcaption>{string(props.label)}</figcaption>}
    <pre data-wrap={bool(props.wrap) ? 'true' : 'false'}><code data-language={string(props.language) || undefined}>
      {numbered ? code.split('\n').map((line, index) => <span className="pe-code-line" key={index}>
        <span className="pe-code-number" aria-hidden="true">{index + 1}</span>{line || ' '}
      </span>) : code}
    </code></pre>
  </figure>;
}

function ImageWidget({ props, style, slots, events }: WidgetRenderProps) {
  const src = string(props.src);
  const alt = string(props.alt);
  const [loadedSrc, setLoadedSrc] = useState<string>();
  const [failedSrc, setFailedSrc] = useState<string>();
  const failed = failedSrc === src;
  const state = failed ? 'error' : loadedSrc === src ? 'ready' : 'loading';
  const width = number(props.width);
  const height = number(props.height);
  if (failed) return <figure
    data-pe-widget="Image" data-state="error" className="pe-content-image pe-content-image-error"
    role="img" aria-label={alt} style={styled({ width, height }, style)}
  >{only(slots.failure) ?? string(props.failureText, 'Image unavailable')}</figure>;
  return <figure
    data-pe-widget="Image" data-state={state} className="pe-content-image" aria-busy={state === 'loading'}
    style={styled({ width, height }, style)}
  ><img
    src={src} alt={alt} loading={string(props.loading, 'lazy') as 'eager' | 'lazy'}
    style={{ width: width === undefined ? undefined : '100%', height: height === undefined ? undefined : '100%', objectFit: imageFits[string(props.fit, 'contain')] }}
    onLoad={() => { setLoadedSrc(src); void events.load?.(null); }}
    onError={() => { setFailedSrc(src); void events.error?.({ src }); }}
  /></figure>;
}

const icons: Record<string, LucideIcon> = {
  image: ImageIcon, file: File, folder: Folder, search: Search, settings: Settings, info: Info, alert: CircleAlert,
  check: Check, close: X, plus: Plus, minus: Minus, chevronDown: ChevronDown, chevronRight: ChevronRight,
  copy: Copy, download: Download, upload: Upload, externalLink: ExternalLink, code: CodeIcon, sparkles: Sparkles,
};
function IconWidget({ props, style }: WidgetRenderProps) {
  const Glyph = icons[string(props.name)];
  const label = string(props.semanticLabel);
  return <Glyph
    data-pe-widget="Icon" className="pe-content-icon" size={number(props.size) ?? 20} strokeWidth={number(props.strokeWidth) ?? 2}
    role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true} style={style}
  />;
}

function CardWidget({ props, style, slots }: WidgetRenderProps) {
  const title = string(props.title);
  const description = string(props.description);
  return <UiCard data-pe-widget="Card" style={style}>
    {(title || description) && <CardHeader>
      {title && <CardTitle>{title}</CardTitle>}
      {description && <CardDescription>{description}</CardDescription>}
    </CardHeader>}
    <CardContent>{only(slots.child)}</CardContent>
    {slots.footer && <CardFooter>{only(slots.footer)}</CardFooter>}
  </UiCard>;
}

function TooltipWidget({ props, style, slots }: WidgetRenderProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return <span
    data-pe-widget="Tooltip" data-side={string(props.side, 'top')} data-open={open ? 'true' : 'false'}
    className="pe-tooltip" style={style}
    onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
    onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
  >
    <span className="pe-tooltip-trigger" tabIndex={0} aria-describedby={id}>{only(slots.child)}</span>
    <span id={id} role="tooltip" aria-hidden={!open} className="pe-tooltip-content" style={{ transitionDelay: `${number(props.delay) ?? 200}ms` }}>
      {string(props.message)}
    </span>
  </span>;
}

const renderers: Record<string, WidgetDefinition['render']> = {
  Text: TextWidget,
  RichText: RichTextWidget,
  SelectableText: SelectableTextWidget,
  Markdown: MarkdownWidget,
  CodeBlock: CodeBlockWidget,
  Image: ImageWidget,
  Icon: IconWidget,
  Badge: ({ props, style }) => <UiBadge data-pe-widget="Badge" variant={string(props.variant, 'outline') as 'default' | 'secondary' | 'destructive' | 'outline'} style={style}>{string(props.text)}</UiBadge>,
  Divider: ({ props, style }) => <Separator data-pe-widget="Divider" orientation={string(props.orientation, 'horizontal') as 'horizontal' | 'vertical'} decorative={bool(props.decorative, true)} style={style} />,
  Card: CardWidget,
  Tooltip: TooltipWidget,
};

const contracts = { Text, RichText, SelectableText, Markdown, CodeBlock, Image, Icon, Badge, Divider, Card, Tooltip };
export const contentRuntimeWidgets: Record<string, WidgetDefinition> = Object.fromEntries(
  Object.entries(contracts).map(([type, widget]) => [type, { contract: widget.contract, render: renderers[type] }]),
);
