/* eslint-disable react-refresh/only-export-components -- Runtime renderers are registered as component factories. */
import * as React from 'react';
import { Button as UiButton } from '../../components/ui';
import { FolderTree, ImportQueue, LibraryPicker, MetadataEditor, TagPicker } from '../authoring/eagle';
import type { Json } from '../schema/model';
import type { WidgetDefinition } from './session';
import type { WidgetRenderProps } from './view';

const text = (value: Json | undefined, fallback = '') => typeof value === 'string' ? value : fallback;
const number = (value: Json | undefined, fallback = 0) => typeof value === 'number' ? value : fallback;
const bool = (value: Json | undefined, fallback = false) => typeof value === 'boolean' ? value : fallback;
const strings = (value: Json | undefined): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const object = (value: Json | undefined): Record<string, Json> => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

function StateContent({ status, empty, error, hasItems, retry, children }: {
  status: string; empty: string; error: string; hasItems: boolean; retry?: () => void; children: React.ReactNode;
}) {
  if (status === 'loading') return <div className="pe-eagle-state" role="status">Loading</div>;
  if (status === 'error') return <div className="pe-eagle-state pe-eagle-state-error" role="alert">
    <span>{error}</span>{retry && <UiButton type="button" variant="outline" size="sm" onClick={retry}>Retry</UiButton>}
  </div>;
  return hasItems ? <>{children}</> : <div className="pe-eagle-state">{empty}</div>;
}

interface FolderItem { id: string; name: string; description: string; parentId: string }
function folderItems(value: Json | undefined): FolderItem[] {
  if (!Array.isArray(value)) return [];
  return value.map(raw => {
    const item = object(raw);
    return { id: text(item.id), name: text(item.name), description: text(item.description), parentId: text(item.parentId) };
  }).filter(item => item.id);
}

function FolderTreeWidget({ props, events, style }: WidgetRenderProps) {
  const folders = folderItems(props.folders);
  const expanded = strings(props.expanded);
  const selected = text(props.selection);
  const disabled = bool(props.disabled);
  const children = new Map<string, FolderItem[]>();
  const ids = new Set(folders.map(item => item.id));
  folders.forEach(item => {
    const parent = item.parentId && ids.has(item.parentId) ? item.parentId : '';
    children.set(parent, [...(children.get(parent) ?? []), item]);
  });
  const visible: Array<{ item: FolderItem; level: number; hasChildren: boolean }> = [];
  const seen = new Set<string>();
  const visit = (item: FolderItem, level: number) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    const descendants = children.get(item.id) ?? [];
    visible.push({ item, level, hasChildren: descendants.length > 0 });
    if (expanded.includes(item.id)) descendants.forEach(child => visit(child, level + 1));
  };
  (children.get('') ?? []).forEach(item => visit(item, 0));
  folders.filter(item => !seen.has(item.id)).forEach(item => visit(item, 0));
  const toggle = (id: string) => void events.expandedChange?.(
    expanded.includes(id) ? expanded.filter(item => item !== id) : [...expanded, id],
  );
  return <section data-pe-widget="FolderTree" className="pe-eagle-panel" style={style}>
    <StateContent status={text(props.status, 'ready')} empty={text(props.emptyText, 'No folders')}
      error={text(props.errorText, 'Unable to load folders')} hasItems={visible.length > 0}
      retry={() => void events.retry?.(null)}
    ><div role="tree" aria-label={text(props.label)} aria-disabled={disabled || undefined} className="pe-folder-tree">
      {visible.map(({ item, level, hasChildren }) => <div
        key={item.id} role="treeitem" aria-level={level + 1} aria-selected={selected === item.id}
        aria-expanded={hasChildren ? expanded.includes(item.id) : undefined} className="pe-folder-row"
        style={{ paddingLeft: 8 + level * 16 }}
      >
        <button type="button" disabled={disabled || !hasChildren} aria-label={`${expanded.includes(item.id) ? 'Collapse' : 'Expand'} ${item.name}`}
          onClick={() => toggle(item.id)}>{hasChildren ? expanded.includes(item.id) ? '−' : '+' : '·'}</button>
        <button type="button" disabled={disabled} onClick={() => void events.selectionChange?.(item.id)}
          onDoubleClick={() => void events.open?.(item.id)}>{item.name || item.id}</button>
      </div>)}
    </div></StateContent>
  </section>;
}

interface TagItem { name: string; count: number; color: string; groups: string[] }
function tagItems(value: Json | undefined): TagItem[] {
  if (!Array.isArray(value)) return [];
  return value.map(raw => {
    const item = object(raw);
    return { name: text(item.name), count: number(item.count), color: text(item.color), groups: strings(item.groups) };
  }).filter(item => item.name);
}

function TagPickerWidget({ props, events, style }: WidgetRenderProps) {
  const tags = tagItems(props.tags);
  const selection = strings(props.selection);
  const disabled = bool(props.disabled);
  const toggle = (name: string) => void events.selectionChange?.(
    selection.includes(name) ? selection.filter(item => item !== name) : [...selection, name],
  );
  return <section data-pe-widget="TagPicker" className="pe-eagle-panel pe-eagle-picker" aria-label={text(props.label)} style={style}>
    <StateContent status={text(props.status, 'ready')} empty={text(props.emptyText, 'No tags')}
      error={text(props.errorText, 'Unable to load tags')} hasItems={tags.length > 0}
      retry={() => void events.retry?.(null)}
    ><div className="pe-tag-list">{tags.map(tag => <label key={tag.name} className="pe-tag-row">
      <input type="checkbox" checked={selection.includes(tag.name)} disabled={disabled}
        onChange={() => toggle(tag.name)} />
      <span className="pe-tag-color" style={{ background: tag.color || undefined }} aria-hidden="true" />
      <span>{tag.name}</span><span>{tag.count}</span>
    </label>)}</div></StateContent>
    <PickerActions props={props} events={events} selection={selection} disabled={disabled} />
  </section>;
}

interface LibraryItem { id: string; name: string; path: string; status: string; reason: string }
function libraryItems(value: Json | undefined): LibraryItem[] {
  if (!Array.isArray(value)) return [];
  return value.map(raw => {
    const item = object(raw);
    return { id: text(item.id), name: text(item.name), path: text(item.path), status: text(item.status), reason: text(item.reason) };
  }).filter(item => item.id && item.path);
}

function PickerActions({ props, events, selection, disabled }: {
  props: Record<string, Json>; events: WidgetRenderProps['events']; selection: string[]; disabled: boolean;
}) {
  return <footer className="pe-eagle-actions">
    <UiButton type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => void events.cancel?.(null)}>{text(props.cancelLabel, 'Cancel')}</UiButton>
    <UiButton type="button" size="sm" disabled={disabled || selection.length === 0}
      onClick={() => void events.confirm?.(selection)}>{text(props.confirmLabel, 'Use selection')}</UiButton>
  </footer>;
}

function LibraryPickerWidget({ props, events, style }: WidgetRenderProps) {
  const libraries = libraryItems(props.libraries);
  const selection = text(props.selection);
  const disabled = bool(props.disabled);
  const groupName = React.useId();
  return <section data-pe-widget="LibraryPicker" className="pe-eagle-panel pe-eagle-picker" aria-label={text(props.label)} style={style}>
    <StateContent status={text(props.status, 'ready')} empty={text(props.emptyText, 'No libraries')}
      error={text(props.errorText, 'Unable to load libraries')} hasItems={libraries.length > 0}
      retry={() => void events.retry?.(null)}
    ><div role="radiogroup" aria-label={text(props.label)} className="pe-library-list">{libraries.map(item => <label key={item.id} className="pe-library-row">
      <input type="radio" name={groupName} checked={selection === item.path}
        disabled={disabled || item.status !== 'available'} onChange={() => void events.selectionChange?.(item.path)} />
      <span><strong>{item.name || item.path}</strong><small>{item.path}</small></span>
      <span data-state={item.status}>{item.status}{item.reason ? `: ${item.reason}` : ''}</span>
    </label>)}</div></StateContent>
    <footer className="pe-eagle-actions">
      <UiButton type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => void events.cancel?.(null)}>{text(props.cancelLabel, 'Cancel')}</UiButton>
      <UiButton type="button" size="sm" disabled={disabled || !selection || libraries.find(item => item.path === selection)?.status !== 'available'}
        onClick={() => void events.confirm?.(selection)}>{text(props.confirmLabel, 'Open library')}</UiButton>
    </footer>
  </section>;
}

function MetadataEditorWidget({ props, events, style }: WidgetRenderProps) {
  const assetId = text(props.assetId);
  const [draft, setDraft] = React.useState(() => ({
    name: text(props.name), annotation: text(props.annotation), tags: strings(props.tags).join(', '),
    folderIds: strings(props.folderIds).join(', '), rating: number(props.rating),
  }));
  React.useEffect(() => setDraft({
    name: text(props.name), annotation: text(props.annotation), tags: strings(props.tags).join(', '),
    folderIds: strings(props.folderIds).join(', '), rating: number(props.rating),
  }), [assetId, props.name, props.annotation, props.tags, props.folderIds, props.rating]);
  const disabled = bool(props.disabled) || text(props.status) === 'saving';
  const split = (value: string) => [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))];
  return <form data-pe-widget="MetadataEditor" className="pe-metadata-editor pe-eagle-panel" style={style}
    onSubmit={event => {
      event.preventDefault();
      void events.submit?.({ id: assetId, name: draft.name.trim(), annotation: draft.annotation, tags: split(draft.tags), folderIds: split(draft.folderIds), rating: draft.rating });
    }}
  >
    <label>Name<input aria-label="Asset name" value={draft.name} disabled={disabled} required onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} /></label>
    <label>Annotation<textarea aria-label="Asset annotation" value={draft.annotation} disabled={disabled} onChange={event => setDraft(current => ({ ...current, annotation: event.target.value }))} /></label>
    <label>Tags<input aria-label="Asset tags" value={draft.tags} disabled={disabled} onChange={event => setDraft(current => ({ ...current, tags: event.target.value }))} /></label>
    <label>Folder ids<input aria-label="Asset folder ids" value={draft.folderIds} disabled={disabled} onChange={event => setDraft(current => ({ ...current, folderIds: event.target.value }))} /></label>
    <label>Rating<input aria-label="Asset rating" type="number" min={0} max={5} step={1} value={draft.rating} disabled={disabled}
      onChange={event => setDraft(current => ({ ...current, rating: Math.max(0, Math.min(5, Math.round(event.target.valueAsNumber || 0))) }))} /></label>
    {text(props.message) && <div role={text(props.status) === 'error' ? 'alert' : 'status'}>{text(props.message)}</div>}
    <footer className="pe-eagle-actions">
      <UiButton type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => void events.cancel?.(null)}>Cancel</UiButton>
      <UiButton type="submit" size="sm" disabled={disabled || !draft.name.trim()}>Save metadata</UiButton>
    </footer>
  </form>;
}

interface ImportItem { id: string; source: string; kind: 'path' | 'url'; status: string; assetId: string; message: string }
function importItems(value: Json | undefined): ImportItem[] {
  if (!Array.isArray(value)) return [];
  return value.map(raw => {
    const item = object(raw);
    const kind: 'path' | 'url' = text(item.kind) === 'url' ? 'url' : 'path';
    return {
      id: text(item.id), source: text(item.source), kind,
      status: text(item.status), assetId: text(item.assetId), message: text(item.message),
    };
  }).filter(item => item.id && item.source);
}

function ImportQueueWidget({ props, events, style }: WidgetRenderProps) {
  const items = importItems(props.items);
  const disabled = bool(props.disabled);
  return <section data-pe-widget="ImportQueue" className="pe-import-queue pe-eagle-panel" aria-label={text(props.label)} style={style}>
    {items.length ? items.map(item => <article key={item.id} data-import-id={item.id} data-state={item.status}>
      <span><strong>{item.source}</strong><small>{item.kind}</small></span>
      <span>{item.status}{item.assetId ? `: ${item.assetId}` : ''}{item.message ? `: ${item.message}` : ''}</span>
      {item.status === 'queued' && <UiButton type="button" size="sm" disabled={disabled}
        onClick={() => void events.import?.({ id: item.id, source: item.source, kind: item.kind })}>Import</UiButton>}
      {item.status === 'error' && <UiButton type="button" variant="outline" size="sm" disabled={disabled}
        onClick={() => void events.retry?.({ id: item.id, source: item.source, kind: item.kind })}>Retry</UiButton>}
      {item.status === 'importing' && <UiButton type="button" variant="ghost" size="sm" disabled={disabled}
        onClick={() => void events.cancel?.(item.id)}>Cancel</UiButton>}
    </article>) : <div className="pe-eagle-state">{text(props.emptyText, 'No imports')}</div>}
  </section>;
}

const renderers: Record<string, WidgetDefinition['render']> = {
  FolderTree: FolderTreeWidget,
  TagPicker: TagPickerWidget,
  LibraryPicker: LibraryPickerWidget,
  MetadataEditor: MetadataEditorWidget,
  ImportQueue: ImportQueueWidget,
};
const contracts = { FolderTree, TagPicker, LibraryPicker, MetadataEditor, ImportQueue };
export const eagleOperationRuntimeWidgets: Record<string, WidgetDefinition> = Object.fromEntries(
  Object.entries(contracts).map(([type, widget]) => [type, { contract: widget.contract, render: renderers[type] }]),
);
