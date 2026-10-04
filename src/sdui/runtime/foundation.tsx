import { Button } from '../authoring/foundation';
import type { RuntimeCatalog } from './session';
import { contentRuntimeWidgets } from './content';
import { formRuntimeWidgets } from './forms';
import { layoutRuntimeWidgets } from './layout';
import { selectionRuntimeWidgets } from './selection';

export const foundationRuntimeCatalog: RuntimeCatalog = { widgets: {
  ...layoutRuntimeWidgets,
  ...contentRuntimeWidgets,
  ...formRuntimeWidgets,
  ...selectionRuntimeWidgets,
  Button: {
    contract: Button.contract,
    render: ({ props, style, events }) => <button data-pe-widget="Button" type="button" style={style} disabled={Boolean(props.disabled)} onClick={() => void events.press?.(null)}>{String(props.label)}</button>,
  },
} };
