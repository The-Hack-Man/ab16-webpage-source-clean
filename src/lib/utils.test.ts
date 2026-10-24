import { describe, expect, it } from 'vitest';
import { cn, formatBytes, formatDuration, formatLUFS, formatDb } from './utils';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('filters out falsy values', () => {
    expect(cn('a', undefined, false, null, '', 'b')).toBe('a b');
  });

  it('returns empty string for no classes', () => {
    expect(cn()).toBe('');
  });
});

describe('formatBytes', () => {
  it('returns 0 B for zero', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1 GB');
  });
});

describe('formatDuration', () => {
  it('formats seconds as mm:ss', () => {
    expect(formatDuration(95)).toBe('1:35');
  });

  it('pads seconds with leading zero', () => {
    expect(formatDuration(5)).toBe('0:05');
  });

  it('returns --:-- for null', () => {
    expect(formatDuration(null)).toBe('--:--');
  });

  it('returns --:-- for undefined', () => {
    expect(formatDuration(undefined)).toBe('--:--');
  });
});

describe('formatLUFS', () => {
  it('formats a LUFS value', () => {
    expect(formatLUFS(-14.5)).toBe('-14.5 LUFS');
  });

  it('returns -- for null', () => {
    expect(formatLUFS(null)).toBe('--');
  });

  it('returns -- for undefined', () => {
    expect(formatLUFS(undefined)).toBe('--');
  });

  it('returns -- for non-finite values', () => {
    expect(formatLUFS(Infinity)).toBe('--');
    expect(formatLUFS(NaN)).toBe('--');
  });
});

describe('formatDb', () => {
  it('formats a dB value', () => {
    expect(formatDb(-6.3)).toBe('-6.3 dB');
  });

  it('returns -- for null', () => {
    expect(formatDb(null)).toBe('--');
  });

  it('returns -- for undefined', () => {
    expect(formatDb(undefined)).toBe('--');
  });
});
