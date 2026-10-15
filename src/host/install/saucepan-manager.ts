import { Client } from 'saucepan-sdk';
import { EagleTransport } from './saucepan-transport';
import { resolveHostRequire } from './runtime-modules';
import { sharedSaucepanExecutablePath } from './saucepan-binary';

export interface ManagerOptions {
  binaryPath?: string;
  root?: string;
  hostRequire?: NodeRequire;
}
export type SaucepanManagerState =
  | {
      status: 'ready';
      binaryPath: string;
      version: string;
      client: Client;
      builtInsAvailable: true;
    }
  | {
      status: 'unavailable';
      binaryPath?: string;
      builtInsAvailable: true;
      error: { message: string; recovery: string };
    };

/** Deliberately read-only; constructing a browser preview never needs Node modules. */
export async function initializeSaucepan(
  options: ManagerOptions = {},
): Promise<SaucepanManagerState> {
  let binaryPath = options.binaryPath;
  try {
    const require = resolveHostRequire(options.hostRequire);
    binaryPath ??= sharedSaucepanExecutablePath({ hostRequire: require });
    const { execFile } =
      require('child_process') as typeof import('node:child_process');
    const probe = (args: string[]) =>
      new Promise<string>((resolve, reject) =>
        execFile(
          binaryPath!,
          args,
          {
            encoding: 'utf8',
            shell: false,
            windowsHide: true,
            timeout: 5000,
            maxBuffer: 1024 * 1024,
          },
          (error, stdout) => (error ? reject(error) : resolve(stdout)),
        ),
      );
    const version = (await probe(['--version'])).trim();
    if (!/^saucepan 0\.9\.\d+(?:[-+][\w.-]+)?$/.test(version))
      throw new Error(`Unsupported Saucepan executable: ${version}`);
    const help = await probe(['--help']);
    for (const command of [
      'register-application',
      'register-source',
      'register-group',
      'prepare-group',
      'pin',
      'unpin',
    ]) {
      if (!new RegExp(`\\b${command}\\b`).test(help))
        throw new Error(`Saucepan is missing ${command}`);
    }
    return {
      status: 'ready',
      binaryPath,
      version,
      client: new Client({
        executable: binaryPath,
        root: options.root,
        transport: new EagleTransport(require),
      }),
      builtInsAvailable: true,
    };
  } catch (error) {
    return {
      status: 'unavailable',
      binaryPath,
      builtInsAvailable: true,
      error: {
        message: error instanceof Error ? error.message : String(error),
        recovery:
          'Install Saucepan 0.9 independently, or configure its executable path. Eagle must provide its Node host bridge.',
      },
    };
  }
}
