import { Button, Text } from '../authoring/foundation';
import type { RuntimeCatalog } from './session';
import { layoutRuntimeWidgets } from './layout';

export const foundationRuntimeCatalog: RuntimeCatalog = { widgets: {
  ...layoutRuntimeWidgets,
  Text: {
    contract: Text.contract,
    render: ({ props, style }) => <p style={style}>{String(props.text)}</p>,
  },
  Button: {
    contract: Button.contract,
    render: ({ props, style, events }) => <button type="button" style={style} disabled={Boolean(props.disabled)} onClick={() => void events.press?.(null)}>{String(props.label)}</button>,
  },
} };
