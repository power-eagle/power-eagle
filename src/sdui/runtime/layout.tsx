import { Children, type CSSProperties, type ReactNode } from 'react';
import {
  Align, AspectRatio, Center, Column, ConstrainedBox, Expanded, Flexible, Padding, Positioned, Row, SizedBox, Spacer, Stack, Wrap,
} from '../authoring/layout';
import type { Json } from '../schema/model';
import type { WidgetDefinition } from './session';

const mainAxis: Record<string, CSSProperties['justifyContent']> = {
  start: 'flex-start', end: 'flex-end', center: 'center', spaceBetween: 'space-between', spaceAround: 'space-around', spaceEvenly: 'space-evenly',
};
const crossAxis: Record<string, CSSProperties['alignItems']> = {
  start: 'flex-start', end: 'flex-end', center: 'center', stretch: 'stretch', baseline: 'baseline',
};
const alignments: Record<string, { alignItems: CSSProperties['alignItems']; justifyItems: CSSProperties['justifyItems'] }> = {
  topLeft: { alignItems: 'start', justifyItems: 'start' }, topCenter: { alignItems: 'start', justifyItems: 'center' }, topRight: { alignItems: 'start', justifyItems: 'end' },
  centerLeft: { alignItems: 'center', justifyItems: 'start' }, center: { alignItems: 'center', justifyItems: 'center' }, centerRight: { alignItems: 'center', justifyItems: 'end' },
  bottomLeft: { alignItems: 'end', justifyItems: 'start' }, bottomCenter: { alignItems: 'end', justifyItems: 'center' }, bottomRight: { alignItems: 'end', justifyItems: 'end' },
};

const number = (value: Json | undefined): number | undefined => typeof value === 'number' ? value : undefined;
const text = (value: Json | undefined, fallback: string): string => typeof value === 'string' ? value : fallback;
const styled = (base: CSSProperties, style: CSSProperties): CSSProperties => ({ ...base, ...style });
const only = (slot: ReactNode): ReactNode => Array.isArray(slot) ? slot[0] : slot;

function flexContainer(direction: 'row' | 'column'): WidgetDefinition['render'] {
  return ({ props, style, slots }) => <div data-pe-widget={direction === 'row' ? 'Row' : 'Column'} style={styled({
    display: 'flex', flexDirection: direction, minWidth: 0, minHeight: 0,
    gap: number(props.gap) ?? (direction === 'column' ? 12 : 0),
    justifyContent: mainAxis[text(props.mainAxisAlignment, 'start')],
    alignItems: crossAxis[text(props.crossAxisAlignment, direction === 'column' ? 'stretch' : 'center')],
  }, style)}>{slots.children}</div>;
}

const renderers: Record<string, WidgetDefinition['render']> = {
  Row: flexContainer('row'),
  Column: flexContainer('column'),
  Stack: ({ props, style, slots }) => {
    const alignment = alignments[text(props.alignment, 'topLeft')];
    return <div data-pe-widget="Stack" style={styled({
      display: 'grid', position: 'relative', minWidth: 0, minHeight: 0,
      overflow: text(props.overflow, 'hidden') as CSSProperties['overflow'], ...alignment,
    }, style)}>{Children.map(slots.children, child => <div style={{ gridArea: '1 / 1' }}>{child}</div>)}</div>;
  },
  Positioned: ({ props, style, slots }) => <div data-pe-widget="Positioned" style={styled({
    position: 'absolute', left: number(props.left), right: number(props.right), top: number(props.top), bottom: number(props.bottom),
    width: number(props.width), height: number(props.height),
  }, style)}>{only(slots.child)}</div>,
  Wrap: ({ props, style, slots }) => <div data-pe-widget="Wrap" style={styled({
    display: 'flex', flexDirection: text(props.direction, 'row') as CSSProperties['flexDirection'], flexWrap: 'wrap', minWidth: 0,
    columnGap: number(props.gap) ?? 8, rowGap: number(props.runGap) ?? 8,
    justifyContent: mainAxis[text(props.alignment, 'start')], alignItems: crossAxis[text(props.crossAxisAlignment, 'center')],
  }, style)}>{slots.children}</div>,
  Padding: ({ props, style, slots }) => {
    const all = number(props.all) ?? 0;
    const horizontal = number(props.horizontal) ?? all;
    const vertical = number(props.vertical) ?? all;
    return <div data-pe-widget="Padding" style={styled({
      paddingTop: number(props.top) ?? vertical, paddingRight: number(props.right) ?? horizontal,
      paddingBottom: number(props.bottom) ?? vertical, paddingLeft: number(props.left) ?? horizontal,
    }, style)}>{only(slots.child)}</div>;
  },
  Align: ({ props, style, slots }) => <div data-pe-widget="Align" style={styled({
    display: 'grid', ...alignments[text(props.alignment, 'center')], minWidth: 0, minHeight: 0,
  }, style)}>{only(slots.child)}</div>,
  Center: ({ style, slots }) => <div data-pe-widget="Center" style={styled({
    display: 'grid', alignItems: 'center', justifyItems: 'center', minWidth: 0, minHeight: 0,
  }, style)}>{only(slots.child)}</div>,
  SizedBox: ({ props, style, slots }) => <div data-pe-widget="SizedBox" style={styled({
    width: number(props.width), height: number(props.height), flex: 'none',
  }, style)}>{only(slots.child)}</div>,
  ConstrainedBox: ({ props, style, slots }) => <div data-pe-widget="ConstrainedBox" style={styled({
    minWidth: number(props.minWidth), maxWidth: number(props.maxWidth), minHeight: number(props.minHeight), maxHeight: number(props.maxHeight),
  }, style)}>{only(slots.child)}</div>,
  Expanded: ({ props, style, slots }) => <div data-pe-widget="Expanded" style={styled({
    flexGrow: number(props.flex) ?? 1, flexShrink: 1, flexBasis: 0, minWidth: 0, minHeight: 0,
  }, style)}>{only(slots.child)}</div>,
  Flexible: ({ props, style, slots }) => <div data-pe-widget="Flexible" style={styled({
    flexGrow: number(props.flex) ?? 1, flexShrink: 1, flexBasis: text(props.fit, 'loose') === 'tight' ? 0 : 'auto', minWidth: 0, minHeight: 0,
  }, style)}>{only(slots.child)}</div>,
  Spacer: ({ props, style }) => <div data-pe-widget="Spacer" aria-hidden="true" style={styled({
    flexGrow: number(props.flex) ?? 1, flexShrink: 1, flexBasis: 0, minWidth: 0, minHeight: 0,
  }, style)} />,
  AspectRatio: ({ props, style, slots }) => <div data-pe-widget="AspectRatio" style={styled({
    aspectRatio: String(number(props.aspectRatio) ?? 1), minWidth: 0, overflow: 'hidden',
  }, style)}>{only(slots.child)}</div>,
};

const contracts = { Row, Column, Stack, Positioned, Wrap, Padding, Align, Center, SizedBox, ConstrainedBox, Expanded, Flexible, Spacer, AspectRatio };
export const layoutRuntimeWidgets: Record<string, WidgetDefinition> = Object.fromEntries(
  Object.entries(contracts).map(([type, widget]) => [type, { contract: widget.contract, render: renderers[type] }]),
);
