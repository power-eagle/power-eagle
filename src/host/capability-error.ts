export type HostCapability =
  | 'eagle'
  | 'web-api'
  | 'filesystem'
  | 'clipboard'
  | 'file-picker'
  | 'library';

export type HostCapabilityErrorCode = 'unavailable' | 'failed' | 'invalid-result';

/** A stable error boundary for host operations exposed to documents and providers. */
export class HostCapabilityError extends Error {
  readonly capability: HostCapability;
  readonly operation: string;
  readonly code: HostCapabilityErrorCode;
  readonly cause?: unknown;

  constructor(
    capability: HostCapability,
    operation: string,
    code: HostCapabilityErrorCode,
    message: string,
    options: { cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'HostCapabilityError';
    this.capability = capability;
    this.operation = operation;
    this.code = code;
    this.cause = options.cause;
  }
}

export function unavailable(capability: HostCapability, operation: string): HostCapabilityError {
  return new HostCapabilityError(
    capability,
    operation,
    'unavailable',
    `${capability} capability is unavailable for ${operation}; run this operation inside Eagle or supply an explicit development adapter`,
  );
}

export async function hostOperation<T>(
  capability: HostCapability,
  operation: string,
  invoke: () => T | Promise<T>,
): Promise<T> {
  try {
    return await invoke();
  } catch (error) {
    if (error instanceof HostCapabilityError) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    throw new HostCapabilityError(capability, operation, 'failed', `${capability} ${operation} failed: ${detail}`, { cause: error });
  }
}
