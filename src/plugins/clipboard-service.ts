import type { EagleCapabilities } from '../host/eagle-capabilities';
import type { ActivationRegistration } from '../host/activation/controller';
import type { DiscoveredPackage, LoadedContribution } from '../host/install/contribution-package';
import type { PackageManifest } from '../sdui/schema/model';
import type { ServiceImplementation } from '../sdui/sdk/provider';

export const CLIPBOARD_PACKAGE_ID = 'power-eagle.clipboard';
export const CLIPBOARD_IDENTITY = `${CLIPBOARD_PACKAGE_ID}/clipboard`;
const descriptor = {
  kind: 'service' as const,
  id: 'clipboard',
  methods: {
    read: { input: { type: 'null' as const }, output: { type: 'string' as const } },
    write: { input: { type: 'string' as const }, output: { type: 'null' as const } },
  },
};

export const clipboardServiceManifest: PackageManifest = {
  format: 'power-eagle/package', formatVersion: 1, id: CLIPBOARD_PACKAGE_ID,
  name: 'Clipboard Service', version: '1.0.0',
  description: 'Typed clipboard reads and writes through the Eagle host capability boundary.', sdk: '^1.0.0',
  contributions: { services: 'services.cjs' }, exports: [descriptor], dependencies: [], assets: [],
};

export function clipboardServiceImplementation(capabilities: EagleCapabilities): ServiceImplementation {
  return {
    methods: {
      read: async (_args, context) => {
        const value = await capabilities.clipboard.readText();
        if (context.signal.aborted) throw context.signal.reason;
        return value;
      },
      write: async (args, context) => {
        await capabilities.clipboard.writeText(String(args));
        if (context.signal.aborted) throw context.signal.reason;
        return null;
      },
    },
  };
}

/** Virtual built-in package records use the same discovery/load/activation shapes as acquired packages. */
export function clipboardServicePackage(capabilities: EagleCapabilities): {
  discovered: DiscoveredPackage;
  loaded: LoadedContribution;
  registration: ActivationRegistration;
} {
  const implementation = clipboardServiceImplementation(capabilities);
  const root = `builtin:${CLIPBOARD_PACKAGE_ID}`;
  return {
    discovered: {
      root, manifestPath: `${root}/manifest.json`, manifest: clipboardServiceManifest,
      entries: { services: `${root}/services.cjs` }, assets: {},
    },
    loaded: {
      entry: `${root}/services.cjs`, contribution: 'services', kind: 'service',
      exports: [{ descriptor, implementation }],
    },
    registration: {
      identity: CLIPBOARD_IDENTITY, packageId: CLIPBOARD_PACKAGE_ID,
      group: `${CLIPBOARD_PACKAGE_ID}:services`, kind: 'service', value: implementation,
    },
  };
}
