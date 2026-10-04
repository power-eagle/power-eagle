/* eslint-disable react-refresh/only-export-components -- Runtime renderers are registered as component factories. */
import * as React from 'react';
import {
  GridView, ListView, ScrollView, VirtualGrid, VirtualList,
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
    const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled || !children.length) return;
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
        className="pe-collection-item" style={virtualStyle}
        onClick={() => { if (!disabled) { setActiveState(child.key); changeSelection(child.key); } }}
        onDoubleClick={() => { if (!disabled) void events.activate?.(child.key); }}
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

const renderers: Record<string, WidgetDefinition['render']> = {
  ScrollView: ScrollViewWidget,
  ListView: collectionRenderer('list', false),
  GridView: collectionRenderer('grid', false),
  VirtualList: collectionRenderer('list', true),
  VirtualGrid: collectionRenderer('grid', true),
};
const contracts = { ScrollView, ListView, GridView, VirtualList, VirtualGrid };
export const collectionRuntimeWidgets: Record<string, WidgetDefinition> = Object.fromEntries(
  Object.entries(contracts).map(([type, widget]) => [type, {
    contract: widget.contract, render: renderers[type], ...(type === 'ScrollView' ? {} : { deferredSlots: ['children'] }),
  }]),
);
