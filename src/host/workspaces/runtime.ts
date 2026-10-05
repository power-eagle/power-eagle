import type { ActivationController } from '../activation/controller';
import type { EffectiveRegistry } from '../activation/enablement';
import type { DiscoveredPackage } from '../install/contribution-package';
import type { ActionImplementation, WidgetImplementation } from '../../sdui/sdk/provider';
import { foundationRuntimeCatalog } from '../../sdui/runtime/foundation';
import { RuntimeSession, type RuntimeCatalog } from '../../sdui/runtime/session';
import type { CallableAdapter, RuntimeAdapters } from '../../sdui/runtime/actions';
import { LanguageError, validateData } from '../../sdui/schema/validate';

export function effectiveRuntimeEnvironment(registry: EffectiveRegistry, controller: ActivationController) {
  const snapshot = controller.snapshot;
  const catalog: RuntimeCatalog = { widgets: { ...foundationRuntimeCatalog.widgets }, exports: {} };
  const widgets = { ...catalog.widgets };
  const exports: Record<string, import('../../sdui/schema/validate').AvailableExport> = {};
  const calls: Record<string, CallableAdapter> = {};
  for (const node of registry.exports) {
    const registration = snapshot.all.get(node.identity);
    if (!registration) continue;
    exports[node.identity] = { version: node.packageVersion, descriptor: node.descriptor };
    const assertOwner = () => {
      if (controller.snapshot.all.get(node.identity) !== registration) throw new Error(`Export ${node.identity} changed owner or is unavailable`);
    };
    const descriptor = node.descriptor;
    if (descriptor.kind === 'widget') widgets[node.identity] = {
      contract: descriptor.contract,
      render: props => { assertOwner(); return (registration.value as WidgetImplementation).render(props); },
    };
    if (descriptor.kind === 'action') calls[node.identity] = {
      ...descriptor.contract,
      invoke: async (args, context) => {
        assertOwner();
        const result = await (registration.value as ActionImplementation).invoke(args, context);
        assertOwner(); return result;
      },
    };
    if (descriptor.kind === 'service') {
      const handle = controller.service(node.identity);
      calls[node.identity] = {
        input: { type: 'json' }, output: { type: 'json' },
        invoke: async (args, context) => {
          const method = context.method ?? '';
          const contract = descriptor.methods[method];
          if (!contract) throw new Error(`Unknown service method ${method}`);
          const inputErrors = validateData(contract.input, args, '/action/args');
          if (inputErrors.length) throw new LanguageError(inputErrors);
          const result = await handle.invoke(method, args, context);
          assertOwner();
          const outputErrors = validateData(contract.output, result, '/action/result');
          if (outputErrors.length) throw new LanguageError(outputErrors);
          return result;
        },
      };
    }
  }
  return { catalog: { widgets, exports }, calls };
}

export function createArtifactSession(source: DiscoveredPackage, registry: EffectiveRegistry, controller: ActivationController, adapters: RuntimeAdapters = {}, asset?: (relative: string) => string): RuntimeSession {
  if (!source.runtime) throw new Error('This plugin has no runtime contribution');
  const environment = effectiveRuntimeEnvironment(registry, controller);
  return new RuntimeSession(source.runtime, environment.catalog, { ...adapters, calls: environment.calls }, asset);
}

