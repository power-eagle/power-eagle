import type { DataSchema, WidgetContract } from '../schema/model';
import { defineWidget } from './index';

const boolean = { type: 'boolean' } satisfies DataSchema;
const text = { type: 'string' } satisfies DataSchema;
const positive = { type: 'number', minimum: Number.MIN_VALUE } satisfies DataSchema;
const nonnegative = { type: 'number', minimum: 0 } satisfies DataSchema;
const imageItem = {
  type: 'object', properties: {
    id: { type: 'string', minLength: 1 }, src: { type: 'string', minLength: 1 },
    alt: { type: 'string', minLength: 1 }, caption: text,
  }, required: ['id', 'src', 'alt'] as ['id', 'src', 'alt'],
} satisfies DataSchema;
const imageError = {
  type: 'object', properties: { id: { type: 'string', minLength: 1 }, message: { type: 'string', minLength: 1 } },
  required: ['id', 'message'] as ['id', 'message'],
} satisfies DataSchema;
const mediaError = {
  type: 'object', properties: { code: { type: 'number', minimum: 0, integer: true }, message: { type: 'string', minLength: 1 } },
  required: ['code', 'message'] as ['code', 'message'],
} satisfies DataSchema;
const timeEvent = {
  type: 'object', properties: { currentTime: nonnegative, duration: nonnegative },
  required: ['currentTime', 'duration'] as ['currentTime', 'duration'],
} satisfies DataSchema;

export const ImageGallery = defineWidget('ImageGallery', {
  properties: { type: 'object', properties: {
    label: { type: 'string', minLength: 1 }, items: { type: 'array', items: imageItem }, selection: text,
    columns: { type: 'number', minimum: 1, integer: true }, gap: nonnegative, height: positive,
    emptyText: text, failureText: text, disabled: boolean,
  }, required: ['label', 'items'] },
  defaults: { selection: '', columns: 3, gap: 8, emptyText: 'No images', failureText: 'Image unavailable', disabled: false },
  slots: {}, events: { selectionChange: { type: 'string', minLength: 1 }, load: { type: 'string', minLength: 1 }, error: imageError },
  themeHooks: ['media', 'gallery', 'image'],
  example: { type: 'ImageGallery', props: { label: 'Package images', selection: 'one', columns: 2, items: [
    { id: 'one', src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E', alt: 'First image', caption: 'First' },
    { id: 'two', src: 'assets/gallery.svg', alt: 'Second image', caption: 'Second' },
  ] } },
});

export const ZoomableImage = defineWidget('ZoomableImage', {
  properties: { type: 'object', properties: {
    src: { type: 'string', minLength: 1 }, alt: { type: 'string', minLength: 1 }, scale: positive,
    minimumScale: positive, maximumScale: positive, step: positive,
    fit: { type: 'enum', values: ['contain', 'cover', 'none'] }, failureText: text, disabled: boolean,
  }, required: ['src', 'alt', 'scale'] },
  defaults: { minimumScale: 0.25, maximumScale: 4, step: 0.25, fit: 'contain', failureText: 'Image unavailable', disabled: false },
  slots: {}, events: { zoom: { type: 'number' }, load: { type: 'null' }, error: { type: 'string' } },
  themeHooks: ['media', 'image', 'zoom'],
  example: { type: 'ZoomableImage', props: {
    src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="160" height="90"/%3E',
    alt: 'Zoomable package preview', scale: 1,
  } },
});

const playbackProperties = {
  src: { type: 'string', minLength: 1 }, label: { type: 'string', minLength: 1 }, mimeType: text,
  autoplay: boolean, controls: boolean, loop: boolean, muted: boolean,
  preload: { type: 'enum', values: ['none', 'metadata', 'auto'] },
} satisfies Record<string, DataSchema>;
const playbackDefaults = { mimeType: '', autoplay: false, controls: true, loop: false, muted: false, preload: 'metadata' };
const playbackEvents = {
  play: { type: 'null' }, pause: { type: 'null' }, ended: { type: 'null' }, timeUpdate: timeEvent, error: mediaError,
} satisfies Record<string, DataSchema>;

export const AudioPlayer = defineWidget('AudioPlayer', {
  properties: { type: 'object', properties: playbackProperties, required: ['src', 'label'] },
  defaults: playbackDefaults, slots: {}, events: playbackEvents, themeHooks: ['media', 'audio', 'playback'],
  example: { type: 'AudioPlayer', props: { src: 'assets/example-audio.wav', label: 'Package audio preview', mimeType: 'audio/wav', controls: true } },
});

export const VideoPlayer = defineWidget('VideoPlayer', {
  properties: { type: 'object', properties: {
    ...playbackProperties, poster: text, width: positive, height: positive,
  }, required: ['src', 'label'] },
  defaults: { ...playbackDefaults, poster: '' }, slots: {}, events: playbackEvents, themeHooks: ['media', 'video', 'playback'],
  example: { type: 'VideoPlayer', props: {
    src: 'assets/example-video.mp4',
    label: 'Package video preview', mimeType: 'video/mp4', controls: true,
    poster: 'assets/preview.svg', width: 240, height: 135,
  } },
});

export const mediaWidgets = { ImageGallery, ZoomableImage, AudioPlayer, VideoPlayer } as const;
export const mediaContracts: Record<string, WidgetContract> = Object.fromEntries(
  Object.entries(mediaWidgets).map(([type, widget]) => [type, widget.contract]),
);
