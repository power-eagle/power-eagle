/**
 * The host bridge contract the bundled v3 plugins call through `rt.eagle`.
 * The runtime carries `eagle` as an opaque bag; bundled plugins narrow it to
 * this typed surface. The host adapter (cycle C) provides the real
 * implementation; tests inject a fake.
 */
import type { Runtime } from '../sdui/runtime';

export interface EagleHost {
  createFile(args: { fileName: string; extension: string; content: string }): Promise<boolean> | boolean;
  getRecentLibraries(): Promise<string[]> | string[];
  switchLibrary(path: string): Promise<void> | void;
  notify(message: { title: string; body?: string }): Promise<void> | void;
}

/** Narrow a runtime's opaque eagle bag to the typed host surface. */
export function host<S extends object>(rt: Runtime<S>): EagleHost {
  return rt.eagle as unknown as EagleHost;
}
