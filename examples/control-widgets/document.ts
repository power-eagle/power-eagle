import { back, defineDocument, navigate, ref, set } from '../../src/sdui/authoring';
import { Text } from '../../src/sdui/authoring/content';
import {
  Accordion, Breadcrumbs, Button, ContextMenu, IconButton, Menu, SegmentedControl, SplitPane, Tabs,
} from '../../src/sdui/authoring/desktop';
import { Checkbox, Form, NumberField, RadioGroup, Switch, TextArea, TextField } from '../../src/sdui/authoring/forms';
import { Column } from '../../src/sdui/authoring/layout';
import { Autocomplete, ColorPicker, DatePicker, FilePicker, Select, Slider } from '../../src/sdui/authoring/selection';

const state = <T>(name: string) => ref<T>('state', name);
const change = (name: string) => set(name, ref('event'));

export default defineDocument({
  format: 'power-eagle/runtime', formatVersion: 1, start: 'home', dependencies: [], components: {}, actions: {},
  state: {
    name: { schema: { type: 'string' }, initial: '' },
    terms: { schema: { type: 'boolean' }, initial: false },
    files: { schema: { type: 'array', items: { type: 'string' } }, initial: [] },
    submission: { schema: { type: 'json' }, initial: null },
    notes: { schema: { type: 'string' }, initial: 'Typed controls' },
    copies: { schema: { type: 'number', integer: true }, initial: 2 },
    density: { schema: { type: 'string' }, initial: 'compact' },
    telemetry: { schema: { type: 'boolean' }, initial: false },
    channel: { schema: { type: 'string' }, initial: 'stable' },
    city: { schema: { type: 'string' }, initial: '' },
    opacity: { schema: { type: 'number' }, initial: 70 },
    releaseDate: { schema: { type: 'string' }, initial: '2026-10-04' },
    accent: { schema: { type: 'string' }, initial: '#ffae2b' },
    segment: { schema: { type: 'string' }, initial: 'preview' },
    tab: { schema: { type: 'string' }, initial: 'preview' },
    sections: { schema: { type: 'array', items: { type: 'string' } }, initial: ['details'] },
    menuAction: { schema: { type: 'string' }, initial: '' },
    contextAction: { schema: { type: 'string' }, initial: '' },
    split: { schema: { type: 'number' }, initial: 45 },
  },
  screens: {
    home: {
      params: { type: 'object', properties: {}, required: [] }, state: {},
      body: Column.node({ gap: 12, crossAxisAlignment: 'stretch' }, { slots: { children: [
        Text.node({ text: 'Control vocabulary', variant: 'title' }),
        Form.node({ id: 'profile', validationMode: 'change' }, {
          events: { submit: set('submission', ref('event')) },
          slots: { children: [
            TextField.node({ id: 'name', label: 'Display name', value: state<string>('name'), required: true }, { events: { change: change('name') } }),
            Checkbox.node({ id: 'terms', label: 'Accept terms', value: state<boolean>('terms'), required: true }, { events: { change: change('terms') } }),
            FilePicker.node({ id: 'files', label: 'Source file', value: state<string[]>('files'), required: true, buttonLabel: 'Choose source' }, { events: { change: change('files') } }),
            Button.node({ label: 'Submit profile', buttonType: 'submit' }),
          ] },
        }),
        Breadcrumbs.node({ label: 'Workflow', items: [
          { id: 'home', label: 'Home', current: true }, { id: 'review', label: 'Review' },
        ] }, { events: { select: navigate('review') } }),
        TextArea.node({ id: 'notes', label: 'Notes', value: state<string>('notes'), rows: 2 }, { events: { change: change('notes') } }),
        NumberField.node({ id: 'copies', label: 'Copies', value: state<number>('copies'), minimum: 1, maximum: 9, integer: true }, { events: { change: change('copies') } }),
        RadioGroup.node({ id: 'density', label: 'Density', value: state<string>('density'), options: [
          { value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' },
        ] }, { events: { change: change('density') } }),
        Switch.node({ id: 'telemetry', label: 'Anonymous telemetry', value: state<boolean>('telemetry') }, { events: { change: change('telemetry') } }),
        Select.node({ id: 'channel', label: 'Release channel', value: state<string>('channel'), options: [
          { value: 'stable', label: 'Stable' }, { value: 'preview', label: 'Preview' },
        ] }, { events: { change: change('channel') } }),
        Autocomplete.node({ id: 'city', label: 'City', value: state<string>('city'), placeholder: 'Find a city', options: [
          { value: 'vancouver', label: 'Vancouver' }, { value: 'victoria', label: 'Victoria' },
        ] }, { events: { change: change('city') } }),
        Slider.node({ id: 'opacity', label: 'Opacity', value: state<number>('opacity'), minimum: 0, maximum: 100, step: 5, valueLabel: '%' }, { events: { change: change('opacity') } }),
        DatePicker.node({ id: 'releaseDate', label: 'Release date', value: state<string>('releaseDate') }, { events: { change: change('releaseDate') } }),
        ColorPicker.node({ id: 'accent', label: 'Accent color', value: state<string>('accent') }, { events: { change: change('accent') } }),
        IconButton.node({ icon: 'plus', label: 'Add item', variant: 'outline' }),
        SegmentedControl.node({ label: 'Stage mode', value: state<string>('segment'), options: [
          { value: 'preview', label: 'Preview' }, { value: 'activation', label: 'Activation' },
        ] }, { events: { change: change('segment') } }),
        Tabs.node({ label: 'Package view', value: state<string>('tab'), tabs: [
          { value: 'preview', label: 'Preview' }, { value: 'activation', label: 'Activation' },
        ] }, { events: { change: change('tab') }, slots: { children: [
          Text.node({ text: 'Preview panel' }), Text.node({ text: 'Activation panel' }),
        ] } }),
        Accordion.node({ label: 'Package sections', value: state<string[]>('sections'), items: [
          { id: 'details', label: 'Details' }, { id: 'dependencies', label: 'Dependencies' },
        ] }, { events: { change: change('sections') }, slots: { children: [
          Text.node({ text: 'Package metadata' }), Text.node({ text: 'No dependencies' }),
        ] } }),
        Menu.node({ label: 'Package actions', items: [
          { id: 'open', label: 'Open' }, { id: 'remove', label: 'Remove', destructive: true, separatorBefore: true },
        ] }, { events: { select: change('menuAction') } }),
        ContextMenu.node({ label: 'Package context actions', items: [
          { id: 'inspect', label: 'Inspect' }, { id: 'disable', label: 'Disable' },
        ] }, { events: { select: change('contextAction') }, slots: { child: Text.node({ text: 'Right-click or press Shift+F10' }) } }),
        SplitPane.node({ label: 'Inspector split', value: state<number>('split'), minimumStart: 25, minimumEnd: 25 }, {
          events: { resize: change('split') }, slots: {
            start: Text.node({ text: 'Stage pane' }), end: Text.node({ text: 'Inspector pane' }),
          },
        }),
      ] } }),
    },
    review: {
      params: { type: 'object', properties: {}, required: [] }, state: {},
      body: Column.node({ gap: 12 }, { slots: { children: [
        Text.node({ text: 'Review screen', variant: 'title' }),
        Button.node({ label: 'Back' }, { events: { press: back() } }),
      ] } }),
    },
  },
});
