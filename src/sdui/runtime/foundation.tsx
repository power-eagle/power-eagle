import type { RuntimeCatalog } from './session';
import { contentRuntimeWidgets } from './content';
import { desktopRuntimeWidgets } from './desktop';
import { formRuntimeWidgets } from './forms';
import { layoutRuntimeWidgets } from './layout';
import { selectionRuntimeWidgets } from './selection';

export const foundationRuntimeCatalog: RuntimeCatalog = { widgets: {
  ...layoutRuntimeWidgets,
  ...contentRuntimeWidgets,
  ...formRuntimeWidgets,
  ...selectionRuntimeWidgets,
  ...desktopRuntimeWidgets,
} };
