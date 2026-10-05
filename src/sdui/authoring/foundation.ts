import type { ValidationCatalog } from '../schema/validate';
import { collectionContracts } from './collections';
import { contentContracts } from './content';
import { desktopContracts } from './desktop';
import { eagleContracts } from './eagle';
import { formContracts } from './forms';
import { feedbackContracts } from './feedback';
import { layoutContracts } from './layout';
import { mediaContracts } from './media';
import { selectionContracts } from './selection';

export * from './content';
export * from './collections';
export * from './desktop';
export * from './eagle';
export * from './forms';
export * from './feedback';
export * from './layout';
export * from './media';
export * from './selection';

export const foundationCatalog: ValidationCatalog = { widgets: {
  ...layoutContracts, ...contentContracts, ...formContracts, ...selectionContracts, ...desktopContracts,
  ...collectionContracts, ...feedbackContracts, ...mediaContracts, ...eagleContracts,
} };
