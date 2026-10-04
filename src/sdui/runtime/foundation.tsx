import { Button, Column, Text } from '../authoring/foundation';
import type { RuntimeCatalog } from './session';

export const foundationRuntimeCatalog: RuntimeCatalog = { widgets: {
  Text: {
    contract: Text.contract,
    render: ({ props, style }) => <p style={style}>{String(props.text)}</p>,
  },
  Column: {
    contract: Column.contract,
    render: ({ props, style, slots }) => <div style={{ ...style, display: 'flex', flexDirection: 'column', gap: Number(props.gap ?? 12) }}>{slots.children}</div>,
  },
  Button: {
    contract: Button.contract,
    render: ({ props, style, events }) => <button type="button" style={style} disabled={Boolean(props.disabled)} onClick={() => void events.press?.(null)}>{String(props.label)}</button>,
  },
} };
