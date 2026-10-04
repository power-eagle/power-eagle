/* eslint-disable react-refresh/only-export-components -- Runtime renderers are registered as component factories. */
import * as React from 'react';
import { Button, Input } from '../../components/ui';
import { Autocomplete, ColorPicker, DatePicker, FilePicker, Select, Slider } from '../authoring/selection';
import type { Json } from '../schema/model';
import { Field, requiredIssue } from './forms';
import type { WidgetDefinition } from './session';
import type { WidgetRenderProps } from './view';

const own = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);
const text = (value: Json | undefined, fallback = '') => typeof value === 'string' ? value : fallback;
const number = (value: Json | undefined, fallback = 0) => typeof value === 'number' ? value : fallback;
const bool = (value: Json | undefined, fallback = false) => typeof value === 'boolean' ? value : fallback;
const object = (value: Json | undefined): Record<string, Json> => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const stringArray = (value: Json | undefined): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

interface Choice { value: string; label: string; disabled: boolean }
function choices(value: Json | undefined): Choice[] {
  return Array.isArray(value) ? value.map(item => {
    const option = object(item);
    return { value: text(option.value), label: text(option.label), disabled: bool(option.disabled) };
  }) : [];
}
function optionIssue(props: Record<string, Json>, available: Choice[], candidate: Json, allowCustom = false): string | undefined {
  const value = text(candidate);
  const required = requiredIssue(props, !value.trim());
  if (required) return required;
  if (value && !allowCustom && !available.some(option => option.value === value && !option.disabled)) {
    return text(props.optionMessage, 'Select one of the available options.');
  }
  return undefined;
}
function label(props: Record<string, Json>, id: string) {
  return <label className="pe-field-label" htmlFor={id}>{text(props.label)}{bool(props.required) && <span aria-hidden="true"> *</span>}</label>;
}

function SelectWidget({ props, events, style }: WidgetRenderProps) {
  const input = React.useRef<HTMLSelectElement>(null);
  const id = React.useId();
  const value = text(props.value);
  const capturedInitial = React.useRef(value);
  const initialValue = own(props, 'initialValue') ? text(props.initialValue) : capturedInitial.current;
  const disabled = bool(props.disabled);
  const readOnly = bool(props.readOnly);
  const available = choices(props.options);
  const validate = React.useCallback((candidate: Json) => optionIssue(props, available, candidate), [available, props]);
  return <Field
    type="Select" props={props} events={events} value={value} initialValue={initialValue} disabled={disabled}
    validate={validate} focus={() => input.current?.focus()}
  >{(error, describedBy, changed) => <>
    {label(props, id)}
    <select
      ref={input} id={id} className="pe-input pe-select" style={style} value={value} disabled={disabled}
      required={bool(props.required)} aria-readonly={readOnly || undefined} aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      onChange={event => {
        if (readOnly) { event.currentTarget.value = value; return; }
        const next = event.currentTarget.value;
        changed(next);
        void events.change?.(next);
      }}
      onMouseDown={event => { if (readOnly) event.preventDefault(); }}
      onKeyDown={event => { if (readOnly) event.preventDefault(); }}
    >
      {text(props.placeholder) && <option value="">{text(props.placeholder)}</option>}
      {available.map((option, index) => <option key={`${option.value}:${index}`} value={option.value} disabled={option.disabled}>{option.label}</option>)}
    </select>
  </>}</Field>;
}

function AutocompleteWidget({ props, events, style }: WidgetRenderProps) {
  const input = React.useRef<HTMLInputElement>(null);
  const id = React.useId();
  const listId = React.useId();
  const value = text(props.value);
  const capturedInitial = React.useRef(value);
  const initialValue = own(props, 'initialValue') ? text(props.initialValue) : capturedInitial.current;
  const disabled = bool(props.disabled);
  const readOnly = bool(props.readOnly);
  const available = choices(props.options);
  const allowCustom = bool(props.allowCustom);
  const maxSuggestions = Math.max(0, number(props.maxSuggestions, 8));
  const query = value.trim().toLocaleLowerCase();
  const filtered = available.filter(option => !query || option.label.toLocaleLowerCase().includes(query) || option.value.toLocaleLowerCase().includes(query)).slice(0, maxSuggestions);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const validate = React.useCallback((candidate: Json) => optionIssue(props, available, candidate, allowCustom), [allowCustom, available, props]);
  const choose = (option: Choice, changed: (value: Json) => void) => {
    if (option.disabled) return;
    changed(option.value);
    void events.change?.(option.value);
    void events.select?.(option.value);
    setOpen(false);
    setActive(-1);
  };
  const move = (direction: 1 | -1) => {
    if (!filtered.length) return;
    let next = active;
    for (let count = 0; count < filtered.length; count += 1) {
      next = (next + direction + filtered.length) % filtered.length;
      if (!filtered[next].disabled) { setActive(next); return; }
    }
  };
  return <Field
    type="Autocomplete" props={props} events={events} value={value} initialValue={initialValue} disabled={disabled}
    validate={validate} focus={() => input.current?.focus()}
  >{(error, describedBy, changed) => <>
    {label(props, id)}
    <div className="pe-autocomplete">
      <Input
        ref={input} id={id} style={style} role="combobox" value={value} disabled={disabled} readOnly={readOnly}
        placeholder={text(props.placeholder) || undefined} required={bool(props.required)} autoComplete="off"
        aria-autocomplete="list" aria-expanded={open && filtered.length > 0} aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={error ? true : undefined} aria-describedby={describedBy}
        onFocus={() => { if (!readOnly) setOpen(true); }}
        onBlur={() => setOpen(false)}
        onChange={event => {
          const next = event.currentTarget.value;
          setOpen(true);
          setActive(-1);
          changed(next);
          void events.change?.(next);
        }}
        onKeyDown={event => {
          if (readOnly) return;
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            move(event.key === 'ArrowDown' ? 1 : -1);
          } else if (event.key === 'Enter' && open && active >= 0) {
            event.preventDefault();
            choose(filtered[active], changed);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            setActive(-1);
          }
        }}
      />
      {open && filtered.length > 0 && <div id={listId} className="pe-autocomplete-list" role="listbox">
        {filtered.map((option, index) => <div
          id={`${listId}-${index}`} key={`${option.value}:${index}`} role="option"
          aria-selected={index === active} aria-disabled={option.disabled || undefined}
          className="pe-autocomplete-option"
          onMouseDown={event => { event.preventDefault(); choose(option, changed); }}
        >{option.label}</div>)}
      </div>}
    </div>
  </>}</Field>;
}

function sliderIssue(props: Record<string, Json>, candidate: Json): string | undefined {
  if (typeof candidate !== 'number' || !Number.isFinite(candidate)) return text(props.requiredMessage, `${text(props.label)} is required.`);
  const minimum = number(props.minimum);
  const maximum = number(props.maximum);
  if (candidate < minimum) return text(props.minimumMessage, `Choose ${minimum} or more.`);
  if (candidate > maximum) return text(props.maximumMessage, `Choose ${maximum} or less.`);
  const step = number(props.step, 1);
  const steps = (candidate - minimum) / step;
  if (Math.abs(steps - Math.round(steps)) > 1e-9) return text(props.stepMessage, `Choose a value in steps of ${step}.`);
  return undefined;
}
const rounded = (value: number) => Number(value.toPrecision(12));

function SliderWidget({ props, events, style }: WidgetRenderProps) {
  const input = React.useRef<HTMLInputElement>(null);
  const id = React.useId();
  const value = number(props.value);
  const capturedInitial = React.useRef(value);
  const initialValue = own(props, 'initialValue') ? number(props.initialValue, value) : capturedInitial.current;
  const disabled = bool(props.disabled);
  const readOnly = bool(props.readOnly);
  const minimum = number(props.minimum);
  const maximum = number(props.maximum, 100);
  const step = number(props.step, 1);
  const validate = React.useCallback((candidate: Json) => sliderIssue(props, candidate), [props]);
  return <Field
    type="Slider" props={props} events={events} value={value} initialValue={initialValue} disabled={disabled}
    validate={validate} focus={() => input.current?.focus()}
  >{(error, describedBy, changed) => {
    const commit = (candidate: number) => {
      if (readOnly) return;
      const next = rounded(Math.min(maximum, Math.max(minimum, candidate)));
      changed(next);
      void events.change?.(next);
    };
    return <>
      <div className="pe-slider-label">{label(props, id)}<output htmlFor={id}>{value}{text(props.valueLabel)}</output></div>
      <input
        ref={input} id={id} className="pe-slider" style={style} type="range" value={value} min={minimum} max={maximum}
        step={step} disabled={disabled} aria-readonly={readOnly || undefined} aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={event => {
          if (readOnly) { event.currentTarget.value = String(value); return; }
          commit(event.currentTarget.valueAsNumber);
        }}
        onPointerDown={event => { if (readOnly) event.preventDefault(); }}
        onKeyDown={event => {
          const delta = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? step : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -step : undefined;
          if (delta !== undefined) { event.preventDefault(); commit(value + delta); }
          else if (event.key === 'Home') { event.preventDefault(); commit(minimum); }
          else if (event.key === 'End') { event.preventDefault(); commit(maximum); }
        }}
      />
    </>;
  }}</Field>;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
function dateIssue(props: Record<string, Json>, candidate: Json): string | undefined {
  const value = text(candidate);
  const required = requiredIssue(props, !value);
  if (required) return required;
  if (!value) return undefined;
  if (!validDate(value)) return text(props.formatMessage, 'Choose a valid date.');
  const minimum = text(props.minimum);
  const maximum = text(props.maximum);
  if (minimum && value < minimum) return text(props.minimumMessage, `Choose ${minimum} or later.`);
  if (maximum && value > maximum) return text(props.maximumMessage, `Choose ${maximum} or earlier.`);
  return undefined;
}

function DatePickerWidget({ props, events, style }: WidgetRenderProps) {
  const input = React.useRef<HTMLInputElement>(null);
  const id = React.useId();
  const value = text(props.value);
  const capturedInitial = React.useRef(value);
  const initialValue = own(props, 'initialValue') ? text(props.initialValue) : capturedInitial.current;
  const disabled = bool(props.disabled);
  const validate = React.useCallback((candidate: Json) => dateIssue(props, candidate), [props]);
  return <Field type="DatePicker" props={props} events={events} value={value} initialValue={initialValue} disabled={disabled} validate={validate} focus={() => input.current?.focus()}>
    {(error, describedBy, changed) => <>
      {label(props, id)}
      <Input
        ref={input} id={id} style={style} type="date" value={value} disabled={disabled} readOnly={bool(props.readOnly)}
        min={text(props.minimum) || undefined} max={text(props.maximum) || undefined} required={bool(props.required)}
        aria-invalid={error ? true : undefined} aria-describedby={describedBy}
        onChange={event => { const next = event.currentTarget.value; changed(next); void events.change?.(next); }}
      />
    </>}
  </Field>;
}

function colorIssue(props: Record<string, Json>, candidate: Json): string | undefined {
  const value = text(candidate);
  const required = requiredIssue(props, !value);
  if (required) return required;
  return value && !/^#[\da-f]{6}$/iu.test(value) ? text(props.formatMessage, 'Choose a six-digit hex color.') : undefined;
}

function ColorPickerWidget({ props, events, style }: WidgetRenderProps) {
  const input = React.useRef<HTMLInputElement>(null);
  const id = React.useId();
  const value = text(props.value);
  const capturedInitial = React.useRef(value);
  const initialValue = own(props, 'initialValue') ? text(props.initialValue) : capturedInitial.current;
  const disabled = bool(props.disabled);
  const validate = React.useCallback((candidate: Json) => colorIssue(props, candidate), [props]);
  return <Field type="ColorPicker" props={props} events={events} value={value} initialValue={initialValue} disabled={disabled} validate={validate} focus={() => input.current?.focus()}>
    {(error, describedBy, changed) => <>
      {label(props, id)}
      <div className="pe-color-row">
        <input
          ref={input} id={id} className="pe-color-input" style={style} type="color" value={value} disabled={disabled || bool(props.readOnly)}
          aria-invalid={error ? true : undefined} aria-describedby={describedBy}
          onChange={event => { const next = event.currentTarget.value; changed(next); void events.change?.(next); }}
        />
        <output htmlFor={id}>{value}</output>
      </div>
    </>}
  </Field>;
}

function fileIssue(props: Record<string, Json>, candidate: Json): string | undefined {
  return requiredIssue(props, !stringArray(candidate).length);
}
function displayName(path: string): string {
  const parts = path.split(/[\\/]/u);
  return parts[parts.length - 1] || path;
}

function FilePickerWidget({ props, events, style, runtime }: WidgetRenderProps) {
  const button = React.useRef<HTMLButtonElement>(null);
  const value = stringArray(props.value);
  const capturedInitial = React.useRef(value);
  const initialValue = own(props, 'initialValue') ? stringArray(props.initialValue) : capturedInitial.current;
  const disabled = bool(props.disabled);
  const readOnly = bool(props.readOnly);
  const [busy, setBusy] = React.useState(false);
  const [hostError, setHostError] = React.useState<string>();
  const mounted = React.useRef(true);
  React.useEffect(() => () => { mounted.current = false; }, []);
  const unavailable = runtime.selection ? undefined : 'File selection is unavailable in this host.';
  const validate = React.useCallback((candidate: Json) => fileIssue(props, candidate), [props]);
  return <Field
    type="FilePicker" props={props} events={events} value={value} initialValue={initialValue} disabled={disabled}
    runtimeError={hostError || unavailable} validate={validate} focus={() => button.current?.focus()}
  >{(_error, describedBy, changed) => <>
    <span className="pe-field-label">{text(props.label)}{bool(props.required) && <span aria-hidden="true"> *</span>}</span>
    <div className="pe-file-row" style={style}>
      <Button
        ref={button} variant="outline" size="sm" disabled={disabled || readOnly || busy || !runtime.selection}
        aria-describedby={describedBy}
        onClick={async () => {
          if (!runtime.selection) return;
          setBusy(true);
          setHostError(undefined);
          try {
            const selected = await runtime.selection({
              selectionType: text(props.selectionType) === 'directory' ? 'directory' : 'file',
              multiple: bool(props.multiple), title: text(props.title) || undefined,
              initialPath: text(props.initialPath) || value[0], buttonLabel: text(props.buttonLabel) || undefined,
              filters: Array.isArray(props.filters) ? props.filters.map(item => {
                const filter = object(item);
                return { name: text(filter.name), extensions: stringArray(filter.extensions) };
              }) : undefined,
            });
            if (!mounted.current) return;
            if (selected === null) { await events.cancel?.(null); return; }
            const next = bool(props.multiple) ? selected : selected.slice(0, 1);
            changed(next);
            await events.change?.(next);
          } catch (reason) {
            if (!mounted.current) return;
            const message = reason instanceof Error ? reason.message : String(reason);
            setHostError(message);
            await events.error?.(message);
          } finally {
            if (mounted.current) setBusy(false);
          }
        }}
      >{busy ? 'Choosing…' : text(props.buttonLabel, 'Choose')}</Button>
      <span className="pe-file-summary">{value.length ? `${value.length} selected` : 'None selected'}</span>
    </div>
    {value.length > 0 && <ul className="pe-file-list">{value.map((path, index) => <li key={`${path}:${index}`} title={path}>{displayName(path)}</li>)}</ul>}
  </>}</Field>;
}

const renderers: Record<string, WidgetDefinition['render']> = {
  Select: SelectWidget,
  Autocomplete: AutocompleteWidget,
  Slider: SliderWidget,
  DatePicker: DatePickerWidget,
  ColorPicker: ColorPickerWidget,
  FilePicker: FilePickerWidget,
};
const contracts = { Select, Autocomplete, Slider, DatePicker, ColorPicker, FilePicker };
export const selectionRuntimeWidgets: Record<string, WidgetDefinition> = Object.fromEntries(
  Object.entries(contracts).map(([type, widget]) => [type, { contract: widget.contract, render: renderers[type] }]),
);
