import { describe, it, expect } from 'vitest';
import { ReelIdentifierAdapter } from '../src/adapters/ReelIdentifierAdapter';
import { InstagramMessagingEvent } from '../src/types/instagram';

describe('ReelIdentifierAdapter', () => {
  it('identifies native ig_reel attachment with URL and strips tracking parameters', () => {
    const event: InstagramMessagingEvent = {
      sender: { id: 'user_12345' },
      recipient: { id: 'page_67890' },
      timestamp: 1736259748810,
      message: {
        mid: 'mid_sample_001',
        attachments: [
          {
            type: 'ig_reel',
            payload: {
              url: 'https://www.instagram.com/reel/DC5aXYZ89ab/?igsh=MWx1YnpqamVvMWQx&utm_source=ig_web_copy_link',
              title: 'Top 10 Design Resources',
              video_id: '18109567273171822',
            },
          },
        ],
      },
    };

    const result = ReelIdentifierAdapter.identify(event);

    expect(result.status).toBe('identified');
    expect(result.reelId).toBe('DC5aXYZ89ab');
    expect(result.canonicalReelUrl).toBe('https://www.instagram.com/reel/DC5aXYZ89ab/');
    expect(result.source).toBe('shortcode_attachment');
    expect(result.rawUrl).not.toContain('igsh');
    expect(result.rawUrl).not.toContain('utm_source');
    expect(result.metadata?.title).toBe('Top 10 Design Resources');
  });

  it('identifies native reel attachment with explicit reel_id in payload', () => {
    const event: InstagramMessagingEvent = {
      sender: { id: 'user_12345' },
      recipient: { id: 'page_67890' },
      timestamp: 1736259748810,
      message: {
        mid: 'mid_sample_002',
        attachments: [
          {
            type: 'reel',
            payload: {
              reel_id: 'C890_testReel',
              title: 'Cool Preset Tutorial',
            },
          },
        ],
      },
    };

    const result = ReelIdentifierAdapter.identify(event);

    expect(result.status).toBe('identified');
    expect(result.reelId).toBe('C890_testReel');
    expect(result.canonicalReelUrl).toBe('https://www.instagram.com/reel/C890_testReel/');
    expect(result.source).toBe('shortcode_attachment');
  });

  it('identifies CDN lookaside URL by extracting asset_id/video_id and NEVER fabricates canonical URL', () => {
    const event: InstagramMessagingEvent = {
      sender: { id: 'user_12345' },
      recipient: { id: 'page_67890' },
      timestamp: 1736259748810,
      message: {
        mid: 'mid_sample_003',
        attachments: [
          {
            type: 'ig_reel',
            payload: {
              url: 'https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=18109567273171822&signature=test_sig',
              video_id: '18109567273171822',
            },
          },
        ],
      },
    };

    const result = ReelIdentifierAdapter.identify(event);

    expect(result.status).toBe('identified');
    expect(result.numericMediaId).toBe('18109567273171822');
    expect(result.reelId).toBe('18109567273171822');
    // Critical: numeric IDs must not fabricate a 404 canonical URL
    expect(result.canonicalReelUrl).toBeUndefined();
    expect(result.source).toBe('numeric_media_id');
  });

  it('identifies a direct Reel URL pasted in text', () => {
    const event: InstagramMessagingEvent = {
      sender: { id: 'user_12345' },
      recipient: { id: 'page_67890' },
      timestamp: 1736259748810,
      message: {
        mid: 'mid_sample_004',
        text: 'Hey check this reel out: https://instagram.com/reel/C-xyz789_AB/?utm_source=copy',
      },
    };

    const result = ReelIdentifierAdapter.identify(event);

    expect(result.status).toBe('identified');
    expect(result.reelId).toBe('C-xyz789_AB');
    expect(result.canonicalReelUrl).toBe('https://www.instagram.com/reel/C-xyz789_AB/');
    expect(result.source).toBe('shortcode_text');
  });

  it('identifies instagr.am short links in text', () => {
    const event: InstagramMessagingEvent = {
      sender: { id: 'user_12345' },
      recipient: { id: 'page_67890' },
      timestamp: 1736259748810,
      message: {
        mid: 'mid_sample_005',
        text: 'https://instagr.am/reel/DA123_abc/',
      },
    };

    const result = ReelIdentifierAdapter.identify(event);

    expect(result.status).toBe('identified');
    expect(result.reelId).toBe('DA123_abc');
    expect(result.canonicalReelUrl).toBe('https://www.instagram.com/reel/DA123_abc/');
  });

  it('handles explicit is_unsupported flag from Meta', () => {
    const event: InstagramMessagingEvent = {
      sender: { id: 'user_12345' },
      recipient: { id: 'page_67890' },
      timestamp: 1736259748810,
      message: {
        mid: 'mid_sample_006',
        is_unsupported: true,
      },
    };

    const result = ReelIdentifierAdapter.identify(event);

    expect(result.status).toBe('unsupported_share');
    expect(result.errorReason).toContain('unsupported');
  });

  it('correctly classifies non-reel attachments as unsupported_share', () => {
    const event: InstagramMessagingEvent = {
      sender: { id: 'user_12345' },
      recipient: { id: 'page_67890' },
      timestamp: 1736259748810,
      message: {
        mid: 'mid_sample_007',
        attachments: [
          {
            type: 'image',
            payload: {
              url: 'https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=5555',
            },
          },
        ],
      },
    };

    const result = ReelIdentifierAdapter.identify(event);

    expect(result.status).toBe('unsupported_share');
    expect(result.errorReason).toContain('Unsupported attachment type "image"');
  });

  it('classifies general text inquiries as missing_identifier', () => {
    const event: InstagramMessagingEvent = {
      sender: { id: 'user_12345' },
      recipient: { id: 'page_67890' },
      timestamp: 1736259748810,
      message: {
        mid: 'mid_sample_008',
        text: 'Hi there, where can I find your prices?',
      },
    };

    const result = ReelIdentifierAdapter.identify(event);

    expect(result.status).toBe('missing_identifier');
    expect(result.reelId).toBeUndefined();
  });

  it('handles empty message payload gracefully', () => {
    const event: InstagramMessagingEvent = {
      sender: { id: 'user_12345' },
      recipient: { id: 'page_67890' },
      timestamp: 1736259748810,
    };

    const result = ReelIdentifierAdapter.identify(event);

    expect(result.status).toBe('missing_identifier');
    expect(result.errorReason).toContain('No message payload');
  });

  it('extracts shortcodes safely using extractShortcode helper', () => {
    expect(ReelIdentifierAdapter.extractShortcode('https://www.instagram.com/reel/C8_validShortcode/')).toBe('C8_validShortcode');
    expect(ReelIdentifierAdapter.extractShortcode('https://instagram.com/reels/C8_validShortcode?utm=1')).toBe('C8_validShortcode');
    expect(ReelIdentifierAdapter.extractShortcode('not a url')).toBeNull();
  });

  it('sanitizes URLs by stripping query parameters', () => {
    const dirty = 'https://www.instagram.com/reel/ABC123xyz/?igsh=12345&utm_source=share&fbclid=abc';
    const clean = ReelIdentifierAdapter.sanitizeUrl(dirty);
    expect(clean).not.toContain('igsh');
    expect(clean).not.toContain('utm_source');
    expect(clean).not.toContain('fbclid');
    expect(clean).toContain('https://www.instagram.com/reel/ABC123xyz/');
  });
});

