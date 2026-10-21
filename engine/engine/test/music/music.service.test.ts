import { describe, it, expect } from 'vitest';
import { MusicService } from '../../src/music/index.js';

describe('MusicService', () => {
  const service = new MusicService({ minScheduleLeadMs: 60000 });

  describe('getConfig', () => {
    it('returns the config object', () => {
      expect(service.getConfig()).toEqual({ minScheduleLeadMs: 60000 });
    });
  });

  describe('validateReleaseStatus', () => {
  it.each([
    ['draft', 'draft'],
    ['scheduled', 'scheduled'],
    ['upcoming', 'upcoming'],
    ['published', 'published'],
    ['archived', 'archived'],
  ])('maps %s to %s', (input, expected) => {
    const result = service.validateReleaseStatus(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(expected);
  });

    it('returns error for invalid status', () => {
      const result = service.validateReleaseStatus('invalid');
      expect(result.ok).toBe(false);
    });
  });

  describe('validateReleaseType', () => {
    it.each([
      'single',
      'ep',
      'album',
      'video',
    ])('validates %s', (type) => {
      const result = service.validateReleaseType(type);
      expect(result.ok).toBe(true);
    });

    it('returns error for invalid type', () => {
      const result = service.validateReleaseType('invalid');
      expect(result.ok).toBe(false);
    });
  });

  describe('validateCampaignStatus', () => {
  it.each([
    ['draft', 'draft'],
    ['scheduled', 'scheduled'],
    ['live', 'live'],
    ['ended', 'ended'],
    ['archived', 'archived'],
  ])('maps %s to %s', (input, expected) => {
    const result = service.validateCampaignStatus(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(expected);
  });

    it('returns error for invalid status', () => {
      const result = service.validateCampaignStatus('invalid');
      expect(result.ok).toBe(false);
    });
  });

  describe('normalizeReleaseRecord', () => {
    it('maps a full release record with tracks', () => {
      const release = {
        id: 'r1',
        title: 'Test Album',
        artist: 'Test Artist',
        release_type: 'album',
        status: 'published',
        release_date: '2025-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      };
      const tracks = [
        { id: 't1', release_id: 'r1', position: 1, title: 'Track 1', duration: '3:30' },
      ];
      const result = service.normalizeReleaseRecord(release, tracks);
      expect(result.id).toBe('r1');
      expect(result.title).toBe('Test Album');
      expect(result.type).toBe('album');
      expect(result.tracks[0].durationSeconds).toBe(210);
    });

    it('maps MM:SS duration correctly', () => {
      const result = service.normalizeReleaseRecord(
        { id: '1', title: 'T', artist: 'A', release_type: 'single' },
        [{ id: 't1', release_id: '1', position: 1, title: 'Track', duration: '4:20' }],
      );
      expect(result.tracks[0].durationSeconds).toBe(260);
    });

    it('defaults status to draft when missing', () => {
      const result = service.normalizeReleaseRecord({ id: '1', title: 'T', artist: 'A' });
      expect(result.status).toBe('draft');
    });

    it('handles null duration', () => {
      const result = service.normalizeReleaseRecord(
        { id: '1', title: 'T', artist: 'A' },
        [{ id: 't1', release_id: '1', position: 1, title: 'Track', duration: null }],
      );
      expect(result.tracks[0].durationSeconds).toBe(0);
    });
  });
});

