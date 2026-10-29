import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { Resource } from '../src/models/Resource';
import { ResourceMatcherService } from '../src/services/ResourceMatcherService';

const TEST_DB_URI = 'mongodb://localhost:27017/reel_to_resource_matcher_test';

describe('ResourceMatcherService', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URI);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await Resource.deleteMany({});

    // Seed test resources
    await Resource.create([
      {
        title: 'Complete Web Design Checklist',
        description: 'Comprehensive 2026 checklist',
        reelId: 'DC5aXYZ89ab',
        canonicalReelUrl: 'https://www.instagram.com/reel/DC5aXYZ89ab/',
        resourceUrl: 'https://example.com/checklist',
        resourceType: 'guide',
        tags: ['design', 'web'],
        isAvailable: true,
        status: 'active',
        aliases: ['18109567273171822'],
      },
      {
        title: 'Dark Mode Figma Tokens',
        description: 'Figma tokens library',
        reelId: 'C-xyz789_AB',
        canonicalReelUrl: 'https://www.instagram.com/reel/C-xyz789_AB/',
        resourceUrl: 'https://example.com/figma-tokens',
        resourceType: 'template',
        tags: ['figma'],
        isAvailable: false, // Temporarily unavailable
        status: 'active',
      },
      {
        title: 'Draft Preset Pack',
        description: 'Not published yet',
        reelId: 'DRAFT_REEL_001',
        canonicalReelUrl: 'https://www.instagram.com/reel/DRAFT_REEL_001/',
        resourceUrl: 'https://example.com/draft',
        resourceType: 'preset',
        isAvailable: true,
        status: 'draft', // Draft status
      },
    ]);
  });

  it('matches Priority 1: exact normalized Reel ID', async () => {
    const result = await ResourceMatcherService.match('DC5aXYZ89ab');

    expect(result.matchFound).toBe(true);
    expect(result.status).toBe('matched');
    expect(result.matchedBy).toBe('reelId');
    expect(result.resource?.title).toBe('Complete Web Design Checklist');
    expect(result.resource?.resourceUrl).toBe('https://example.com/checklist');
  });

  it('matches Priority 2: exact normalized canonical Reel URL', async () => {
    // Calling with only canonical URL
    const result = await ResourceMatcherService.match(
      undefined,
      'https://www.instagram.com/reel/DC5aXYZ89ab/'
    );

    expect(result.matchFound).toBe(true);
    expect(result.status).toBe('matched');
    expect(result.matchedBy).toBe('canonicalReelUrl');
    expect(result.resource?.title).toBe('Complete Web Design Checklist');
  });

  it('matches Priority 3: deterministic alias (video_id)', async () => {
    // Calling with an unknown reelId, but a valid alias/videoId
    const result = await ResourceMatcherService.match(
      'UNKNOWN_ID',
      undefined,
      '18109567273171822'
    );

    expect(result.matchFound).toBe(true);
    expect(result.status).toBe('matched');
    expect(result.matchedBy).toBe('alias');
    expect(result.resource?.title).toBe('Complete Web Design Checklist');
  });

  it('returns status unavailable when resource is marked isAvailable: false', async () => {
    const result = await ResourceMatcherService.match('C-xyz789_AB');

    expect(result.matchFound).toBe(false);
    expect(result.status).toBe('unavailable');
    expect(result.resource?.title).toBe('Dark Mode Figma Tokens');
  });

  it('returns status unavailable when resource is in draft status', async () => {
    const result = await ResourceMatcherService.match('DRAFT_REEL_001');

    expect(result.matchFound).toBe(false);
    expect(result.status).toBe('unavailable');
  });

  it('returns status not_found when Reel identifier does not exist', async () => {
    const result = await ResourceMatcherService.match('NON_EXISTENT_REEL');

    expect(result.matchFound).toBe(false);
    expect(result.status).toBe('not_found');
    expect(result.resource).toBeUndefined();
  });
});

