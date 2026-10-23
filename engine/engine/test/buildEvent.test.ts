import { describe, it, expect } from 'vitest';
import { buildEvent } from '../src/contracts/automation.js';

describe('buildEvent', () => {
  it('creates an event with id, type, payload, and timestamp', () => {
    const event = buildEvent('test.event', { foo: 'bar' });
    expect(event.type).toBe('test.event');
    expect(event.payload).toEqual({ foo: 'bar' });
    expect(event.id).toBeTruthy();
    expect(event.timestamp).toBeTruthy();
  });

  it('generates unique IDs', () => {
    const e1 = buildEvent('test', null);
    const e2 = buildEvent('test', null);
    expect(e1.id).not.toBe(e2.id);
  });

  it('includes correlationId when provided', () => {
    const event = buildEvent('test', {}, { correlationId: 'corr-123' });
    expect(event.correlationId).toBe('corr-123');
  });

  it('includes causationId when provided', () => {
    const event = buildEvent('test', {}, { causationId: 'cause-1' });
    expect(event.causationId).toBe('cause-1');
  });

  it('handles null payload', () => {
    const event = buildEvent('test', null);
    expect(event.payload).toBeNull();
  });

  it('handles primitive payload', () => {
    const event = buildEvent('test', 'string payload');
    expect(event.payload).toBe('string payload');
  });

  it('handles array payload', () => {
    const event = buildEvent('test', [1, 2, 3]);
    expect(event.payload).toEqual([1, 2, 3]);
  });

  it('has a valid timestamp', () => {
    const event = buildEvent('test', null);
    const parsed = new Date(event.timestamp);
    expect(parsed.toString()).not.toBe('Invalid Date');
  });
});
