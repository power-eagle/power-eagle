import type { ValidationCatalog } from '../schema/validate';
import { collectionContracts } from './collections';
import { contentContracts } from './content';
import { desktopContracts } from './desktop';
import { formContracts } from './forms';
import { feedbackContracts } from './feedback';
import { layoutContracts } from './layout';
import { selectionContracts } from './selection';

export * from './content';
export * from './collections';
export * from './desktop';
export * from './forms';
export * from './feedback';
export * from './layout';
export * from './selection';

export const foundationCatalog: ValidationCatalog = { widgets: {
  ...layoutContracts, ...contentContracts, ...formContracts, ...selectionContracts, ...desktopContracts, ...collectionContracts, ...feedbackContracts,
} };
