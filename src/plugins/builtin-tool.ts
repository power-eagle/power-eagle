import type { EagleCapabilities } from '../host/eagle-capabilities';
import type { CallableAdapter } from '../sdui/runtime/actions';
import { foundationRuntimeCatalog } from '../sdui/runtime/foundation';
import { RuntimeSession, type RuntimeCatalog } from '../sdui/runtime/session';
import type { PackageManifest, RuntimeDocument } from '../sdui/schema/model';
import type { ValidationCatalog } from '../sdui/schema/validate';

export interface BuiltinTool {
  manifest: PackageManifest;
  document: RuntimeDocument;
  calls(capabilities: EagleCapabilities): Readonly<Record<string, CallableAdapter>>;
  initialize?: readonly string[];
}

export function builtinToolCatalog(tool: BuiltinTool): RuntimeCatalog {
  return {
    ...foundationRuntimeCatalog,
    exports: Object.fromEntries(tool.manifest.exports.map(descriptor => [
      `${tool.manifest.id}/${descriptor.id}`,
      { version: tool.manifest.version, descriptor },
    ])),
  };
}

export function builtinToolValidationCatalog(tool: BuiltinTool): ValidationCatalog {
  const catalog = builtinToolCatalog(tool);
  return {
    widgets: Object.fromEntries(Object.entries(catalog.widgets).map(([id, definition]) => [id, definition.contract])),
    exports: catalog.exports,
  };
}

export function createBuiltinToolSession(tool: BuiltinTool, capabilities: EagleCapabilities): RuntimeSession {
  return new RuntimeSession(tool.document, builtinToolCatalog(tool), { calls: tool.calls(capabilities) });
}

/** Create a view session and run declared startup actions before publishing it to the stage. */
export async function openBuiltinTool(tool: BuiltinTool, capabilities: EagleCapabilities): Promise<RuntimeSession> {
  const session = createBuiltinToolSession(tool, capabilities);
  try {
    for (const action of tool.initialize ?? []) await session.run(action);
    return session;
  } catch (error) {
    await session.dispose();
    throw error;
  }
}
