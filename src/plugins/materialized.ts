import type { CompiledContribution, ProviderSdk } from '../sdui/sdk/provider';
import { assetBrowserCalls, assetBrowserTool } from './asset-browser';
import { fileCreatorCalls, fileCreatorTool } from './file-creator';
import { recentLibraryCalls, recentLibrariesTool } from './recent-libraries';
import { eagleWidgetCalls, eagleWidgetActionManifest } from './eagle-widget-actions';
import { clipboardServiceImplementation, clipboardServiceManifest } from './clipboard-service';

/** Compiled into the artifact: no source-tree lookup occurs on the receiving host. */
export default function materializedProvider(sdk: ProviderSdk): CompiledContribution {
  const capabilities = sdk.host?.eagle;
  if (!capabilities) throw new Error('This provider requires Eagle host capabilities');
  if (sdk.packageId === clipboardServiceManifest.id) return {
    format: 'power-eagle/provider', formatVersion: 1, kind: 'service',
    exports: [{ descriptor: clipboardServiceManifest.exports[0], implementation: clipboardServiceImplementation(capabilities) }],
  };
  const definitions = [
    [assetBrowserTool.manifest, assetBrowserCalls], [fileCreatorTool.manifest, fileCreatorCalls],
    [recentLibrariesTool.manifest, recentLibraryCalls], [eagleWidgetActionManifest, eagleWidgetCalls],
  ] as const;
  const definition = definitions.find(([manifest]) => manifest.id === sdk.packageId);
  if (!definition) throw new Error(`Unknown shipped provider namespace ${sdk.packageId}`);
  const [manifest, factory] = definition;
  const calls = factory(capabilities);
  return {
    format: 'power-eagle/provider', formatVersion: 1, kind: 'action',
    exports: manifest.exports.filter(descriptor => descriptor.kind === 'action').map(descriptor => ({
      descriptor, implementation: { invoke: calls[`${manifest.id}/${descriptor.id}`].invoke },
    })),
  };
}
