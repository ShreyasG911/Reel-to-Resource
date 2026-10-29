import { describe, it, expect } from 'vitest';
import { ReelIdentifierAdapter } from '../src/adapters/ReelIdentifierAdapter';
import { InstagramMessagingEvent } from '../src/types/instagram';

describe('ReelIdentifierAdapter', () => {
  // =========================================================================
  // Section A: Tests with Real Sanitized Webhook Payloads
  // =========================================================================

  it('[Real Sanitized Webhook Payload] identifies native ig_reel attachment share with shortcode and tracking params', () => {
    // Sanitized payload from real Instagram DM share event
    const event: InstagramMessagingEvent = {
      sender: { id: '7281920391283' },
      recipient: { id: '17841400012345' },
      timestamp: 1736259748810,
      message: {
        mid: 'm_mid_$cAAAB82947291_real_share',
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
    expect(result.reelShortcode).toBe('DC5aXYZ89ab');
    expect(result.reelId).toBe('DC5aXYZ89ab');
    expect(result.canonicalReelUrl).toBe('https://www.instagram.com/reel/DC5aXYZ89ab/');
    expect(result.source).toBe('shortcode_attachment');
    expect(result.rawUrl).not.toContain('igsh');
    expect(result.rawUrl).not.toContain('utm_source');
    expect(result.metadata?.title).toBe('Top 10 Design Resources');
  });

  it('[Real Sanitized Webhook Payload] identifies Lookaside CDN media attachment without fabricating canonical URL', () => {
    // Sanitized payload from real Instagram DM CDN attachment delivery
    const event: InstagramMessagingEvent = {
      sender: { id: '7281920391283' },
      recipient: { id: '17841400012345' },
      timestamp: 1736259748810,
      message: {
        mid: 'm_mid_$cAAAB82947292_cdn_share',
        attachments: [
          {
            type: 'ig_reel',
            payload: {
              url: 'https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=18109567273171822&signature=sanitized_hmac',
              video_id: '18109567273171822',
              title: 'Moody Lightroom Presets',
            },
          },
        ],
      },
    };

    const result = ReelIdentifierAdapter.identify(event);

    expect(result.status).toBe('identified');
    expect(result.numericMediaId).toBe('18109567273171822');
    expect(result.reelId).toBe('18109567273171822');
    expect(result.reelShortcode).toBeUndefined();
    // Critical: numeric IDs must not fabricate a 404 canonical URL
    expect(result.canonicalReelUrl).toBeUndefined();
    expect(result.source).toBe('numeric_media_id');
  });

  it('[Real Sanitized Webhook Payload] identifies direct Reel URL pasted in text conversation', () => {
    const event: InstagramMessagingEvent = {
      sender: { id: '7281920391283' },
      recipient: { id: '17841400012345' },
      timestamp: 1736259748810,
      message: {
        mid: 'm_mid_$cAAAB82947293_text_share',
        text: 'Hey check this reel out: https://instagram.com/reel/C-xyz789_AB/?utm_source=copy',
      },
    };

    const result = ReelIdentifierAdapter.identify(event);

    expect(result.status).toBe('identified');
    expect(result.reelShortcode).toBe('C-xyz789_AB');
    expect(result.reelId).toBe('C-xyz789_AB');
    expect(result.canonicalReelUrl).toBe('https://www.instagram.com/reel/C-xyz789_AB/');
    expect(result.source).toBe('shortcode_text');
  });

  // =========================================================================
  // Section B: Host Validation & Adversarial Input Defense
  // =========================================================================

  it('rejects URLs from unverified or attacker-controlled hostnames and invalid protocols', () => {
    // Attempted SSRF, lookalike hostnames, or invalid protocols
    expect(ReelIdentifierAdapter.extractShortcode('https://evil-instagram.com/reel/DC5aXYZ89ab/')).toBeNull();
    expect(ReelIdentifierAdapter.extractShortcode('https://instagram.com.attacker.com/reel/DC5aXYZ89ab/')).toBeNull();
    expect(ReelIdentifierAdapter.extractShortcode('http://fakeig.com/reel/DC5aXYZ89ab/')).toBeNull();
    expect(ReelIdentifierAdapter.extractShortcode('javascript:alert(1)')).toBeNull();
    expect(ReelIdentifierAdapter.extractShortcode('ftp://instagram.com/reel/DC5aXYZ89ab/')).toBeNull();

    // Valid official domains
    expect(ReelIdentifierAdapter.extractShortcode('https://www.instagram.com/reel/DC5aXYZ89ab/')).toBe('DC5aXYZ89ab');
    expect(ReelIdentifierAdapter.extractShortcode('https://instagram.com/reel/DC5aXYZ89ab/')).toBe('DC5aXYZ89ab');
    expect(ReelIdentifierAdapter.extractShortcode('https://instagr.am/reel/DC5aXYZ89ab/')).toBe('DC5aXYZ89ab');
  });

  it('strictly throws error when attempting to convert numeric media ID into canonical URL', () => {
    // Numeric media IDs must NEVER fabricate a 404 /reel/{numericId}/ URL
    expect(() => ReelIdentifierAdapter.toCanonicalUrl('17922314289204730')).toThrowError(
      /not a valid alphanumeric shortcode/
    );
    expect(() => ReelIdentifierAdapter.toCanonicalUrl('18109567273171822')).toThrowError(
      /not a valid alphanumeric shortcode/
    );
    expect(ReelIdentifierAdapter.toCanonicalUrl('DC5aXYZ89ab')).toBe('https://www.instagram.com/reel/DC5aXYZ89ab/');
  });

  // =========================================================================
  // Section C: Synthetic Payload Unit Tests
  // =========================================================================

  it('[Synthetic Payload] identifies native reel attachment with explicit reel_id in payload', () => {
    const event: InstagramMessagingEvent = {
      sender: { id: 'user_12345' },
      recipient: { id: 'page_67890' },
      timestamp: 1736259748810,
      message: {
        mid: 'mid_sample_synthetic_001',
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
    expect(result.reelShortcode).toBe('C890_testReel');
    expect(result.reelId).toBe('C890_testReel');
    expect(result.canonicalReelUrl).toBe('https://www.instagram.com/reel/C890_testReel/');
    expect(result.source).toBe('shortcode_attachment');
  });

  it('[Synthetic Payload] handles explicit is_unsupported flag from Meta', () => {
    const event: InstagramMessagingEvent = {
      sender: { id: 'user_12345' },
      recipient: { id: 'page_67890' },
      timestamp: 1736259748810,
      message: {
        mid: 'mid_sample_synthetic_002',
        is_unsupported: true,
      },
    };

    const result = ReelIdentifierAdapter.identify(event);
    expect(result.status).toBe('unsupported_share');
    expect(result.errorReason).toContain('unsupported by Meta');
  });

  it('[Synthetic Payload] correctly classifies non-reel attachments as unsupported_share', () => {
    const event: InstagramMessagingEvent = {
      sender: { id: 'user_12345' },
      recipient: { id: 'page_67890' },
      timestamp: 1736259748810,
      message: {
        mid: 'mid_sample_synthetic_003',
        attachments: [
          {
            type: 'image',
            payload: { url: 'https://cdn.example.com/cat.jpg' },
          },
        ],
      },
    };

    const result = ReelIdentifierAdapter.identify(event);
    expect(result.status).toBe('unsupported_share');
    expect(result.errorReason).toContain('image');
  });

  it('[Synthetic Payload] classifies general text inquiries as missing_identifier', () => {
    const event: InstagramMessagingEvent = {
      sender: { id: 'user_12345' },
      recipient: { id: 'page_67890' },
      timestamp: 1736259748810,
      message: {
        mid: 'mid_sample_synthetic_004',
        text: 'Hello, what products do you have available?',
      },
    };

    const result = ReelIdentifierAdapter.identify(event);
    expect(result.status).toBe('missing_identifier');
  });

  it('[Synthetic Payload] handles empty message payload gracefully', () => {
    const event: InstagramMessagingEvent = {
      sender: { id: 'user_12345' },
      recipient: { id: 'page_67890' },
      timestamp: 1736259748810,
    };

    const result = ReelIdentifierAdapter.identify(event);
    expect(result.status).toBe('missing_identifier');
  });

  it('[Synthetic Payload] extracts shortcodes safely using extractShortcode helper', () => {
    expect(ReelIdentifierAdapter.extractShortcode('https://www.instagram.com/reel/DC5aXYZ89ab/?igsh=123')).toBe('DC5aXYZ89ab');
    expect(ReelIdentifierAdapter.extractShortcode('https://instagram.com/p/B890_testCode/')).toBe('B890_testCode');
    expect(ReelIdentifierAdapter.extractShortcode('https://instagr.am/reels/C12345/')).toBe('C12345');
    expect(ReelIdentifierAdapter.extractShortcode('https://example.com/random/page')).toBeNull();
  });

  it('[Synthetic Payload] sanitizes URLs by stripping query parameters', () => {
    const dirtyUrl = 'https://www.instagram.com/reel/DC5aXYZ89ab/?igsh=abc&utm_source=ig_web&fbclid=xyz';
    const cleanUrl = ReelIdentifierAdapter.sanitizeUrl(dirtyUrl);
    expect(cleanUrl).not.toContain('igsh');
    expect(cleanUrl).not.toContain('utm_source');
    expect(cleanUrl).not.toContain('fbclid');
    expect(cleanUrl).toContain('https://www.instagram.com/reel/DC5aXYZ89ab/');
  });

  it('[Synthetic Payload] extracts reel_video_id from payload property', () => {
    const event: InstagramMessagingEvent = {
      sender: { id: 'user_12345' },
      recipient: { id: 'page_67890' },
      timestamp: 1736259748810,
      message: {
        mid: 'mid_sample_reel_video_id_001',
        attachments: [
          {
            type: 'ig_reel',
            payload: {
              reel_video_id: '17922314289204730',
              title: 'Cool Reel Tutorial',
              url: 'https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=17922314289204730',
            },
          },
        ],
      },
    };

    const result = ReelIdentifierAdapter.identify(event);
    expect(result.status).toBe('identified');
    expect(result.numericMediaId).toBe('17922314289204730');
    expect(result.reelShortcode).toBeUndefined();
    expect(result.canonicalReelUrl).toBeUndefined();
    expect(result.source).toBe('numeric_media_id');
  });

  it('[Synthetic Payload] extracts reel_video_id from CDN query parameters', () => {
    const event: InstagramMessagingEvent = {
      sender: { id: 'user_12345' },
      recipient: { id: 'page_67890' },
      timestamp: 1736259748810,
      message: {
        mid: 'mid_sample_cdn_query_002',
        attachments: [
          {
            type: 'ig_reel',
            payload: {
              url: 'https://lookaside.fbsbx.com/ig_messaging_cdn/?reel_video_id=17922314289204730',
              title: 'CDN Query Reel',
            },
          },
        ],
      },
    };

    const result = ReelIdentifierAdapter.identify(event);
    expect(result.status).toBe('identified');
    expect(result.numericMediaId).toBe('17922314289204730');
    expect(result.canonicalReelUrl).toBeUndefined();
  });
});
