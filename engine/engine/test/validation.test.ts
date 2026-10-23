import { describe, it, expect } from 'vitest';
import { ok, err } from '../src/validation.js';
import type { Result } from '../src/validation.js';

describe('ok', () => {
  it('wraps a value in a successful Result', () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(42);
  });

  it('wraps null in a successful Result', () => {
    const result = ok(null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it('wraps undefined in a successful Result', () => {
    const result = ok(undefined);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeUndefined();
  });

  it('wraps an object in a successful Result', () => {
    const result = ok({ id: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ id: 1 });
  });

  it('wraps an array in a successful Result', () => {
    const result = ok([1, 2, 3]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([1, 2, 3]);
  });
});

describe('err', () => {
  it('wraps a string message in a failed Result', () => {
    const result = err('something went wrong');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('something went wrong');
  });

  it('wraps an Error in a failed Result', () => {
    const e = new Error('real error');
    const result = err(e);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(e);
  });

  it('wraps an Error preserves its message', () => {
    const result = err(new Error('fail'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('fail');
  });

  it('returns Result<never> type', () => {
    const result: Result<string> = ok('hello');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('hello');
  });
});
