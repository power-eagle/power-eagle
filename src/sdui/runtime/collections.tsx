/* eslint-disable react-refresh/only-export-components -- Runtime renderers are registered as component factories. */
import * as React from 'react';
import {
  DataTable, GridView, ListView, PropertyGrid, ReorderableList, ScrollView, TreeView, VirtualGrid, VirtualList,
} from '../authoring/collections';
import type { Json } from '../schema/model';
import type { ResolvedNode, WidgetDefinition } from './session';
import type { WidgetRenderProps } from './view';

const text = (value: Json | undefined, fallback = '') => typeof value === 'string' ? value : fallback;
const number = (value: Json | undefined, fallback = 0) => typeof value === 'number' ? value : fallback;
const bool = (value: Json | undefined, fallback = false) => typeof value === 'boolean' ? value : fallback;
const strings = (value: Json | undefined): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const integer = (value: Json | undefined, fallback: number) => Math.max(1, Math.floor(number(value, fallback)));
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function ScrollViewWidget({ props, slots, events, style }: WidgetRenderProps) {
  const direction = text(props.direction, 'vertical');
  return <div
    data-pe-widget="ScrollView" className="pe-scroll-view" style={{
      overflowX: direction === 'horizontal' || direction === 'both' ? 'auto' : 'hidden',
      overflowY: direction === 'vertical' || direction === 'both' ? 'auto' : 'hidden',
      width: number(props.width) || undefined, height: number(props.height) || undefined, ...style,
    }}
    onScroll={event => void events.scroll?.({ x: event.currentTarget.scrollLeft, y: event.currentTarget.scrollTop })}
  >{slots.children}</div>;
}

type CollectionKind = 'list' | 'grid';

function collectionRenderer(kind: CollectionKind, virtual: boolean): WidgetDefinition['render'] {
  function CollectionWidget({ props, slots, nodeSlots, renderNode, events, style, node }: WidgetRenderProps) {
    const root = React.useRef<HTMLDivElement>(null);
    const generatedId = React.useId().replace(/:/g, '');
    const children = [...(nodeSlots.children ?? [])];
    const selected = strings(props.selection);
    const selectionMode = text(props.selectionMode, 'none');
    const disabled = bool(props.disabled);
    const columns = kind === 'grid' ? integer(props.columns, 3) : 1;
    const gap = Math.max(0, number(props.gap, 8));
    const height = Math.max(1, number(props.height, virtual ? 240 : 0));
    const itemExtent = Math.max(1, number(props.itemExtent, 40));
    const rowExtent = Math.max(1, number(props.rowExtent, 96));
    const overscan = Math.max(0, Math.floor(number(props.overscan, kind === 'grid' ? 1 : 2)));
    const [activeState, setActiveState] = React.useState<string>();
    const [scrollTop, setScrollTop] = React.useState(0);
    const [dragKey, setDragKey] = React.useState<string>();
    const reorderable = node.type === 'ReorderableList';
    const activeKey = children.some(child => child.key === activeState) ? activeState
      : selected.find(key => children.some(child => child.key === key)) ?? children[0]?.key;
    const activeIndex = activeKey === undefined ? -1 : children.findIndex(child => child.key === activeKey);
    const selectable = selectionMode === 'single' || selectionMode === 'multiple';
    const rows = Math.ceil(children.length / columns);
    const stride = kind === 'grid' ? rowExtent + gap : itemExtent;
    const firstUnit = virtual ? Math.max(0, Math.floor(scrollTop / stride) - overscan) : 0;
    const visibleUnits = virtual ? Math.ceil(height / stride) + overscan * 2 + 1 : (kind === 'grid' ? rows : children.length);
    const lastUnit = virtual ? Math.min(kind === 'grid' ? rows : children.length, firstUnit + visibleUnits) : (kind === 'grid' ? rows : children.length);
    const firstIndex = kind === 'grid' ? firstUnit * columns : firstUnit;
    const lastIndex = kind === 'grid' ? Math.min(children.length, lastUnit * columns) : lastUnit;
    const visibleChildren = virtual ? children.slice(firstIndex, lastIndex) : children;

    const publishScroll = (element: HTMLDivElement) => {
      if (virtual) setScrollTop(element.scrollTop);
      void events.scroll?.({ x: element.scrollLeft, y: element.scrollTop });
    };
    const scrollToIndex = (index: number) => {
      const element = root.current;
      if (!element) return;
      if (!virtual) {
        element.querySelector<HTMLElement>(`[data-pe-index="${index}"]`)?.scrollIntoView?.({ block: 'nearest' });
        return;
      }
      const unit = kind === 'grid' ? Math.floor(index / columns) : index;
      const top = unit * stride;
      const bottom = top + (kind === 'grid' ? rowExtent : itemExtent);
      const next = top < element.scrollTop ? top : bottom > element.scrollTop + height ? bottom - height : element.scrollTop;
      if (next !== element.scrollTop) {
        element.scrollTop = next;
        setScrollTop(next);
        void events.scroll?.({ x: element.scrollLeft, y: next });
      }
    };
    const moveActive = (index: number) => {
      const next = clamp(index, 0, children.length - 1);
      const item = children[next];
      if (!item) return;
      setActiveState(item.key);
      scrollToIndex(next);
    };
    const changeSelection = (key: string) => {
      if (disabled || !selectable) return;
      const next = selectionMode === 'single' ? [key]
        : selected.includes(key) ? selected.filter(item => item !== key) : [...selected, key];
      void events.selectionChange?.(next);
    };
    const reorder = (from: number, to: number) => {
      if (!reorderable || disabled || from === to || from < 0 || to < 0 || from >= children.length || to >= children.length) return;
      const ordered = children.map(child => child.key);
      const [moved] = ordered.splice(from, 1);
      ordered.splice(to, 0, moved);
      setActiveState(moved);
      void events.reorder?.(ordered);
    };
    const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled || !children.length) return;
      if (reorderable && event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault();
        reorder(activeIndex, clamp(activeIndex + (event.key === 'ArrowDown' ? 1 : -1), 0, children.length - 1));
        return;
      }
      let next: number | undefined;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = children.length - 1;
      else if (event.key === 'ArrowDown') next = activeIndex + (kind === 'grid' ? columns : 1);
      else if (event.key === 'ArrowUp') next = activeIndex - (kind === 'grid' ? columns : 1);
      else if (kind === 'grid' && event.key === 'ArrowRight') next = activeIndex + 1;
      else if (kind === 'grid' && event.key === 'ArrowLeft') next = activeIndex - 1;
      if (next !== undefined) {
        event.preventDefault();
        moveActive(next);
      } else if ((event.key === ' ' || event.key === 'Spacebar') && activeKey) {
        event.preventDefault();
        changeSelection(activeKey);
      } else if (event.key === 'Enter' && activeKey) {
        event.preventDefault();
        void events.activate?.(activeKey);
      }
    };
    const renderItem = (child: ResolvedNode, offset: number) => {
      const index = firstIndex + offset;
      const isSelected = selected.includes(child.key);
      const row = Math.floor(index / columns);
      const column = index % columns;
      const virtualStyle: React.CSSProperties | undefined = !virtual ? undefined : kind === 'list' ? {
        position: 'absolute', top: index * itemExtent, left: 0, right: 0, height: itemExtent,
        paddingBottom: Math.min(gap, Math.max(0, itemExtent - 1)),
      } : {
        position: 'absolute', top: row * stride, left: `${column / columns * 100}%`, width: `${100 / columns}%`,
        height: rowExtent, paddingRight: column === columns - 1 ? 0 : gap, paddingBottom: gap,
      };
      return <div
        id={`${generatedId}-item-${index}`} key={child.key} role={selectable ? 'option' : 'listitem'}
        aria-selected={selectable ? isSelected : undefined} aria-disabled={disabled || undefined}
        data-pe-collection-item="" data-pe-key={child.key} data-pe-index={index}
        className="pe-collection-item" style={virtualStyle} draggable={reorderable && !disabled}
        onClick={() => { if (!disabled) { setActiveState(child.key); changeSelection(child.key); } }}
        onDoubleClick={() => { if (!disabled) void events.activate?.(child.key); }}
        onDragStart={() => setDragKey(child.key)}
        onDragOver={event => { if (reorderable && !disabled) event.preventDefault(); }}
        onDrop={event => {
          if (!reorderable || disabled) return;
          event.preventDefault();
          reorder(children.findIndex(item => item.key === dragKey), index);
          setDragKey(undefined);
        }}
        onDragEnd={() => setDragKey(undefined)}
      >{renderNode(child)}</div>;
    };
    const totalHeight = kind === 'list' ? children.length * itemExtent : Math.max(0, rows * stride - gap);
    const gridTemplate = number(props.minimumItemWidth) > 0
      ? `repeat(auto-fill, minmax(${number(props.minimumItemWidth)}px, 1fr))`
      : `repeat(${columns}, minmax(0, 1fr))`;
    const rootStyle: React.CSSProperties = virtual ? {
      position: 'relative', height, overflowY: 'auto', overflowX: 'hidden', ...style,
    } : kind === 'grid' ? {
      display: 'grid', gridTemplateColumns: gridTemplate, gap,
      height: height || undefined, overflowY: height ? 'auto' : undefined, ...style,
    } : {
      display: 'flex', flexDirection: 'column', gap,
      height: height || undefined, overflowY: height ? 'auto' : undefined, ...style,
    };
    return <div
      ref={root} data-pe-widget={node.type} data-virtual={virtual || undefined}
      className={`pe-collection pe-collection-${kind}${virtual ? ' pe-collection-virtual' : ''}`}
      style={rootStyle} role={selectable ? 'listbox' : 'list'} aria-label={text(props.label)}
      aria-multiselectable={selectionMode === 'multiple' || undefined}
      aria-activedescendant={activeIndex >= 0 ? `${generatedId}-item-${activeIndex}` : undefined}
      aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : 0}
      onKeyDown={onKeyDown} onScroll={event => publishScroll(event.currentTarget)}
    >
      {!children.length ? <div className="pe-collection-empty">{slots.empty}</div> : virtual ? <div
        className="pe-collection-virtual-space" style={{ position: 'relative', height: totalHeight }}
      >{visibleChildren.map(renderItem)}</div> : visibleChildren.map(renderItem)}
    </div>;
  }
  return CollectionWidget;
}

const object = (value: Json | undefined): Record<string, Json> => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

interface TreeEntry { id: string; label: string; parentId?: string; disabled: boolean }
interface VisibleTreeEntry { item: TreeEntry; level: number; hasChildren: boolean }
function treeEntries(value: Json | undefined): TreeEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map(raw => {
    const item = object(raw);
    const parentId = text(item.parentId);
    return { id: text(item.id), label: text(item.label), ...(parentId ? { parentId } : {}), disabled: bool(item.disabled) };
  }).filter(item => item.id && item.label);
}
function visibleTree(entries: TreeEntry[], expanded: string[]): VisibleTreeEntry[] {
  const ids = new Set(entries.map(item => item.id));
  const children = new Map<string, TreeEntry[]>();
  entries.forEach(item => {
    const parent = item.parentId && ids.has(item.parentId) ? item.parentId : '';
    children.set(parent, [...(children.get(parent) ?? []), item]);
  });
  const result: VisibleTreeEntry[] = [];
  const seen = new Set<string>();
  const visit = (item: TreeEntry, level: number) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    const descendants = children.get(item.id) ?? [];
    result.push({ item, level, hasChildren: descendants.length > 0 });
    if (expanded.includes(item.id)) descendants.forEach(child => visit(child, level + 1));
  };
  (children.get('') ?? []).forEach(item => visit(item, 1));
  entries.forEach(item => { if (!seen.has(item.id)) visit(item, 1); });
  return result;
}

function TreeViewWidget({ props, slots, events, style }: WidgetRenderProps) {
  const root = React.useRef<HTMLDivElement>(null);
  const generatedId = React.useId().replace(/:/g, '');
  const entries = treeEntries(props.items);
  const expanded = strings(props.expanded);
  const selected = strings(props.selection);
  const mode = text(props.selectionMode, 'single');
  const disabled = bool(props.disabled);
  const visible = visibleTree(entries, expanded);
  const [activeState, setActiveState] = React.useState<string>();
  const activeKey = visible.some(entry => entry.item.id === activeState && !entry.item.disabled) ? activeState
    : selected.find(id => visible.some(entry => entry.item.id === id && !entry.item.disabled))
      ?? visible.find(entry => !entry.item.disabled)?.item.id;
  const activeIndex = visible.findIndex(entry => entry.item.id === activeKey);
  const changeSelection = (id: string) => {
    if (disabled || mode === 'none') return;
    const next = mode === 'multiple'
      ? selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id]
      : [id];
    void events.selectionChange?.(next);
  };
  const changeExpanded = (id: string, open: boolean) => {
    const next = open ? [...expanded.filter(item => item !== id), id] : expanded.filter(item => item !== id);
    void events.expandedChange?.(next);
  };
  const move = (target: number) => {
    if (!visible.length) return;
    const direction = target >= activeIndex ? 1 : -1;
    let next = clamp(target, 0, visible.length - 1);
    while (visible[next]?.item.disabled && next + direction >= 0 && next + direction < visible.length) next += direction;
    const entry = visible[next];
    if (!entry || entry.item.disabled) return;
    setActiveState(entry.item.id);
    root.current?.querySelector<HTMLElement>(`[data-tree-id="${entry.item.id}"]`)?.scrollIntoView?.({ block: 'nearest' });
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = visible[activeIndex];
    if (disabled || !current) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); move(activeIndex + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); move(activeIndex - 1); }
    else if (event.key === 'Home') { event.preventDefault(); move(0); }
    else if (event.key === 'End') { event.preventDefault(); move(visible.length - 1); }
    else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (current.hasChildren && !expanded.includes(current.item.id)) changeExpanded(current.item.id, true);
      else if (current.hasChildren) move(activeIndex + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (current.hasChildren && expanded.includes(current.item.id)) changeExpanded(current.item.id, false);
      else if (current.item.parentId) {
        const parent = visible.findIndex(entry => entry.item.id === current.item.parentId);
        if (parent >= 0) move(parent);
      }
    } else if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault(); changeSelection(current.item.id);
    } else if (event.key === 'Enter') {
      event.preventDefault(); void events.activate?.(current.item.id);
    }
  };
  return <div
    ref={root} data-pe-widget="TreeView" className="pe-tree" role="tree" aria-label={text(props.label)}
    aria-multiselectable={mode === 'multiple' || undefined} aria-disabled={disabled || undefined}
    aria-activedescendant={activeIndex >= 0 ? `${generatedId}-tree-${activeIndex}` : undefined}
    tabIndex={disabled ? -1 : 0} style={{ height: number(props.height) || undefined, overflowY: props.height ? 'auto' : undefined, ...style }}
    onKeyDown={onKeyDown}
  >{!entries.length ? <div className="pe-collection-empty">{slots.empty}</div> : visible.map((entry, index) => {
    const open = expanded.includes(entry.item.id);
    const isSelected = selected.includes(entry.item.id);
    return <div
      id={`${generatedId}-tree-${index}`} key={entry.item.id} data-tree-id={entry.item.id}
      role="treeitem" aria-level={entry.level} aria-expanded={entry.hasChildren ? open : undefined}
      aria-selected={mode === 'none' ? undefined : isSelected} aria-disabled={entry.item.disabled || disabled || undefined}
      className="pe-tree-item" style={{ paddingLeft: `calc(var(--space-2) + ${(entry.level - 1) * 16}px)` }}
      onClick={() => { if (!disabled && !entry.item.disabled) { setActiveState(entry.item.id); changeSelection(entry.item.id); } }}
      onDoubleClick={() => { if (!disabled && !entry.item.disabled) void events.activate?.(entry.item.id); }}
    >{entry.hasChildren ? <button
      type="button" className="pe-tree-toggle" tabIndex={-1} disabled={disabled || entry.item.disabled}
      aria-label={`${open ? 'Collapse' : 'Expand'} ${entry.item.label}`}
      onClick={event => { event.stopPropagation(); changeExpanded(entry.item.id, !open); }}
    >{open ? '−' : '+'}</button> : <span className="pe-tree-spacer" aria-hidden="true" />}
    <span>{entry.item.label}</span></div>;
  })}</div>;
}

interface TableColumn { key: string; label: string; type: string; sortable: boolean; align: string }
function tableColumns(value: Json | undefined): TableColumn[] {
  if (!Array.isArray(value)) return [];
  return value.map(raw => {
    const column = object(raw);
    return {
      key: text(column.key), label: text(column.label), type: text(column.type, 'string'),
      sortable: bool(column.sortable), align: text(column.align, 'start'),
    };
  }).filter(column => column.key && column.label);
}
const displayValue = (value: Json | undefined, type = 'string') => {
  if (value === null || value === undefined) return '';
  if (type === 'boolean') return value === true ? 'Yes' : value === false ? 'No' : String(value);
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};
const compareValues = (left: Json | undefined, right: Json | undefined, type: string) => {
  if (type === 'number') return number(left) - number(right);
  if (type === 'boolean') return Number(bool(left)) - Number(bool(right));
  return displayValue(left, type).localeCompare(displayValue(right, type), undefined, { numeric: true, sensitivity: 'base' });
};

function DataTableWidget({ props, slots, events, style }: WidgetRenderProps) {
  const columns = tableColumns(props.columns);
  const rowKey = text(props.rowKey, 'id');
  const rows = Array.isArray(props.rows) ? props.rows.map(object) : [];
  const selection = strings(props.selection);
  const mode = text(props.selectionMode, 'none');
  const sortColumn = text(props.sortColumn);
  const sortDirection = text(props.sortDirection, 'ascending');
  const disabled = bool(props.disabled);
  const sortable = columns.find(column => column.key === sortColumn);
  const sortedRows = rows.map((row, index) => ({ row, index })).sort((left, right) => {
    if (!sortable) return left.index - right.index;
    const result = compareValues(left.row[sortable.key], right.row[sortable.key], sortable.type);
    return (sortDirection === 'descending' ? -result : result) || left.index - right.index;
  }).map(entry => entry.row);
  const idOf = (row: Record<string, Json>) => displayValue(row[rowKey]);
  const select = (id: string) => {
    if (disabled || mode === 'none' || !id) return;
    const next = mode === 'multiple'
      ? selection.includes(id) ? selection.filter(item => item !== id) : [...selection, id]
      : [id];
    void events.selectionChange?.(next);
  };
  const sort = (column: TableColumn) => {
    if (disabled || !column.sortable) return;
    const direction = sortColumn === column.key && sortDirection === 'ascending' ? 'descending' : 'ascending';
    void events.sortChange?.({ column: column.key, direction });
  };
  return <div
    data-pe-widget="DataTable" className="pe-data-table-wrap"
    style={{ height: number(props.height) || undefined, overflow: props.height ? 'auto' : undefined, ...style }}
  >{!rows.length ? <div className="pe-collection-empty">{slots.empty}</div> : <table className="pe-data-table">
    <caption>{text(props.label)}</caption>
    <thead><tr>{columns.map(column => <th
      key={column.key} scope="col" style={{ textAlign: column.align as React.CSSProperties['textAlign'] }}
      aria-sort={sortColumn === column.key ? sortDirection as 'ascending' | 'descending' : undefined}
    >{column.sortable ? <button type="button" disabled={disabled} onClick={() => sort(column)}>{column.label}</button> : column.label}</th>)}</tr></thead>
    <tbody>{sortedRows.map(row => {
      const id = idOf(row);
      const isSelected = selection.includes(id);
      return <tr
        key={id} data-row-id={id} aria-selected={mode === 'none' ? undefined : isSelected}
        tabIndex={disabled ? -1 : 0} onClick={() => select(id)} onDoubleClick={() => { if (!disabled) void events.activate?.(id); }}
        onKeyDown={event => {
          if (disabled) return;
          if (event.key === ' ' || event.key === 'Spacebar') { event.preventDefault(); select(id); }
          else if (event.key === 'Enter') { event.preventDefault(); void events.activate?.(id); }
        }}
      >{columns.map(column => <td key={column.key} style={{ textAlign: column.align as React.CSSProperties['textAlign'] }}>
        {displayValue(row[column.key], column.type)}
      </td>)}</tr>;
    })}</tbody>
  </table>}</div>;
}

interface PropertyOption { value: string; label: string }
interface PropertyEntry { id: string; label: string; value: Json; editor: string; editable: boolean; options: PropertyOption[]; description: string }
function propertyEntries(value: Json | undefined): PropertyEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map(raw => {
    const item = object(raw);
    const options = Array.isArray(item.options) ? item.options.map(rawOption => {
      const option = object(rawOption); return { value: text(option.value), label: text(option.label) };
    }) : [];
    return {
      id: text(item.id), label: text(item.label), value: item.value ?? null,
      editor: text(item.editor, typeof item.value === 'number' ? 'number' : typeof item.value === 'boolean' ? 'boolean' : 'text'),
      editable: bool(item.editable), options, description: text(item.description),
    };
  }).filter(item => item.id && item.label);
}

function PropertyGridWidget({ props, slots, events, style }: WidgetRenderProps) {
  const entries = propertyEntries(props.items);
  const disabled = bool(props.disabled);
  const generatedId = React.useId().replace(/:/g, '');
  const controlId = (id: string) => `${generatedId}-property-${id}`;
  const change = (item: PropertyEntry, value: Json) => void events.change?.({ id: item.id, value });
  const editor = (item: PropertyEntry) => {
    if (!item.editable) return <output id={controlId(item.id)}>{displayValue(item.value, item.editor)}</output>;
    if (item.editor === 'boolean') return <input
      id={controlId(item.id)} type="checkbox" checked={item.value === true} disabled={disabled}
      onChange={event => change(item, event.currentTarget.checked)}
    />;
    if (item.editor === 'select') return <select
      id={controlId(item.id)} value={displayValue(item.value)} disabled={disabled}
      onChange={event => change(item, event.currentTarget.value)}
    >{item.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
    return <input
      id={controlId(item.id)} type={item.editor === 'number' ? 'number' : item.editor === 'date' ? 'date' : item.editor === 'color' ? 'color' : 'text'}
      value={displayValue(item.value)} disabled={disabled}
      onChange={event => {
        if (item.editor !== 'number') change(item, event.currentTarget.value);
        else if (event.currentTarget.value !== '') change(item, Number(event.currentTarget.value));
      }}
    />;
  };
  return <div
    data-pe-widget="PropertyGrid" className="pe-property-grid" role="group" aria-label={text(props.label)}
    aria-disabled={disabled || undefined} data-columns={integer(props.columns, 1)} style={style}
  >{!entries.length ? <div className="pe-collection-empty">{slots.empty}</div> : entries.map(item => <div className="pe-property-row" key={item.id}>
    <div className="pe-property-label"><label htmlFor={controlId(item.id)}>{item.label}</label>{item.description && <small>{item.description}</small>}</div>
    <div className="pe-property-value">{editor(item)}</div>
  </div>)}</div>;
}

const renderers: Record<string, WidgetDefinition['render']> = {
  ScrollView: ScrollViewWidget,
  ListView: collectionRenderer('list', false),
  GridView: collectionRenderer('grid', false),
  VirtualList: collectionRenderer('list', true),
  VirtualGrid: collectionRenderer('grid', true),
  ReorderableList: collectionRenderer('list', false),
  TreeView: TreeViewWidget,
  DataTable: DataTableWidget,
  PropertyGrid: PropertyGridWidget,
};
const contracts = { ScrollView, ListView, GridView, VirtualList, VirtualGrid, ReorderableList, TreeView, DataTable, PropertyGrid };
const deferredTypes = new Set(['ListView', 'GridView', 'VirtualList', 'VirtualGrid', 'ReorderableList']);
export const collectionRuntimeWidgets: Record<string, WidgetDefinition> = Object.fromEntries(
  Object.entries(contracts).map(([type, widget]) => [type, {
    contract: widget.contract, render: renderers[type], ...(deferredTypes.has(type) ? { deferredSlots: ['children'] } : {}),
  }]),
);
