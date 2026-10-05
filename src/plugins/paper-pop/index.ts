import type { DiscoveredPackage, LoadedContribution } from '../../host/install/contribution-package';
import type { PackageManifest } from '../../sdui/schema/model';
import manifest from './manifest.json';
import { paperPopExport } from './styling';

export const paperPopManifest = manifest as PackageManifest;
export const PAPER_POP_IDENTITY = `${manifest.id}/${paperPopExport.descriptor.id}`;
const root = `builtin:${manifest.id}`;
export const paperPopPackage: { discovered: DiscoveredPackage; loaded: LoadedContribution } = {
  discovered: {
    root, manifestPath: `${root}/manifest.json`, manifest: paperPopManifest,
    entries: { styling: `${root}/styling.cjs` }, assets: {},
  },
  loaded: { entry: `${root}/styling.cjs`, contribution: 'styling', kind: 'styling', exports: [paperPopExport] },
};
