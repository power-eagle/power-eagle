/** Public host entry for the package-management integration. No work occurs at import. */
export { initializeSaucepan } from './saucepan-manager';
export { PowerEagleSaucepan } from './saucepan-client';
export type { PackageRequest, RetainedPackage } from './saucepan-client';
export { AcquiredPackageRepository } from './package-repository';
export { WorkbenchAcquisition, openWorkbenchAcquisition } from './workbench-acquisition';
export { EagleTransport } from './saucepan-transport';
export { Client, SaucepanError, TransportError } from 'saucepan-sdk';
