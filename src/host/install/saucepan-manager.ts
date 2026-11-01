import { Client } from 'saucepan-sdk';
import { EagleTransport } from './saucepan-transport';
import { resolveHostRequire } from './runtime-modules';
import { sharedSaucepanExecutablePath } from './saucepan-binary';
import { checkBridgeVersion } from '../../lib/bridge-version';

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
  let recovery = 'Open Power Eagle in Eagle with its Node host bridge available.';
  try {
    const require = resolveHostRequire(options.hostRequire);
    binaryPath ??= sharedSaucepanExecutablePath({ hostRequire: require });
    const { execFile } =
      require('child_process') as typeof import('node:child_process');
    recovery = 'Install Saucepan independently (0.10.0 or later within major 0), or check the configured executable path and permissions.';
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
    const reported = /^saucepan (\S+)$/.exec(version)?.[1] ?? '';
    const issue = checkBridgeVersion(reported, { major: 0, minimum: '0.10.0' });
    if (issue) {
      recovery = issue === 'major'
        ? 'This Saucepan major version needs bridge compatibility review. Use a supported major 0 executable until the bridge is updated.'
        : issue === 'minimum'
          ? 'Update Saucepan to 0.10.0 or later within major 0; older resource protocols are unsupported.'
          : 'Check the selected Saucepan executable: --version must return saucepan followed by a semantic version.';
      throw new Error(`${issue === 'invalid' ? 'Unrecognized Saucepan version' : 'Unsupported Saucepan executable'}: ${version.slice(0, 200)}`);
    }
    recovery = 'Check the selected Saucepan executable and its required resource commands; a compatible version must also implement the bridge protocol.';
    const help = await probe(['--help']);
    for (const command of [
      'register-application',
      'register-source',
      'register-group',
      'prepare-group',
      'pin',
      'unpin',
      'profiles',
      'profile',
      'explain-policies',
    ]) {
      if (!new RegExp(`(?:^|\\s)${command}(?=\\s|$)`).test(help))
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
        recovery,
      },
    };
  }
}
