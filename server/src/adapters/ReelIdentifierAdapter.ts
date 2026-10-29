import { 
  InstagramMessagingEvent, 
  ReelIdentificationResult, 
  InstagramAttachment 
} from '../types/instagram';

export class ReelIdentifierAdapter {
  // Regex to extract shortcode from various Instagram URL formats
  // Matches /reel/<code>, /reels/<code>, /p/<code>
  private static readonly REEL_URL_REGEX = 
    /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/(?:reel|reels|p)\/([a-zA-Z0-9_-]+)/i;

  // Regex to match asset_id or video_id in CDN lookaside URLs
  private static readonly CDN_ASSET_ID_REGEX = /[?&](?:asset_id|video_id)=([0-9]+)/i;

  /**
   * Main entry point to identify a Reel from an incoming Instagram messaging event.
   */
  public static identify(event: InstagramMessagingEvent): ReelIdentificationResult {
    const message = event.message;

    if (!message) {
      return {
        status: 'missing_identifier',
        source: 'none',
        errorReason: 'No message payload present in messaging event',
      };
    }

    // Check for explicit unsupported flag from Meta
    if (message.is_unsupported) {
      return {
        status: 'unsupported_share',
        source: 'none',
        errorReason: 'Message is marked as unsupported by Meta Graph API',
      };
    }

    // 1. Inspect message attachments (Native Reel share)
    if (message.attachments && message.attachments.length > 0) {
      const attachmentResult = this.inspectAttachments(message.attachments);
      if (attachmentResult) {
        return attachmentResult;
      }
    }

    // 2. Inspect message text for direct Reel link
    if (message.text && message.text.trim().length > 0) {
      const textResult = this.inspectText(message.text);
      if (textResult) {
        return textResult;
      }
    }

    // 3. Fallback: message received but contains no identifiable Reel
    return {
      status: 'missing_identifier',
      source: 'none',
      errorReason: 'Message contains neither a Reel attachment nor a Reel URL in text',
    };
  }

  /**
   * Inspect attachments array for supported Reel shares.
   */
  private static inspectAttachments(attachments: InstagramAttachment[]): ReelIdentificationResult | null {
    for (const attachment of attachments) {
      const type = (attachment.type || '').toLowerCase();
      const payload = attachment.payload || {};

      // Supported Reel attachment types
      const isReelType = type === 'ig_reel' || type === 'reel' || type === 'share';

      if (isReelType) {
        // Case A: Payload has explicit reel_id
        if (payload.reel_id && typeof payload.reel_id === 'string') {
          const shortcode = payload.reel_id.trim();
          if (this.isValidShortcode(shortcode)) {
            return {
              status: 'identified',
              reelId: shortcode,
              canonicalReelUrl: this.toCanonicalUrl(shortcode),
              source: 'attachment_url',
              rawUrl: payload.url,
              metadata: {
                title: payload.title,
                attachmentType: type,
                extractedAt: new Date().toISOString(),
              },
            };
          }
        }

        // Case B: Payload has a Reel URL
        if (payload.url && typeof payload.url === 'string') {
          const extractedShortcode = this.extractShortcode(payload.url);
          if (extractedShortcode) {
            return {
              status: 'identified',
              reelId: extractedShortcode,
              canonicalReelUrl: this.toCanonicalUrl(extractedShortcode),
              source: 'attachment_url',
              rawUrl: this.sanitizeUrl(payload.url),
              metadata: {
                title: payload.title,
                attachmentType: type,
                extractedAt: new Date().toISOString(),
              },
            };
          }

          // Check if it's a CDN lookaside URL with asset_id or video_id
          const assetId = this.extractCdnAssetId(payload.url) || payload.video_id;
          if (assetId) {
            return {
              status: 'identified',
              reelId: String(assetId),
              canonicalReelUrl: `https://www.instagram.com/reel/${assetId}/`,
              source: 'attachment_video_id',
              rawUrl: this.sanitizeUrl(payload.url),
              videoId: String(assetId),
              metadata: {
                title: payload.title,
                attachmentType: type,
                extractedAt: new Date().toISOString(),
              },
            };
          }
        }

        // Case C: Payload has video_id without a recognizable URL
        if (payload.video_id && typeof payload.video_id === 'string') {
          const videoId = payload.video_id.trim();
          return {
            status: 'identified',
            reelId: videoId,
            canonicalReelUrl: `https://www.instagram.com/reel/${videoId}/`,
            source: 'attachment_video_id',
            videoId,
            metadata: {
              title: payload.title,
              attachmentType: type,
              extractedAt: new Date().toISOString(),
            },
          };
        }

        // Reel type matched, but payload had no usable URL or ID
        return {
          status: 'unsupported_share',
          source: 'none',
          errorReason: `Attachment type was "${type}" but no valid URL, reel_id, or video_id was found in payload`,
          metadata: {
            attachmentType: type,
            extractedAt: new Date().toISOString(),
          },
        };
      }

      // If attachment is a known non-reel media type (e.g. image, audio, video, sticker)
      const nonReelMediaTypes = ['image', 'video', 'audio', 'file', 'story_mention', 'fallback', 'template'];
      if (nonReelMediaTypes.includes(type)) {
        return {
          status: 'unsupported_share',
          source: 'none',
          errorReason: `Unsupported attachment type "${type}". Only Reel shares are processed for resource matching.`,
          metadata: {
            attachmentType: type,
            extractedAt: new Date().toISOString(),
          },
        };
      }
    }

    return null;
  }

  /**
   * Inspect plain text for direct Instagram Reel links.
   */
  private static inspectText(text: string): ReelIdentificationResult | null {
    const match = text.match(this.REEL_URL_REGEX);

    if (match && match[1]) {
      const shortcode = match[1].trim();
      if (this.isValidShortcode(shortcode)) {
        return {
          status: 'identified',
          reelId: shortcode,
          canonicalReelUrl: this.toCanonicalUrl(shortcode),
          source: 'text_url',
          rawUrl: match[0],
          metadata: {
            extractedAt: new Date().toISOString(),
          },
        };
      } else {
        return {
          status: 'invalid_identifier',
          source: 'text_url',
          errorReason: `Extracted candidate shortcode "${shortcode}" failed validation`,
        };
      }
    }

    return null;
  }

  /**
   * Extracts the Reel shortcode from an Instagram URL string.
   */
  public static extractShortcode(url: string): string | null {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(this.REEL_URL_REGEX);
    return match && match[1] && this.isValidShortcode(match[1]) ? match[1].trim() : null;
  }

  /**
   * Extracts asset_id from Meta CDN lookaside URLs.
   */
  private static extractCdnAssetId(url: string): string | null {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(this.CDN_ASSET_ID_REGEX);
    return match && match[1] ? match[1].trim() : null;
  }

  /**
   * Validates shortcode syntax (alphanumeric, dashes, underscores, length 5-40).
   */
  public static isValidShortcode(shortcode: string): boolean {
    if (!shortcode || typeof shortcode !== 'string') return false;
    return /^[a-zA-Z0-9_-]{3,50}$/.test(shortcode);
  }

  /**
   * Normalizes a shortcode into the canonical Instagram Reel URL format.
   */
  public static toCanonicalUrl(shortcode: string): string {
    return `https://www.instagram.com/reel/${shortcode.trim()}/`;
  }

  /**
   * Removes tracking parameters (igsh, utm_*, fbclid) from a URL.
   */
  public static sanitizeUrl(rawUrl: string): string {
    try {
      const parsed = new URL(rawUrl);
      const searchParams = new URLSearchParams(parsed.search);
      
      const trackingParams = ['igsh', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
      for (const param of trackingParams) {
        searchParams.delete(param);
      }
      
      parsed.search = searchParams.toString();
      return parsed.toString();
    } catch {
      return rawUrl.split('?')[0];
    }
  }
}

