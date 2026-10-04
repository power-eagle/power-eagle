// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AudioPlayer, Column, ImageGallery, Text, VideoPlayer, ZoomableImage, foundationCatalog,
} from '../authoring/foundation';
import { ref, set } from '../authoring';
import type { Json, Node, RuntimeDocument } from '../schema/model';
import { validateRuntime } from '../schema/validate';
import { foundationRuntimeCatalog } from './foundation';
import { RuntimeSession } from './session';
import { RuntimeView } from './view';

const tagged = (value: unknown) => value as Json;
const sessions: RuntimeSession[] = [];
let pause: ReturnType<typeof vi.spyOn>;
let load: ReturnType<typeof vi.spyOn>;

function documentWith(body: Node, state: RuntimeDocument['state'] = {}, screens: RuntimeDocument['screens'] = {}): RuntimeDocument {
  return {
    format: 'power-eagle/runtime', formatVersion: 1, start: 'home', dependencies: [], actions: {}, components: {}, state,
    screens: { home: { params: { type: 'object', properties: {}, required: [] }, state: {}, body }, ...screens },
  };
}
function renderDocument(document: RuntimeDocument) {
  const session = new RuntimeSession(document, foundationRuntimeCatalog);
  sessions.push(session);
  return { session, ...render(<RuntimeView session={session} />) };
}

beforeEach(() => {
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockImplementation(() => 'probably');
});
afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
  vi.restoreAllMocks();
});

describe('media widget family', () => {
  it('keeps gallery selection keyed and contains individual image failures', async () => {
    const body = ImageGallery.node({ label: 'Package images', selection: ref<string>('state', 'selected'), columns: 2, items: [
      { id: 'alpha', src: 'alpha.png', alt: 'Alpha preview', caption: 'Alpha' },
      { id: 'beta', src: 'beta.png', alt: 'Beta preview', caption: 'Beta' },
    ] }, { events: {
      selectionChange: set('selected', tagged(ref('event'))), error: set('imageError', tagged(ref('event'))),
    } });
    const { session } = renderDocument(documentWith(body, {
      selected: { schema: { type: 'string' }, initial: 'alpha' },
      imageError: { schema: { type: 'json' }, initial: null },
    }));
    const user = userEvent.setup();
    const beta = screen.getByRole('option', { name: /Beta previewBeta/ });
    await user.click(beta);
    await waitFor(() => expect(session.globalState.read(['selected'])).toBe('beta'));
    expect(beta.getAttribute('aria-selected')).toBe('true');

    fireEvent.error(screen.getByAltText('Beta preview'));
    await waitFor(() => expect(session.globalState.read(['imageError'])).toEqual({ id: 'beta', message: 'Image unavailable' }));
    expect(screen.getByText('Image unavailable')).toBeTruthy();
    expect(screen.getByAltText('Alpha preview')).toBeTruthy();
  });

  it('emits bounded zoom levels and exposes readable image error state', async () => {
    const body = ZoomableImage.node({ src: 'preview.png', alt: 'Package preview', scale: ref<number>('state', 'scale'), step: 0.25 }, {
      events: { zoom: set('scale', tagged(ref('event'))), error: set('zoomError', tagged(ref('event'))) },
    });
    const { session } = renderDocument(documentWith(body, {
      scale: { schema: { type: 'number' }, initial: 1 }, zoomError: { schema: { type: 'string' }, initial: '' },
    }));
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '+' }));
    await waitFor(() => expect(session.globalState.read(['scale'])).toBe(1.25));
    expect(screen.getByRole('status', { hidden: true })).toBeTruthy();
    expect(screen.getByLabelText('Zoom level').textContent).toBe('125%');
    fireEvent.error(screen.getByAltText('Package preview'));
    await waitFor(() => expect(session.globalState.read(['zoomError'])).toBe('Image unavailable'));
    expect(screen.getByText('Image unavailable')).toBeTruthy();
  });

  it('reports playback states, makes unsupported media readable, and releases resources on view replacement', async () => {
    const body = Column.node({ gap: 8 }, { slots: { children: [
      AudioPlayer.node({ src: 'preview.mp3', label: 'Audio preview', mimeType: 'audio/mpeg' }, { events: {
        play: set('played', true), timeUpdate: set('time', tagged(ref('event'))),
      } }),
      VideoPlayer.node({ src: 'preview.unknown', label: 'Video preview', mimeType: 'video/example' }, { events: {
        error: set('mediaError', tagged(ref('event'))),
      } }),
    ] } });
    const detail = { params: { type: 'object' as const, properties: {}, required: [] }, state: {}, body: Text.node({ text: 'Detail screen' }) };
    const { session, container } = renderDocument(documentWith(body, {
      played: { schema: { type: 'boolean' }, initial: false }, time: { schema: { type: 'json' }, initial: null },
      mediaError: { schema: { type: 'json' }, initial: null },
    }, { detail }));
    const audio = container.querySelector('audio')!;
    const video = container.querySelector('video')!;
    fireEvent.canPlay(audio);
    fireEvent.play(audio);
    await waitFor(() => expect(session.globalState.read(['played'])).toBe(true));
    expect(screen.getByText('Playing')).toBeTruthy();
    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 12 });
    Object.defineProperty(audio, 'duration', { configurable: true, value: 30 });
    fireEvent.timeUpdate(audio);
    await waitFor(() => expect(session.globalState.read(['time'])).toEqual({ currentTime: 12, duration: 30 }));

    Object.defineProperty(video, 'error', { configurable: true, value: { code: 4 } });
    fireEvent.error(video);
    await waitFor(() => expect(session.globalState.read(['mediaError'])).toEqual({ code: 4, message: 'Unsupported media format' }));
    expect(screen.getByText('Unsupported media format')).toBeTruthy();

    Object.defineProperty(audio, 'paused', { configurable: true, value: false });
    Object.defineProperty(audio, 'networkState', { configurable: true, value: 1 });
    await session.navigation.navigate('replace', 'detail', {});
    await waitFor(() => expect(screen.getByText('Detail screen')).toBeTruthy());
    expect(pause).toHaveBeenCalled();
    expect(load).toHaveBeenCalled();
    expect(audio.getAttribute('src')).toBeNull();
  });

  it('renders unsupported MIME types without waiting for a failing network request', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('');
    renderDocument(documentWith(AudioPlayer.node({ src: 'preview.bin', label: 'Unknown audio', mimeType: 'audio/not-supported' })));
    await waitFor(() => expect(screen.getByText('Unsupported media format')).toBeTruthy());
    expect(screen.getByLabelText('Unknown audio').getAttribute('src')).toBeNull();
  });

  it('publishes validated contracts and runnable examples for every media type', () => {
    for (const type of ['ImageGallery', 'ZoomableImage', 'AudioPlayer', 'VideoPlayer']) {
      const contract = foundationCatalog.widgets[type];
      expect(contract, `${type} contract`).toBeTruthy();
      expect(validateRuntime(documentWith(contract.example), foundationCatalog), type).toMatchObject({ success: true });
    }
  });
});
