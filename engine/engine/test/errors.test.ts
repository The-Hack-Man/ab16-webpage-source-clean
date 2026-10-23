import { describe, it, expect } from 'vitest';
import { classifyError, DomainErrorImpl, isRetryableError } from '../src/errors.js';

describe('DomainErrorImpl', () => {
  it('creates an error with code, message, and retryable flag', () => {
    const e = new DomainErrorImpl('TEST_CODE', 'test message', true);
    expect(e.code).toBe('TEST_CODE');
    expect(e.message).toBe('test message');
    expect(e.retryable).toBe(true);
    expect(e.name).toBe('DomainError');
  });

  it('defaults retryable to false', () => {
    const e = new DomainErrorImpl('CODE', 'msg');
    expect(e.retryable).toBe(false);
  });

  it('is an instance of Error', () => {
    const e = new DomainErrorImpl('CODE', 'msg');
    expect(e).toBeInstanceOf(Error);
  });
});

describe('classifyError', () => {
  it('returns the same DomainErrorImpl if passed one', () => {
    const original = new DomainErrorImpl('X', 'msg', true);
    const classified = classifyError(original);
    expect(classified).toBe(original);
  });

  it('wraps a plain Error with fallback code', () => {
    const classified = classifyError(new Error('boom'));
    expect(classified.code).toBe('UNKNOWN_ERROR');
    expect(classified.message).toBe('boom');
    expect(classified.retryable).toBe(false);
  });

  it('wraps a plain Error with custom fallback code', () => {
    const classified = classifyError(new Error('boom'), 'CUSTOM_CODE');
    expect(classified.code).toBe('CUSTOM_CODE');
  });

  it('wraps a non-Error value', () => {
    const classified = classifyError('string error');
    expect(classified.message).toBe('string error');
    expect(classified.code).toBe('UNKNOWN_ERROR');
  });

  it('wraps an object value', () => {
    const classified = classifyError({ foo: 'bar' });
    expect(classified.message).toBe('[object Object]');
  });

  it('wraps undefined', () => {
    const classified = classifyError(undefined);
    expect(classified.message).toBe('undefined');
  });

  it('wraps null', () => {
    const classified = classifyError(null);
    expect(classified.message).toBe('null');
  });
});

describe('isRetryableError', () => {
  it('returns true for retryable DomainError', () => {
    const e = new DomainErrorImpl('X', 'msg', true);
    expect(isRetryableError(e)).toBe(true);
  });

  it('returns false for non-retryable DomainError', () => {
    const e = new DomainErrorImpl('X', 'msg', false);
    expect(isRetryableError(e)).toBe(false);
  });

  it('returns false for regular Error', () => {
    expect(isRetryableError(new Error('msg'))).toBe(false);
  });

  it('returns false for string', () => {
    expect(isRetryableError('error')).toBe(false);
  });
});
