/* eslint-disable react-refresh/only-export-components -- Runtime renderers are registered as component factories. */
import * as React from 'react';
import { Button as UiButton } from '../../components/ui';
import {
  Banner, Dialog, EmptyState, ErrorState, ProgressIndicator, Skeleton, Toast,
} from '../authoring/feedback';
import type { Json } from '../schema/model';
import type { WidgetDefinition } from './session';
import type { WidgetRenderProps } from './view';

const text = (value: Json | undefined, fallback = '') => typeof value === 'string' ? value : fallback;
const number = (value: Json | undefined, fallback = 0) => typeof value === 'number' ? value : fallback;
const bool = (value: Json | undefined, fallback = false) => typeof value === 'boolean' ? value : fallback;
const object = (value: Json | undefined): Record<string, Json> => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const tone = (value: Json | undefined) => ['info', 'success', 'warning', 'error'].includes(text(value)) ? text(value) : 'info';

function ProgressIndicatorWidget({ props, style }: WidgetRenderProps) {
  const indeterminate = bool(props.indeterminate);
  const value = Math.max(0, Math.min(100, number(props.value)));
  const status = text(props.status) || (indeterminate ? 'In progress' : `${value}%`);
  return <div data-pe-widget="ProgressIndicator" className="pe-progress" data-tone={tone(props.tone)} style={style}>
    <div className="pe-progress-copy"><span>{text(props.label)}</span><span>{status}</span></div>
    <progress aria-label={text(props.label)} max={100} value={indeterminate ? undefined : value}>{status}</progress>
  </div>;
}

function SkeletonWidget({ props, style }: WidgetRenderProps) {
  const lines = Math.max(1, Math.floor(number(props.lines, 1)));
  return <div
    data-pe-widget="Skeleton" className="pe-skeleton" data-animated={bool(props.animated, true) || undefined}
    role="status" aria-label={text(props.label)} style={{ width: number(props.width) || undefined, height: number(props.height) || undefined, ...style }}
  ><span className="pe-skeleton-label">{text(props.label)}</span>{Array.from({ length: lines }, (_, index) => <span
    className="pe-skeleton-line" key={index} style={{ width: index === lines - 1 && lines > 1 ? '68%' : '100%' }} aria-hidden="true"
  />)}</div>;
}

function EmptyStateWidget({ props, events, style }: WidgetRenderProps) {
  return <section data-pe-widget="EmptyState" className="pe-feedback-state" data-tone="empty" style={style}>
    <strong>{text(props.title)}</strong>{text(props.message) && <p>{text(props.message)}</p>}
    {text(props.actionLabel) && <UiButton variant="outline" size="sm" type="button" onClick={() => void events.action?.(null)}>{text(props.actionLabel)}</UiButton>}
  </section>;
}

function ErrorStateWidget({ props, events, style }: WidgetRenderProps) {
  const retrying = bool(props.retrying);
  return <section data-pe-widget="ErrorState" className="pe-feedback-state" data-tone="error" role="alert" style={style}>
    <strong>{text(props.title)}</strong>{text(props.message) && <p>{text(props.message)}</p>}
    {text(props.retryLabel) && <UiButton
      variant="outline" size="sm" type="button" disabled={retrying} aria-busy={retrying || undefined}
      onClick={() => void events.retry?.(null)}
    >{retrying ? 'Retrying…' : text(props.retryLabel, 'Retry')}</UiButton>}
  </section>;
}

function BannerWidget({ props, events, style }: WidgetRenderProps) {
  return <section data-pe-widget="Banner" className="pe-banner" data-tone={tone(props.tone)} role={tone(props.tone) === 'error' ? 'alert' : 'status'} style={style}>
    <div className="pe-banner-copy"><strong>{text(props.title)}</strong>{text(props.message) && <span>{text(props.message)}</span>}</div>
    {text(props.actionLabel) && <button type="button" onClick={() => void events.action?.(null)}>{text(props.actionLabel)}</button>}
    {bool(props.dismissible) && <button type="button" aria-label={`Dismiss ${text(props.title)}`} onClick={() => void events.dismiss?.(null)}>×</button>}
  </section>;
}

function ToastWidget({ props, events, style, runtime }: WidgetRenderProps) {
  const id = text(props.id);
  const snapshot = runtime.feedback.snapshot(id, 'toast');
  const supplied = object(snapshot?.value);
  const message = typeof snapshot?.value === 'string' ? snapshot.value : text(supplied.message, text(props.message));
  const toastTone = tone(supplied.tone ?? props.tone);
  const open = snapshot ? snapshot.open : bool(props.open);
  const duration = number(props.duration, 5000);
  React.useEffect(() => {
    if (!open || duration <= 0) return;
    const timer = window.setTimeout(() => {
      runtime.feedback.close(id, 'toast');
      void events.close?.({ reason: 'timeout' });
    }, duration);
    return () => window.clearTimeout(timer);
  }, [duration, events, id, open, runtime.feedback, snapshot?.revision]);
  const close = () => {
    runtime.feedback.close(id, 'toast');
    void events.close?.({ reason: 'button' });
  };
  return <div
    data-pe-widget="Toast" className="pe-toast-layer" hidden={!open} aria-hidden={!open || undefined}
  ><div className="pe-toast" data-tone={toastTone} role={toastTone === 'error' ? 'alert' : 'status'} style={style}>
    <span>{message}</span>{bool(props.dismissible, true) && <button type="button" aria-label="Dismiss notification" onClick={close}>×</button>}
  </div></div>;
}

const focusable = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

function DialogWidget({ props, slots, events, style, runtime }: WidgetRenderProps) {
  const id = text(props.id);
  const snapshot = runtime.feedback.snapshot(id, 'dialog');
  const supplied = object(snapshot?.value);
  const title = text(supplied.title, text(props.title));
  const description = text(supplied.description, text(props.description));
  const open = snapshot ? snapshot.open : bool(props.open);
  const dialog = React.useRef<HTMLDivElement>(null);
  const invoker = React.useRef<HTMLElement | null>(null);
  const titleId = `${React.useId().replace(/:/g, '')}-title`;
  const descriptionId = `${titleId}-description`;
  React.useEffect(() => {
    if (!open) return;
    invoker.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => {
      (dialog.current?.querySelector<HTMLElement>(focusable) ?? dialog.current)?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      if (invoker.current?.isConnected) invoker.current.focus();
      invoker.current = null;
    };
  }, [open]);
  const close = (reason: 'button' | 'escape' | 'backdrop' | 'action') => {
    runtime.feedback.close(id, 'dialog');
    void events.close?.({ reason });
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && bool(props.closeOnEscape, true)) { event.preventDefault(); close('escape'); return; }
    if (event.key !== 'Tab') return;
    const elements = [...(dialog.current?.querySelectorAll<HTMLElement>(focusable) ?? [])];
    if (!elements.length) { event.preventDefault(); dialog.current?.focus(); return; }
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return <div
    data-pe-widget="Dialog" className="pe-dialog-layer" hidden={!open} aria-hidden={!open || undefined}
    onMouseDown={event => { if (event.target === event.currentTarget && bool(props.dismissible, true)) close('backdrop'); }}
  ><div
    ref={dialog} className="pe-dialog" role="dialog" aria-modal={bool(props.modal, true)}
    aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} tabIndex={-1}
    style={style} onKeyDown={onKeyDown}
  ><header><div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
    {bool(props.dismissible, true) && <button type="button" aria-label={`Close ${title}`} onClick={() => close('button')}>×</button>}
  </header><div className="pe-dialog-content">{slots.children}</div>{slots.actions && <footer>{slots.actions}</footer>}</div></div>;
}

const renderers: Record<string, WidgetDefinition['render']> = {
  ProgressIndicator: ProgressIndicatorWidget,
  Skeleton: SkeletonWidget,
  EmptyState: EmptyStateWidget,
  ErrorState: ErrorStateWidget,
  Banner: BannerWidget,
  Toast: ToastWidget,
  Dialog: DialogWidget,
};
const contracts = { ProgressIndicator, Skeleton, EmptyState, ErrorState, Banner, Toast, Dialog };
export const feedbackRuntimeWidgets: Record<string, WidgetDefinition> = Object.fromEntries(
  Object.entries(contracts).map(([type, widget]) => [type, { contract: widget.contract, render: renderers[type] }]),
);
