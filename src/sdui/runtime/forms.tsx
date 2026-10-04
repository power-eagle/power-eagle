/* eslint-disable react-refresh/only-export-components -- Runtime renderers are registered as component factories. */
import * as React from 'react';
import { Input, Switch as UiSwitch } from '../../components/ui';
import {
  Checkbox, Form, NumberField, RadioGroup, Switch, TextArea, TextField,
} from '../authoring/forms';
import type { Json } from '../schema/model';
import type { WidgetDefinition } from './session';
import type { WidgetRenderProps } from './view';

type ValidationMode = 'submit' | 'change' | 'always';
interface FormResult { valid: boolean; values: Record<string, Json>; errors: Record<string, string> }
interface FieldHandle {
  id: string;
  value: Json;
  initialValue: Json;
  disabled: boolean;
  validate(value?: Json): string | undefined;
  reset(): Promise<Json>;
  focus(): void;
}
interface FormContextValue {
  validationMode: ValidationMode;
  register(field: FieldHandle): () => void;
  error(id: string): string | undefined;
  changed(id: string, issue?: string): void;
}

const FormContext = React.createContext<FormContextValue | undefined>(undefined);
const own = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);
const text = (value: Json | undefined, fallback = '') => typeof value === 'string' ? value : fallback;
const number = (value: Json | undefined) => typeof value === 'number' ? value : undefined;
const bool = (value: Json | undefined, fallback = false) => typeof value === 'boolean' ? value : fallback;
const object = (value: Json | undefined): Record<string, Json> => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const validationMode = (value: Json | undefined): ValidationMode => ['change', 'always'].includes(String(value)) ? value as ValidationMode : 'submit';
const sameRecord = (left: Record<string, string>, right: Record<string, string>) => {
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => left[key] === right[key]);
};

function FormWidget({ props, slots, events, style, runtime }: WidgetRenderProps) {
  const id = text(props.id);
  const mode = validationMode(props.validationMode);
  const fields = React.useRef(new Map<string, Set<FieldHandle>>());
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const eventsRef = React.useRef(events);
  eventsRef.current = events;

  const register = React.useCallback((field: FieldHandle) => {
    const handles = fields.current.get(field.id) ?? new Set<FieldHandle>();
    handles.add(field);
    fields.current.set(field.id, handles);
    return () => {
      handles.delete(field);
      if (!handles.size) fields.current.delete(field.id);
    };
  }, []);
  const changed = React.useCallback((fieldId: string, issue?: string) => {
    setErrors(current => {
      const next = { ...current };
      if (mode === 'change' && issue) next[fieldId] = issue;
      else delete next[fieldId];
      return sameRecord(current, next) ? current : next;
    });
  }, [mode]);

  const inspect = React.useCallback((focus: boolean): FormResult => {
    const values: Record<string, Json> = {};
    const nextErrors: Record<string, string> = {};
    let firstInvalid: FieldHandle | undefined;
    for (const [fieldId, handles] of fields.current) {
      if (handles.size !== 1) {
        nextErrors[fieldId] = `Duplicate field id ${fieldId}.`;
        firstInvalid ??= [...handles][0];
        continue;
      }
      const field = [...handles][0];
      if (field.disabled) continue;
      values[fieldId] = structuredClone(field.value);
      const issue = field.validate();
      if (issue) {
        nextErrors[fieldId] = issue;
        firstInvalid ??= field;
      }
    }
    setErrors(current => sameRecord(current, nextErrors) ? current : nextErrors);
    if (focus) firstInvalid?.focus();
    return { valid: !Object.keys(nextErrors).length, values, errors: nextErrors };
  }, []);

  const run = React.useCallback(async (operation: 'validate' | 'submit' | 'reset', signal: AbortSignal): Promise<Json> => {
    if (signal.aborted) throw new DOMException('Form operation was aborted', 'AbortError');
    if (operation === 'reset') {
      const values: Record<string, Json> = {};
      const registered = [...fields.current.entries()].map(([fieldId, handles]) => [fieldId, [...handles]] as const);
      for (const [fieldId, handles] of registered) {
        if (handles.length !== 1) continue;
        const field = handles[0];
        const value = await field.reset();
        if (!field.disabled) values[fieldId] = value;
      }
      setErrors({});
      await eventsRef.current.reset?.(values);
      return { valid: true, values, errors: {} };
    }
    const result = inspect(operation === 'submit');
    if (operation === 'validate') return result as unknown as Json;
    if (!result.valid) {
      await eventsRef.current.invalid?.(result as unknown as Json);
      return result as unknown as Json;
    }
    await eventsRef.current.submit?.(result.values);
    return result as unknown as Json;
  }, [inspect]);

  React.useEffect(() => runtime.forms.register(id, { run }), [id, run, runtime.forms]);
  const context = React.useMemo<FormContextValue>(() => ({
    validationMode: mode, register, error: fieldId => errors[fieldId], changed,
  }), [changed, errors, mode, register]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run('submit', new AbortController().signal);
  };
  const reset = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run('reset', new AbortController().signal);
  };
  return <FormContext.Provider value={context}>
    <form data-pe-widget="Form" data-form-id={id} className="pe-form" style={style} noValidate onSubmit={submit} onReset={reset}>
      {slots.children}
    </form>
  </FormContext.Provider>;
}

export interface FieldProps {
  type: string;
  props: Record<string, Json>;
  events: WidgetRenderProps['events'];
  value: Json;
  initialValue: Json;
  disabled: boolean;
  runtimeError?: string;
  validate(value: Json): string | undefined;
  focus(): void;
  children(error: string | undefined, describedBy: string | undefined, changed: (value: Json) => void): React.ReactNode;
}

export function Field({ type, props, events, value, initialValue, disabled, runtimeError, validate, focus, children }: FieldProps) {
  const form = React.useContext(FormContext);
  const id = text(props.id);
  const description = text(props.description);
  const explicitError = runtimeError || text(props.error);
  const descriptionId = React.useId();
  const errorId = React.useId();
  const handle = React.useMemo<FieldHandle>(() => ({
    id, value, initialValue, disabled,
    validate: candidate => explicitError || validate(candidate ?? value),
    reset: async () => {
      form?.changed(id);
      await events.change?.(initialValue);
      return initialValue;
    },
    focus,
  }), [disabled, events, explicitError, focus, form, id, initialValue, validate, value]);
  React.useEffect(() => form?.register(handle), [form, handle]);
  const issue = explicitError || (form?.validationMode === 'always' ? validate(value) : form?.error(id));
  const describedBy = [description ? descriptionId : '', issue ? errorId : ''].filter(Boolean).join(' ') || undefined;
  const changed = (next: Json) => form?.changed(id, explicitError || validate(next));
  return <div data-pe-widget={type} data-pe-field={id} data-state={issue ? 'invalid' : 'valid'} className="pe-field">
    {children(issue, describedBy, changed)}
    {description && <div id={descriptionId} className="pe-field-description">{description}</div>}
    {issue && <div id={errorId} className="pe-field-error">{issue}</div>}
  </div>;
}

export function requiredIssue(props: Record<string, Json>, empty: boolean): string | undefined {
  return bool(props.required) && empty ? text(props.requiredMessage, `${text(props.label)} is required.`) : undefined;
}
function textIssue(props: Record<string, Json>, candidate: Json): string | undefined {
  const value = text(candidate);
  const required = requiredIssue(props, !value.trim());
  if (required) return required;
  const min = number(props.minLength);
  if (min !== undefined && value.length < min) return text(props.minLengthMessage, `Enter at least ${min} characters.`);
  const max = number(props.maxLength);
  if (max !== undefined && value.length > max) return text(props.maxLengthMessage, `Enter no more than ${max} characters.`);
  const pattern = text(props.pattern);
  if (pattern) {
    try {
      if (!new RegExp(pattern, 'u').test(value)) return text(props.patternMessage, 'Enter a value in the requested format.');
    } catch { return text(props.patternMessage, 'The declared validation pattern is invalid.'); }
  }
  return undefined;
}

function TextFieldWidget({ props, events, style }: WidgetRenderProps) {
  const input = React.useRef<HTMLInputElement>(null);
  const id = React.useId();
  const value = text(props.value);
  const capturedInitial = React.useRef(value);
  const initialValue = own(props, 'initialValue') ? text(props.initialValue) : capturedInitial.current;
  const disabled = bool(props.disabled);
  const readOnly = bool(props.readOnly);
  const validate = React.useCallback((candidate: Json) => textIssue(props, candidate), [props]);
  return <Field
    type="TextField" props={props} events={events} value={value} initialValue={initialValue} disabled={disabled}
    validate={validate} focus={() => input.current?.focus()}
  >{(error, describedBy, changed) => <>
    <label className="pe-field-label" htmlFor={id}>{text(props.label)}{bool(props.required) && <span aria-hidden="true"> *</span>}</label>
    <Input
      ref={input} id={id} style={style} type={text(props.inputType, 'text')} value={value}
      placeholder={text(props.placeholder) || undefined} disabled={disabled} readOnly={readOnly}
      required={bool(props.required)}
      minLength={number(props.minLength)} maxLength={number(props.maxLength)}
      aria-invalid={error ? true : undefined} aria-describedby={describedBy}
      onChange={event => {
        const next = event.currentTarget.value;
        changed(next);
        void events.change?.(next);
      }}
    />
  </>}</Field>;
}

function TextAreaWidget({ props, events, style }: WidgetRenderProps) {
  const input = React.useRef<HTMLTextAreaElement>(null);
  const id = React.useId();
  const value = text(props.value);
  const capturedInitial = React.useRef(value);
  const initialValue = own(props, 'initialValue') ? text(props.initialValue) : capturedInitial.current;
  const disabled = bool(props.disabled);
  const validate = React.useCallback((candidate: Json) => textIssue(props, candidate), [props]);
  return <Field
    type="TextArea" props={props} events={events} value={value} initialValue={initialValue} disabled={disabled}
    validate={validate} focus={() => input.current?.focus()}
  >{(error, describedBy, changed) => <>
    <label className="pe-field-label" htmlFor={id}>{text(props.label)}{bool(props.required) && <span aria-hidden="true"> *</span>}</label>
    <textarea
      ref={input} id={id} className="pe-input pe-textarea" style={style} value={value} rows={number(props.rows) ?? 4}
      placeholder={text(props.placeholder) || undefined} disabled={disabled} readOnly={bool(props.readOnly)}
      required={bool(props.required)}
      minLength={number(props.minLength)} maxLength={number(props.maxLength)}
      aria-invalid={error ? true : undefined} aria-describedby={describedBy}
      onChange={event => { const next = event.currentTarget.value; changed(next); void events.change?.(next); }}
    />
  </>}</Field>;
}

export function numberIssue(props: Record<string, Json>, candidate: Json): string | undefined {
  if (typeof candidate !== 'number' || !Number.isFinite(candidate)) return text(props.requiredMessage, `${text(props.label)} is required.`);
  const minimum = number(props.minimum);
  if (minimum !== undefined && candidate < minimum) return text(props.minimumMessage, `Enter ${minimum} or more.`);
  const maximum = number(props.maximum);
  if (maximum !== undefined && candidate > maximum) return text(props.maximumMessage, `Enter ${maximum} or less.`);
  if (bool(props.integer) && !Number.isInteger(candidate)) return text(props.integerMessage, 'Enter a whole number.');
  const step = number(props.step);
  if (step !== undefined) {
    const base = minimum ?? 0;
    const steps = (candidate - base) / step;
    if (Math.abs(steps - Math.round(steps)) > 1e-9) return text(props.stepMessage, `Enter a value in steps of ${step}.`);
  }
  return undefined;
}

function NumberFieldWidget({ props, events, style }: WidgetRenderProps) {
  const input = React.useRef<HTMLInputElement>(null);
  const id = React.useId();
  const value = number(props.value) ?? 0;
  const capturedInitial = React.useRef(value);
  const initialValue = own(props, 'initialValue') ? number(props.initialValue) ?? value : capturedInitial.current;
  const disabled = bool(props.disabled);
  const validate = React.useCallback((candidate: Json) => numberIssue(props, candidate), [props]);
  return <Field
    type="NumberField" props={props} events={events} value={value} initialValue={initialValue} disabled={disabled}
    validate={validate} focus={() => input.current?.focus()}
  >{(error, describedBy, changed) => <>
    <label className="pe-field-label" htmlFor={id}>{text(props.label)}{bool(props.required) && <span aria-hidden="true"> *</span>}</label>
    <Input
      ref={input} id={id} style={style} type="number" value={value} disabled={disabled} readOnly={bool(props.readOnly)}
      placeholder={text(props.placeholder) || undefined} min={number(props.minimum)} max={number(props.maximum)}
      required={bool(props.required)}
      step={bool(props.integer) ? 1 : number(props.step) ?? 'any'} aria-invalid={error ? true : undefined} aria-describedby={describedBy}
      onChange={event => {
        const next = event.currentTarget.valueAsNumber;
        if (Number.isFinite(next)) { changed(next); void events.change?.(next); }
      }}
    />
  </>}</Field>;
}

function booleanIssue(props: Record<string, Json>, candidate: Json): string | undefined {
  return requiredIssue(props, candidate !== true);
}

function CheckboxWidget({ props, events, style }: WidgetRenderProps) {
  const input = React.useRef<HTMLInputElement>(null);
  const id = React.useId();
  const value = bool(props.value);
  const capturedInitial = React.useRef(value);
  const initialValue = own(props, 'initialValue') ? bool(props.initialValue) : capturedInitial.current;
  const disabled = bool(props.disabled);
  const validate = React.useCallback((candidate: Json) => booleanIssue(props, candidate), [props]);
  return <Field
    type="Checkbox" props={props} events={events} value={value} initialValue={initialValue} disabled={disabled}
    validate={validate} focus={() => input.current?.focus()}
  >{(error, describedBy, changed) => <label className="pe-choice-row" htmlFor={id}>
    <input
      ref={input} id={id} type="checkbox" className="pe-choice-input" style={style} checked={value} disabled={disabled}
      required={bool(props.required)}
      aria-invalid={error ? true : undefined} aria-describedby={describedBy}
      onChange={event => { const next = event.currentTarget.checked; changed(next); void events.change?.(next); }}
    />
    <span>{text(props.label)}{bool(props.required) && <span aria-hidden="true"> *</span>}</span>
  </label>}</Field>;
}

interface RadioOption { value: string; label: string; disabled: boolean }
function options(value: Json | undefined): RadioOption[] {
  return Array.isArray(value) ? value.map(item => {
    const option = object(item);
    return { value: text(option.value), label: text(option.label), disabled: bool(option.disabled) };
  }) : [];
}
function RadioGroupWidget({ props, events, style }: WidgetRenderProps) {
  const inputs = React.useRef<Array<HTMLInputElement | null>>([]);
  const legendId = React.useId();
  const name = React.useId();
  const value = text(props.value);
  const capturedInitial = React.useRef(value);
  const initialValue = own(props, 'initialValue') ? text(props.initialValue) : capturedInitial.current;
  const disabled = bool(props.disabled);
  const choices = options(props.options);
  const validate = React.useCallback((candidate: Json) => {
    const selected = text(candidate);
    const required = requiredIssue(props, !selected);
    if (required) return required;
    if (selected && !choices.some(option => option.value === selected)) return text(props.optionMessage, 'Select one of the available options.');
    return undefined;
  }, [choices, props]);
  return <Field
    type="RadioGroup" props={props} events={events} value={value} initialValue={initialValue} disabled={disabled}
    validate={validate} focus={() => (inputs.current.find(input => input?.checked) ?? inputs.current.find(Boolean))?.focus()}
  >{(error, describedBy, changed) => <fieldset className="pe-radio-group" style={style} disabled={disabled} aria-required={bool(props.required)} aria-invalid={error ? true : undefined} aria-describedby={describedBy}>
    <legend id={legendId} className="pe-field-label">{text(props.label)}{bool(props.required) && <span aria-hidden="true"> *</span>}</legend>
    {choices.map((option, index) => <label className="pe-choice-row" key={option.value}>
      <input
        ref={element => { inputs.current[index] = element; }} type="radio" className="pe-choice-input" name={name}
        value={option.value} checked={value === option.value} disabled={option.disabled}
        onChange={() => { changed(option.value); void events.change?.(option.value); }}
      />
      <span>{option.label}</span>
    </label>)}
  </fieldset>}</Field>;
}

function SwitchWidget({ props, events, style }: WidgetRenderProps) {
  const input = React.useRef<HTMLButtonElement>(null);
  const labelId = React.useId();
  const value = bool(props.value);
  const capturedInitial = React.useRef(value);
  const initialValue = own(props, 'initialValue') ? bool(props.initialValue) : capturedInitial.current;
  const disabled = bool(props.disabled);
  const validate = React.useCallback((candidate: Json) => booleanIssue(props, candidate), [props]);
  return <Field
    type="Switch" props={props} events={events} value={value} initialValue={initialValue} disabled={disabled}
    validate={validate} focus={() => input.current?.focus()}
  >{(error, describedBy, changed) => <div className="pe-switch-row">
    <span id={labelId}>{text(props.label)}{bool(props.required) && <span aria-hidden="true"> *</span>}</span>
    <UiSwitch
      ref={input} style={style} checked={value} disabled={disabled} aria-labelledby={labelId}
      aria-required={bool(props.required)}
      aria-invalid={error ? true : undefined} aria-describedby={describedBy}
      onCheckedChange={next => { changed(next); void events.change?.(next); }}
    />
  </div>}</Field>;
}

const renderers: Record<string, WidgetDefinition['render']> = {
  Form: FormWidget,
  TextField: TextFieldWidget,
  TextArea: TextAreaWidget,
  NumberField: NumberFieldWidget,
  Checkbox: CheckboxWidget,
  RadioGroup: RadioGroupWidget,
  Switch: SwitchWidget,
};
const contracts = { Form, TextField, TextArea, NumberField, Checkbox, RadioGroup, Switch };
export const formRuntimeWidgets: Record<string, WidgetDefinition> = Object.fromEntries(
  Object.entries(contracts).map(([type, widget]) => [type, { contract: widget.contract, render: renderers[type] }]),
);
