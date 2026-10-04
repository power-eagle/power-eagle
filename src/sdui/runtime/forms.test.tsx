// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { form, ref, set } from '../authoring';
import { Checkbox, Form, NumberField, RadioGroup, Switch, TextArea, TextField } from '../authoring/forms';
import { Button } from '../authoring/foundation';
import type { Json, RuntimeDocument } from '../schema/model';
import { validateRuntime } from '../schema/validate';
import { foundationCatalog } from '../authoring/foundation';
import { foundationRuntimeCatalog } from './foundation';
import { RuntimeSession } from './session';
import { RuntimeView } from './view';

const value = <T extends Json>(name: string) => ref<T>('state', name);
const change = (name: string) => set(name, ref('event'));
const runtimeDocument: RuntimeDocument = {
  format: 'power-eagle/runtime', formatVersion: 1, start: 'home', dependencies: [], components: {}, actions: {},
  state: {
    name: { schema: { type: 'string' }, initial: '' },
    biography: { schema: { type: 'string' }, initial: 'Read only biography' },
    age: { schema: { type: 'number' }, initial: 99 },
    terms: { schema: { type: 'boolean' }, initial: false },
    telemetry: { schema: { type: 'boolean' }, initial: false },
    density: { schema: { type: 'string' }, initial: 'compact' },
    disabledSecret: { schema: { type: 'string' }, initial: 'omitted' },
    submitted: { schema: { type: 'json' }, initial: null },
    invalid: { schema: { type: 'json' }, initial: null },
  },
  screens: { home: {
    params: { type: 'object', properties: {}, required: [] }, state: {},
    body: Form.node({ id: 'profile', validationMode: 'change' }, {
      events: { submit: set('submitted', ref('event')), invalid: set('invalid', ref('event')) },
      slots: { children: [
        TextField.node({ id: 'name', label: 'Display name', value: value<string>('name'), required: true }, { events: { change: change('name') } }),
        TextArea.node({ id: 'biography', label: 'Biography', value: value<string>('biography'), readOnly: true }, { events: { change: change('biography') } }),
        NumberField.node({ id: 'age', label: 'Age', value: value<number>('age'), minimum: 1, maximum: 10, integer: true }, { events: { change: change('age') } }),
        Checkbox.node({ id: 'terms', label: 'Accept terms', value: value<boolean>('terms'), required: true }, { events: { change: change('terms') } }),
        Switch.node({ id: 'telemetry', label: 'Telemetry', value: value<boolean>('telemetry') }, { events: { change: change('telemetry') } }),
        RadioGroup.node({ id: 'density', label: 'Density', value: value<string>('density'), options: [
          { value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' },
        ] }, { events: { change: change('density') } }),
        TextField.node({ id: 'disabledSecret', label: 'Disabled secret', value: value<string>('disabledSecret'), disabled: true }, { events: { change: change('disabledSecret') } }),
        Button.node({ label: 'Submit profile' }, { events: { press: form('profile') } }),
        Button.node({ label: 'Reset profile' }, { events: { press: form('profile', 'reset') } }),
      ] },
    }),
  } },
};

const sessions: RuntimeSession[] = [];
afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
});

describe('form and typed input widget family', () => {
  it('validates before submit and preserves structured number, boolean, and string values', async () => {
    const session = new RuntimeSession(runtimeDocument, foundationRuntimeCatalog);
    sessions.push(session);
    const user = userEvent.setup();
    render(<RuntimeView session={session} />);

    await user.click(screen.getByRole('button', { name: 'Submit profile' }));
    await waitFor(() => expect(session.globalState.read(['invalid'])).toMatchObject({ valid: false }));
    expect(session.globalState.read(['submitted'])).toBeNull();

    const name = screen.getByRole('textbox', { name: /Display name/u });
    const nameError = screen.getByText('Display name is required.');
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.getAttribute('aria-describedby')?.split(' ')).toContain(nameError.id);
    expect(document.activeElement).toBe(name);
    expect(screen.getByText('Enter 10 or less.')).toBeTruthy();
    expect(screen.getByText('Accept terms is required.')).toBeTruthy();

    await user.type(name, 'Ada');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Age' }), { target: { value: '5' } });
    await user.click(screen.getByRole('checkbox', { name: /Accept terms/u }));
    await user.click(screen.getByRole('switch', { name: 'Telemetry' }));
    await user.click(screen.getByRole('radio', { name: 'Comfortable' }));
    await user.type(screen.getByRole('textbox', { name: 'Biography' }), ' ignored');
    await user.type(screen.getByRole('textbox', { name: 'Disabled secret' }), ' ignored');

    expect(session.globalState.read(['age'])).toBe(5);
    expect(typeof session.globalState.read(['age'])).toBe('number');
    expect(session.globalState.read(['terms'])).toBe(true);
    expect(session.globalState.read(['telemetry'])).toBe(true);
    expect(typeof session.globalState.read(['telemetry'])).toBe('boolean');
    expect(session.globalState.read(['density'])).toBe('comfortable');
    expect(session.globalState.read(['biography'])).toBe('Read only biography');
    expect(session.globalState.read(['disabledSecret'])).toBe('omitted');

    await user.click(screen.getByRole('button', { name: 'Submit profile' }));
    await waitFor(() => expect(session.globalState.read(['submitted'])).toEqual({
      name: 'Ada', biography: 'Read only biography', age: 5, terms: true, telemetry: true, density: 'comfortable',
    }));
    expect(screen.queryByText('Display name is required.')).toBeNull();
  });

  it('submits through the native form path and resets controlled fields through typed change events', async () => {
    const session = new RuntimeSession(runtimeDocument, foundationRuntimeCatalog);
    sessions.push(session);
    const user = userEvent.setup();
    const { container } = render(<RuntimeView session={session} />);

    await user.type(screen.getByRole('textbox', { name: /Display name/u }), 'Lin');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Age' }), { target: { value: '4' } });
    await user.click(screen.getByRole('checkbox', { name: /Accept terms/u }));
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(session.globalState.read(['submitted'])).toMatchObject({ name: 'Lin', age: 4, terms: true }));

    await user.click(screen.getByRole('button', { name: 'Reset profile' }));
    await waitFor(() => expect(session.globalState.snapshot()).toMatchObject({
      name: '', biography: 'Read only biography', age: 99, terms: false, telemetry: false, density: 'compact', disabledSecret: 'omitted',
    }));
  });

  it('publishes typed contracts and rejects a binding with the wrong state type', () => {
    expect(validateRuntime(runtimeDocument, foundationCatalog).success).toBe(true);
    const invalid = structuredClone(runtimeDocument);
    invalid.screens.home.body = TextField.node({ id: 'bad', label: 'Bad', value: value<boolean>('terms') as unknown as string });
    expect(validateRuntime(invalid, foundationCatalog)).toMatchObject({
      success: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: 'binding-type', path: '/screens/home/body/props/value' })]),
    });
    invalid.screens.home.body = TextField.node({ id: 'badEvent', label: 'Bad event', value: value<string>('name') }, {
      events: { change: set('terms', ref('event')) },
    });
    expect(validateRuntime(invalid, foundationCatalog)).toMatchObject({
      success: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: 'binding-type', path: '/screens/home/body/events/change/value' })]),
    });
    expect(Form.contract.events.submit).toEqual({ type: 'json' });
    expect(NumberField.contract.events.change).toEqual({ type: 'number' });
    expect(Checkbox.contract.events.change).toEqual({ type: 'boolean' });
    expect(Switch.contract.events.change).toEqual({ type: 'boolean' });
  });
});
