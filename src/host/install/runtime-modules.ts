interface RuntimeModuleGlobals {
  require?: NodeRequire;
}

/** Return Eagle's CommonJS bridge when the current surface supplies one. */
export function optionalHostRequire(): NodeRequire | undefined {
  const runtimeRequire = (globalThis as unknown as RuntimeModuleGlobals).require;
  return typeof runtimeRequire === 'function' ? runtimeRequire : undefined;
}

/** Resolve Eagle's CommonJS bridge, with explicit injection for tests and tooling. */
export function resolveHostRequire(injected?: NodeRequire): NodeRequire {
  if (injected) return injected;
  const runtimeRequire = optionalHostRequire();
  if (runtimeRequire) return runtimeRequire;
  throw new Error('Eagle host modules are unavailable because global require was not provided');
}
