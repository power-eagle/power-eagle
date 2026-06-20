/**
 * The built-in plugin catalog: the bundled v3 plugins shipped with the host,
 * exposed as manifest summaries (for the shell list) and resolvable modules
 * (for activation). This is the interim "built-in marketplace" until installed
 * plugins are loaded from disk through the install store.
 */
import type { PluginModule } from '../sdui/activate';
import { fileCreator } from './file-creator';
import { recentLibraries } from './recent-libraries';

/** A plugin module with its concrete state type erased for dynamic activation. */
export type AnyPluginModule = PluginModule<Record<string, unknown>>;

interface BuiltinEntry {
  manifest: AnyPluginModule['manifest'];
  module: AnyPluginModule;
}

const entries: BuiltinEntry[] = [fileCreator, recentLibraries].map((module) => ({
  manifest: module.manifest,
  module: module as unknown as AnyPluginModule,
}));

/** List the bundled plugins' manifests (for the shell sidebar). */
export function listBuiltins(): AnyPluginModule['manifest'][] {
  return entries.map((entry) => entry.manifest);
}

/** Resolve a bundled plugin module by id, or undefined when unknown. */
export function getBuiltin(id: string): AnyPluginModule | undefined {
  return entries.find((entry) => entry.manifest.id === id)?.module;
}

/** All bundled plugin modules (for activating service/styling contributions). */
export function listBuiltinModules(): AnyPluginModule[] {
  return entries.map((entry) => entry.module);
}
