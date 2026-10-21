export type DomainError = {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
};

export class DomainErrorImpl extends Error implements DomainError {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.retryable = retryable;
  }
}

export function classifyError(
  error: unknown,
  fallbackCode = 'UNKNOWN_ERROR',
): DomainError {
  if (error instanceof DomainErrorImpl) {
    return error;
  }
  if (error instanceof Error) {
    return new DomainErrorImpl(fallbackCode, error.message, false);
  }
  return new DomainErrorImpl(fallbackCode, String(error), false);
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof DomainErrorImpl) {
    return error.retryable;
  }
  return false;
}

export type ErrorHandler = (
  error: unknown,
  context?: Record<string, unknown>,
) => Error;

export function createErrorHandler(defaultCode = 'ERROR'): ErrorHandler {
  return (error: unknown) => {
    if (error instanceof Error) return error;
    return new Error(String(error));
  };
}
