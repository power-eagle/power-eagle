import type { RuntimeCatalog } from './session';
import { collectionRuntimeWidgets } from './collections';
import { contentRuntimeWidgets } from './content';
import { desktopRuntimeWidgets } from './desktop';
import { eagleRuntimeWidgets } from './eagle';
import { formRuntimeWidgets } from './forms';
import { feedbackRuntimeWidgets } from './feedback';
import { layoutRuntimeWidgets } from './layout';
import { mediaRuntimeWidgets } from './media';
import { selectionRuntimeWidgets } from './selection';

export const foundationRuntimeCatalog: RuntimeCatalog = { widgets: {
  ...layoutRuntimeWidgets,
  ...contentRuntimeWidgets,
  ...formRuntimeWidgets,
  ...selectionRuntimeWidgets,
  ...desktopRuntimeWidgets,
  ...eagleRuntimeWidgets,
  ...collectionRuntimeWidgets,
  ...feedbackRuntimeWidgets,
  ...mediaRuntimeWidgets,
} };
