import { createHostFilesystem } from './fs-bridge';
import { resolveHostRequire } from './runtime-modules';

export interface SharedSaucepanExecutableOptions {
  homeDirectory?: string;
  platform?: NodeJS.Platform;
  hostRequire?: NodeRequire;
}

/** Resolve Saucepan's public user-level executable location without downloading it. */
export function sharedSaucepanExecutablePath(options: SharedSaucepanExecutableOptions = {}): string {
  const filesystem = createHostFilesystem(options.hostRequire);
  const runtimeProcess = resolveHostRequire(options.hostRequire)('process') as NodeJS.Process;
  const home = options.homeDirectory ?? filesystem.home();
  const platform = options.platform ?? runtimeProcess.platform;
  return filesystem.join(home, '.saucepan', 'bin', platform === 'win32' ? 'saucepan.exe' : 'saucepan');
}
