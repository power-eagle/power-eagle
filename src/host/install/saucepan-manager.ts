import { SaucepanCli, SaucepanCommandError, type SaucepanCliOptions } from './saucepan';

export type SaucepanManagerState = {
  status: 'ready';
  binaryPath: string;
  sharedExecutable: string;
  cli: SaucepanCli;
  builtInsAvailable: true;
} | {
  status: 'unavailable';
  binaryPath: string;
  builtInsAvailable: true;
  error: {
    operation: 'initialize';
    kind: SaucepanCommandError['kind'] | 'unknown';
    message: string;
    recovery: string;
  };
};

/**
 * Probe the independently installed current executable without initializing or
 * modifying a Saucepan store. Package tooling can fail while built-ins continue.
 */
export async function initializeSaucepan(options: SaucepanCliOptions = {}): Promise<SaucepanManagerState> {
  const cli = new SaucepanCli(options);
  try {
    const sharedExecutable = await cli.execute<string>('shared executable', ['shared-executable']);
    return { status: 'ready', binaryPath: cli.binaryPath, sharedExecutable, cli, builtInsAvailable: true };
  } catch (error) {
    const known = error instanceof SaucepanCommandError ? error : undefined;
    return {
      status: 'unavailable',
      binaryPath: cli.binaryPath,
      builtInsAvailable: true,
      error: {
        operation: 'initialize',
        kind: known?.kind ?? 'unknown',
        message: error instanceof Error ? error.message : String(error),
        recovery: known?.recovery ?? 'Check the configured Saucepan executable and retry',
      },
    };
  }
}
