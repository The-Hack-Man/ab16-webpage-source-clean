import { describe, it, expect } from 'vitest';
import { MusicService } from '../../src/music/index.js';
import { ok, err } from '../../src/validation.js';
import type { ReleaseStatus, ReleaseType } from '../../src/contracts/music.js';

describe('Music service validation', () => {
  const service = new MusicService({ minScheduleLeadMs: 60000 });

  it('validates all release statuses', () => {
    const statuses: ReleaseStatus[] = ['draft', 'scheduled', 'upcoming', 'published', 'archived'];
    for (const s of statuses) {
      const result = service.validateReleaseStatus(s);
      expect(result.ok).toBe(true);
    }
  });

  it('validates all release types', () => {
    const types: ReleaseType[] = ['single', 'ep', 'album', 'video'];
    for (const t of types) {
      const result = service.validateReleaseType(t);
      expect(result.ok).toBe(true);
    }
  });

  it('rejects status with spaces', () => {
    const result = service.validateReleaseStatus('draft published');
    expect(result.ok).toBe(false);
  });

  it('rejects type with special chars', () => {
    const result = service.validateReleaseType('album!');
    expect(result.ok).toBe(false);
  });
});

