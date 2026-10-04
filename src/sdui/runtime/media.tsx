/* eslint-disable react-refresh/only-export-components -- Runtime renderers are registered as component factories. */
import * as React from 'react';
import { Button as UiButton } from '../../components/ui';
import { AudioPlayer, ImageGallery, VideoPlayer, ZoomableImage } from '../authoring/media';
import type { Json } from '../schema/model';
import type { WidgetDefinition } from './session';
import type { WidgetRenderProps } from './view';

const text = (value: Json | undefined, fallback = '') => typeof value === 'string' ? value : fallback;
const number = (value: Json | undefined, fallback = 0) => typeof value === 'number' ? value : fallback;
const bool = (value: Json | undefined, fallback = false) => typeof value === 'boolean' ? value : fallback;
const object = (value: Json | undefined): Record<string, Json> => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const finite = (value: number) => Number.isFinite(value) && value >= 0 ? value : 0;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

interface GalleryItem { id: string; src: string; alt: string; caption: string }
function galleryItems(value: Json | undefined): GalleryItem[] {
  if (!Array.isArray(value)) return [];
  return value.map(raw => {
    const item = object(raw);
    return { id: text(item.id), src: text(item.src), alt: text(item.alt), caption: text(item.caption) };
  }).filter(item => item.id && item.src && item.alt);
}

function ImageGalleryWidget({ props, events, style }: WidgetRenderProps) {
  const items = galleryItems(props.items);
  const selected = text(props.selection);
  const disabled = bool(props.disabled);
  const [failed, setFailed] = React.useState<ReadonlySet<string>>(() => new Set());
  const fail = (item: GalleryItem) => {
    setFailed(current => new Set(current).add(item.id));
    void events.error?.({ id: item.id, message: text(props.failureText, 'Image unavailable') });
  };
  return <div
    data-pe-widget="ImageGallery" className="pe-image-gallery" role="listbox" aria-label={text(props.label)}
    aria-disabled={disabled || undefined} style={{
      gridTemplateColumns: `repeat(${Math.max(1, Math.floor(number(props.columns, 3)))}, minmax(0, 1fr))`,
      gap: Math.max(0, number(props.gap, 8)), height: number(props.height) || undefined,
      overflowY: props.height ? 'auto' : undefined, ...style,
    }}
  >{items.length ? items.map(item => <button
    type="button" role="option" aria-selected={selected === item.id} disabled={disabled} key={item.id}
    className="pe-gallery-item" onClick={() => void events.selectionChange?.(item.id)}
  >{failed.has(item.id) ? <span className="pe-media-failure">{text(props.failureText, 'Image unavailable')}</span> : <img
    src={item.src} alt={item.alt} onLoad={() => void events.load?.(item.id)} onError={() => fail(item)}
  />}{item.caption && <span>{item.caption}</span>}</button>) : <div className="pe-media-empty">{text(props.emptyText, 'No images')}</div>}</div>;
}

function ZoomableImageWidget({ props, events, style }: WidgetRenderProps) {
  const source = text(props.src);
  const minimum = Math.max(0.01, number(props.minimumScale, 0.25));
  const maximum = Math.max(minimum, number(props.maximumScale, 4));
  const scale = clamp(number(props.scale, 1), minimum, maximum);
  const step = Math.max(0.01, number(props.step, 0.25));
  const disabled = bool(props.disabled);
  const [state, setState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  React.useEffect(() => setState('loading'), [source]);
  const zoom = (next: number) => { if (!disabled) void events.zoom?.(Number(clamp(next, minimum, maximum).toFixed(4))); };
  return <figure data-pe-widget="ZoomableImage" className="pe-zoom-image" data-state={state} style={style}>
    <div className="pe-zoom-toolbar" role="toolbar" aria-label={`Zoom controls for ${text(props.alt)}`}>
      <UiButton type="button" variant="outline" size="sm" disabled={disabled || scale <= minimum} onClick={() => zoom(scale - step)}>−</UiButton>
      <output aria-label="Zoom level">{Math.round(scale * 100)}%</output>
      <UiButton type="button" variant="outline" size="sm" disabled={disabled || scale >= maximum} onClick={() => zoom(scale + step)}>+</UiButton>
      <UiButton type="button" variant="ghost" size="sm" disabled={disabled || scale === 1} onClick={() => zoom(1)}>Reset</UiButton>
    </div>
    <div className="pe-zoom-viewport">{state === 'error' ? <span className="pe-media-failure">{text(props.failureText, 'Image unavailable')}</span> : <img
      src={source} alt={text(props.alt)} style={{ transform: `scale(${scale})`, objectFit: text(props.fit, 'contain') as React.CSSProperties['objectFit'] }}
      onLoad={() => { setState('ready'); void events.load?.(null); }}
      onError={() => { const message = text(props.failureText, 'Image unavailable'); setState('error'); void events.error?.(message); }}
    />}</div>
  </figure>;
}

type MediaKind = 'audio' | 'video';
type PlaybackState = 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error' | 'unsupported';
const playbackText: Record<PlaybackState, string> = {
  loading: 'Loading media', ready: 'Ready', playing: 'Playing', paused: 'Paused', ended: 'Playback ended',
  error: 'Media failed to load', unsupported: 'Unsupported media format',
};

function mediaRenderer(kind: MediaKind): WidgetDefinition['render'] {
  function MediaWidget({ props, events, style, node }: WidgetRenderProps) {
    const source = text(props.src);
    const mimeType = text(props.mimeType);
    const media = React.useRef<HTMLMediaElement>(null);
    const [state, setState] = React.useState<PlaybackState>('loading');
    React.useEffect(() => {
      const element = media.current;
      if (!element) return;
      const supported = !mimeType || element.canPlayType(mimeType) !== '';
      setState(supported ? 'loading' : 'unsupported');
      return () => {
        const shouldReload = element.networkState !== HTMLMediaElement.NETWORK_EMPTY;
        if (!element.paused) element.pause();
        element.removeAttribute('src');
        if (shouldReload) element.load();
      };
    }, [mimeType, source]);
    const failed = (element: HTMLMediaElement) => {
      const code = element.error?.code ?? 0;
      const unsupported = code === 4;
      const message = unsupported ? 'Unsupported media format' : 'Media failed to load';
      setState(unsupported ? 'unsupported' : 'error');
      void events.error?.({ code, message });
    };
    const common = {
      src: state === 'unsupported' ? undefined : source, 'aria-label': text(props.label),
      autoPlay: bool(props.autoplay), controls: bool(props.controls, true), loop: bool(props.loop), muted: bool(props.muted),
      preload: text(props.preload, 'metadata') as 'none' | 'metadata' | 'auto',
      onLoadStart: () => setState('loading' as const), onCanPlay: () => setState('ready' as const),
      onPlay: () => { setState('playing'); void events.play?.(null); },
      onPause: () => { setState('paused'); void events.pause?.(null); },
      onEnded: () => { setState('ended'); void events.ended?.(null); },
      onTimeUpdate: (event: React.SyntheticEvent<HTMLMediaElement>) => void events.timeUpdate?.({
        currentTime: finite(event.currentTarget.currentTime), duration: finite(event.currentTarget.duration),
      }),
      onError: (event: React.SyntheticEvent<HTMLMediaElement>) => failed(event.currentTarget),
    };
    return <figure data-pe-widget={node.type} className="pe-media-player" data-state={state} style={style}>
      {kind === 'audio' ? <audio ref={media as React.RefObject<HTMLAudioElement>} {...common} /> : <video
        ref={media as React.RefObject<HTMLVideoElement>} {...common}
        poster={text(props.poster) || undefined} width={number(props.width) || undefined} height={number(props.height) || undefined}
      />}
      <figcaption><span>{text(props.label)}</span><span role="status">{playbackText[state]}</span></figcaption>
    </figure>;
  }
  return MediaWidget;
}

const renderers: Record<string, WidgetDefinition['render']> = {
  ImageGallery: ImageGalleryWidget,
  ZoomableImage: ZoomableImageWidget,
  AudioPlayer: mediaRenderer('audio'),
  VideoPlayer: mediaRenderer('video'),
};
const contracts = { ImageGallery, ZoomableImage, AudioPlayer, VideoPlayer };
export const mediaRuntimeWidgets: Record<string, WidgetDefinition> = Object.fromEntries(
  Object.entries(contracts).map(([type, widget]) => [type, { contract: widget.contract, render: renderers[type] }]),
);
