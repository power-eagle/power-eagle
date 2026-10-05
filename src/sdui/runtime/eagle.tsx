/* eslint-disable react-refresh/only-export-components -- Runtime renderers are registered as component factories. */
import * as React from 'react';
import { Button as UiButton } from '../../components/ui';
import { AssetCard, AssetGrid, AssetPicker } from '../authoring/eagle';
import type { Json } from '../schema/model';
import type { WidgetDefinition } from './session';
import type { WidgetRenderProps } from './view';
import { eagleOperationRuntimeWidgets } from './eagle-operations';

const text = (value: Json | undefined, fallback = '') => typeof value === 'string' ? value : fallback;
const number = (value: Json | undefined, fallback = 0) => typeof value === 'number' ? value : fallback;
const bool = (value: Json | undefined, fallback = false) => typeof value === 'boolean' ? value : fallback;
const strings = (value: Json | undefined): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const object = (value: Json | undefined): Record<string, Json> => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

interface AssetItem {
  id: string; name: string; extension: string; width: number; height: number; url: string;
  annotation: string; tags: string[]; folderIds: string[]; rating: number;
  fileUrl: string; thumbnailUrl: string; modifiedAt: number;
}

function asset(value: Json | undefined): AssetItem | undefined {
  const item = object(value);
  const id = text(item.id);
  if (!id) return undefined;
  return {
    id, name: text(item.name), extension: text(item.extension), width: number(item.width), height: number(item.height),
    url: text(item.url), annotation: text(item.annotation), tags: strings(item.tags), folderIds: strings(item.folderIds),
    rating: number(item.rating), fileUrl: text(item.fileUrl), thumbnailUrl: text(item.thumbnailUrl), modifiedAt: number(item.modifiedAt),
  };
}

function assets(value: Json | undefined): AssetItem[] {
  return Array.isArray(value) ? value.map(asset).filter((item): item is AssetItem => item !== undefined) : [];
}

function AssetCardView({ item, selected, disabled, optionId, option, failureText, onSelect, onActivate, onImageError }: {
  item: AssetItem; selected: boolean; disabled: boolean; optionId?: string; option: boolean; failureText: string;
  onSelect(): void; onActivate(): void; onImageError(): void;
}) {
  const source = item.thumbnailUrl || item.fileUrl || item.url;
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [source]);
  const dimensions = item.width > 0 && item.height > 0 ? `${item.width} × ${item.height}` : 'Dimensions unavailable';
  return <button
    id={optionId} type="button" role={option ? 'option' : undefined} aria-selected={option ? selected : undefined}
    aria-pressed={option ? undefined : selected} disabled={disabled} className="pe-asset-card"
    data-asset-id={item.id} onClick={onSelect} onDoubleClick={onActivate}
  >
    <span className="pe-asset-preview">{source && !failed ? <img
      src={source} alt="" onError={() => { setFailed(true); onImageError(); }}
    /> : <span className="pe-asset-preview-failure">{failureText}</span>}</span>
    <span className="pe-asset-copy">
      <strong>{item.name || item.id}</strong>
      <span>{item.extension ? item.extension.toUpperCase() : 'ASSET'} · {dimensions}</span>
      <span>{item.tags.length ? item.tags.join(', ') : 'No tags'}{item.rating > 0 ? ` · ${item.rating}★` : ''}</span>
    </span>
  </button>;
}

function AssetCardWidget({ props, events, style }: WidgetRenderProps) {
  const item = asset(props.asset);
  if (!item) return <div data-pe-widget="AssetCard" className="pe-asset-card-invalid" role="alert" style={style}>Invalid asset</div>;
  return <div data-pe-widget="AssetCard" style={style}><AssetCardView
    item={item} selected={bool(props.selected)} disabled={bool(props.disabled)} option={false}
    failureText={text(props.failureText, 'Preview unavailable')}
    onSelect={() => void events.select?.(item.id)} onActivate={() => void events.activate?.(item.id)}
    onImageError={() => void events.imageError?.(item.id)}
  /></div>;
}

function AssetSurface({ widget, props, events, style }: WidgetRenderProps & { widget: 'AssetGrid' | 'AssetPicker' }) {
  const items = assets(props.assets);
  const selection = strings(props.selection);
  const selectionMode = text(props.selectionMode, widget === 'AssetPicker' ? 'multiple' : 'single');
  const status = text(props.status, 'ready');
  const disabled = bool(props.disabled);
  const generatedId = React.useId().replace(/:/gu, '');
  const [activeState, setActiveState] = React.useState<string>();
  const activeId = items.some(item => item.id === activeState) ? activeState
    : selection.find(id => items.some(item => item.id === id)) ?? items[0]?.id;
  const activeIndex = activeId ? items.findIndex(item => item.id === activeId) : -1;
  const select = (id: string) => {
    if (disabled || selectionMode === 'none') return;
    const next = selectionMode === 'single' ? [id]
      : selection.includes(id) ? selection.filter(item => item !== id) : [...selection, id];
    setActiveState(id);
    void events.selectionChange?.(next);
  };
  const move = (index: number) => {
    const next = Math.max(0, Math.min(items.length - 1, index));
    if (items[next]) setActiveState(items[next].id);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || !items.length || event.target !== event.currentTarget) return;
    const columns = Math.max(1, Math.floor(number(props.columns, 3)));
    let next: number | undefined;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key === 'ArrowRight') next = activeIndex + 1;
    else if (event.key === 'ArrowLeft') next = activeIndex - 1;
    else if (event.key === 'ArrowDown') next = activeIndex + columns;
    else if (event.key === 'ArrowUp') next = activeIndex - columns;
    if (next !== undefined) { event.preventDefault(); move(next); }
    else if ((event.key === ' ' || event.key === 'Spacebar') && activeId) { event.preventDefault(); select(activeId); }
    else if (event.key === 'Enter' && activeId) { event.preventDefault(); void events.activate?.(activeId); }
  };
  const content = status === 'loading' ? <div className="pe-asset-state" role="status">Loading Eagle assets</div>
    : status === 'error' ? <div className="pe-asset-state pe-asset-state-error" role="alert">
      <span>Unable to load Eagle assets</span>
      <details className="pe-asset-error-details">
        <summary>Error details</summary>
        <pre>{text(props.errorText, 'The host did not return asset data.')}</pre>
      </details>
      <UiButton type="button" variant="outline" size="sm" onClick={() => void events.retry?.(null)}>Retry</UiButton>
    </div>
      : !items.length ? <div className="pe-asset-state">{text(props.emptyText, 'No Eagle assets')}</div>
        : <div
          className="pe-asset-grid" role={selectionMode === 'none' ? 'list' : 'listbox'} aria-label={text(props.label)}
          aria-multiselectable={selectionMode === 'multiple' || undefined} aria-disabled={disabled || undefined}
          aria-activedescendant={activeIndex >= 0 ? `${generatedId}-asset-${activeIndex}` : undefined}
          tabIndex={disabled ? -1 : 0} onKeyDown={onKeyDown} style={{
            gridTemplateColumns: `repeat(${Math.max(1, Math.floor(number(props.columns, 3)))}, minmax(0, 1fr))`,
            gap: Math.max(0, number(props.gap, 8)), height: number(props.height) || undefined,
            overflowY: props.height ? 'auto' : undefined,
          }}
        >{items.map((item, index) => <AssetCardView
          key={item.id} item={item} selected={selection.includes(item.id)} disabled={disabled}
          option={selectionMode !== 'none'} optionId={`${generatedId}-asset-${index}`}
          failureText={text(props.failureText, 'Preview unavailable')}
          onSelect={() => select(item.id)} onActivate={() => void events.activate?.(item.id)}
          onImageError={() => void events.imageError?.(item.id)}
        />)}</div>;

  if (widget === 'AssetGrid') return <section data-pe-widget="AssetGrid" className="pe-asset-surface" style={style}>{content}</section>;
  return <section data-pe-widget="AssetPicker" className="pe-asset-picker pe-asset-surface" aria-label={text(props.label)} style={style}>
    {content}
    <footer>
      <span>{selection.length} selected</span>
      <span className="pe-asset-picker-actions">
        <UiButton type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => void events.cancel?.(null)}>{text(props.cancelLabel, 'Cancel')}</UiButton>
        <UiButton type="button" size="sm" disabled={disabled || status !== 'ready' || selection.length === 0} onClick={() => void events.confirm?.(selection)}>{text(props.confirmLabel, 'Use selection')}</UiButton>
      </span>
    </footer>
  </section>;
}

const renderers: Record<string, WidgetDefinition['render']> = {
  AssetCard: AssetCardWidget,
  AssetGrid: props => <AssetSurface {...props} widget="AssetGrid" />,
  AssetPicker: props => <AssetSurface {...props} widget="AssetPicker" />,
};
const contracts = { AssetCard, AssetGrid, AssetPicker };
export const eagleRuntimeWidgets: Record<string, WidgetDefinition> = Object.fromEntries(
  Object.entries(contracts).map(([type, widget]) => [type, { contract: widget.contract, render: renderers[type] }]),
);
Object.assign(eagleRuntimeWidgets, eagleOperationRuntimeWidgets);
