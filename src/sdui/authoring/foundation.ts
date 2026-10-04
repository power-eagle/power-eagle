import type { ValidationCatalog } from '../schema/validate';
import { contentContracts } from './content';
import { desktopContracts } from './desktop';
import { formContracts } from './forms';
import { layoutContracts } from './layout';
import { selectionContracts } from './selection';

export * from './content';
export * from './desktop';
export * from './forms';
export * from './layout';
export * from './selection';

export const foundationCatalog: ValidationCatalog = { widgets: {
  ...layoutContracts, ...contentContracts, ...formContracts, ...selectionContracts, ...desktopContracts,
} };
