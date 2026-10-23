export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: Error };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err(message: string | Error): Result<never> {
  return { ok: false, error: message instanceof Error ? message : new Error(message) };
}

export type AsyncResult<T> = Promise<Result<T>>;
