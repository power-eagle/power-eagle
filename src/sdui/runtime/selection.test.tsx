// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { form, ref, set } from '../authoring';
import { Form } from '../authoring/forms';
import { Autocomplete, ColorPicker, DatePicker, FilePicker, Select, Slider } from '../authoring/selection';
import { Button, foundationCatalog } from '../authoring/foundation';
import type { Json, Node, RuntimeDocument } from '../schema/model';
import { validateRuntime } from '../schema/validate';
import { foundationRuntimeCatalog } from './foundation';
import { RuntimeSession } from './session';
import { RuntimeView } from './view';

const value = <T extends Json>(name: string) => ref<T>('state', name);
const change = (name: string) => set(name, ref('event'));
const sessions: RuntimeSession[] = [];

function documentWith(body: Node, state: RuntimeDocument['state']): RuntimeDocument {
  return {
    format: 'power-eagle/runtime', formatVersion: 1, start: 'home', dependencies: [], components: {}, actions: {}, state,
    screens: { home: { params: { type: 'object', properties: {}, required: [] }, state: {}, body } },
  };
}

afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
});

describe('controlled selection widget family', () => {
  it('supports keyboard selection, typed values, boundaries, cancellation, retry, and form submission', async () => {
    const selection = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(['C:\\images\\one.png', 'C:\\images\\two.png']);
    const state: RuntimeDocument['state'] = {
      channel: { schema: { type: 'string' }, initial: 'stable' },
      city: { schema: { type: 'string' }, initial: '' },
      opacity: { schema: { type: 'number' }, initial: 4 },
      releaseDate: { schema: { type: 'string' }, initial: '2026-10-04' },
      accent: { schema: { type: 'string' }, initial: '#ffae2b' },
      files: { schema: { type: 'array', items: { type: 'string' } }, initial: [] },
      cancelled: { schema: { type: 'boolean' }, initial: false },
      submitted: { schema: { type: 'json' }, initial: null },
    };
    const body = Form.node({ id: 'selection' }, {
      events: { submit: set('submitted', ref('event')) },
      slots: { children: [
        Select.node({ id: 'channel', label: 'Release channel', value: value<string>('channel'), options: [
          { value: 'stable', label: 'Stable' }, { value: 'preview', label: 'Preview' },
        ] }, { events: { change: change('channel') } }),
        Autocomplete.node({ id: 'city', label: 'City', value: value<string>('city'), options: [
          { value: 'vancouver', label: 'Vancouver' }, { value: 'victoria', label: 'Victoria' }, { value: 'vernon', label: 'Vernon' },
        ] }, { events: { change: change('city') } }),
        Slider.node({ id: 'opacity', label: 'Opacity', value: value<number>('opacity'), minimum: 0, maximum: 10, step: 2 }, { events: { change: change('opacity') } }),
        DatePicker.node({ id: 'releaseDate', label: 'Release date', value: value<string>('releaseDate'), minimum: '2026-01-01', maximum: '2026-12-31' }, { events: { change: change('releaseDate') } }),
        ColorPicker.node({ id: 'accent', label: 'Accent color', value: value<string>('accent') }, { events: { change: change('accent') } }),
        FilePicker.node({
          id: 'files', label: 'Source files', value: value<string[]>('files'), multiple: true,
          title: 'Choose images', initialPath: 'C:\\images', buttonLabel: 'Import', filters: [{ name: 'Images', extensions: ['png'] }],
        }, { events: { change: change('files'), cancel: set('cancelled', true) } }),
        Button.node({ label: 'Submit selection' }, { events: { press: form('selection') } }),
      ] },
    });
    const runtime = documentWith(body, state);
    expect(validateRuntime(runtime, foundationCatalog).success).toBe(true);
    const session = new RuntimeSession(runtime, foundationRuntimeCatalog, { selection });
    sessions.push(session);
    const user = userEvent.setup();
    render(<RuntimeView session={session} />);

    await user.selectOptions(screen.getByLabelText('Release channel'), 'preview');
    const autocomplete = screen.getByRole('combobox', { name: 'City' });
    await user.type(autocomplete, 'van');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(session.globalState.read(['channel'])).toBe('preview');
    expect(session.globalState.read(['city'])).toBe('vancouver');
    expect((autocomplete as HTMLInputElement).value).toBe('vancouver');

    const slider = screen.getByRole('slider', { name: 'Opacity' });
    slider.focus();
    await user.keyboard('{End}{ArrowRight}');
    expect(session.globalState.read(['opacity'])).toBe(10);
    await user.keyboard('{Home}{ArrowLeft}');
    expect(session.globalState.read(['opacity'])).toBe(0);

    fireEvent.change(screen.getByLabelText('Release date'), { target: { value: '2027-01-01' } });
    await user.click(screen.getByRole('button', { name: 'Submit selection' }));
    expect(screen.getByText('Choose 2026-12-31 or earlier.')).toBeTruthy();
    expect(session.globalState.read(['submitted'])).toBeNull();
    fireEvent.change(screen.getByLabelText('Release date'), { target: { value: '2026-11-12' } });
    fireEvent.change(screen.getByLabelText('Accent color'), { target: { value: '#336699' } });
    expect(session.globalState.read(['releaseDate'])).toBe('2026-11-12');
    expect(session.globalState.read(['accent'])).toBe('#336699');

    const picker = screen.getByRole('button', { name: 'Import' });
    await user.click(picker);
    await waitFor(() => expect(session.globalState.read(['cancelled'])).toBe(true));
    expect(session.globalState.read(['files'])).toEqual([]);
    expect((picker as HTMLButtonElement).disabled).toBe(false);
    await user.click(picker);
    await waitFor(() => expect(session.globalState.read(['files'])).toEqual(['C:\\images\\one.png', 'C:\\images\\two.png']));
    expect(selection).toHaveBeenLastCalledWith(expect.objectContaining({
      selectionType: 'file', multiple: true, title: 'Choose images', initialPath: 'C:\\images',
      buttonLabel: 'Import', filters: [{ name: 'Images', extensions: ['png'] }], signal: expect.any(AbortSignal),
    }));

    await user.click(screen.getByRole('button', { name: 'Submit selection' }));
    await waitFor(() => expect(session.globalState.read(['submitted'])).toEqual({
      channel: 'preview', city: 'vancouver', opacity: 0, releaseDate: '2026-11-12', accent: '#336699',
      files: ['C:\\images\\one.png', 'C:\\images\\two.png'],
    }));
  });

  it('keeps read-only values controlled and reports an unavailable host beside FilePicker', async () => {
    const state: RuntimeDocument['state'] = {
      channel: { schema: { type: 'string' }, initial: 'stable' },
      files: { schema: { type: 'array', items: { type: 'string' } }, initial: [] },
    };
    const runtime = documentWith(Form.node({ id: 'locked' }, { slots: { children: [
      Select.node({ id: 'channel', label: 'Release channel', value: value<string>('channel'), readOnly: true, options: [
        { value: 'stable', label: 'Stable' }, { value: 'preview', label: 'Preview' },
      ] }, { events: { change: change('channel') } }),
      FilePicker.node({ id: 'files', label: 'Source files', value: value<string[]>('files') }, { events: { change: change('files') } }),
    ] } }), state);
    const session = new RuntimeSession(runtime, foundationRuntimeCatalog);
    sessions.push(session);
    render(<RuntimeView session={session} />);

    fireEvent.change(screen.getByLabelText('Release channel'), { target: { value: 'preview' } });
    expect(session.globalState.read(['channel'])).toBe('stable');
    expect((screen.getByLabelText('Release channel') as HTMLSelectElement).value).toBe('stable');
    expect(screen.getByText('File selection is unavailable in this host.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Choose' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
