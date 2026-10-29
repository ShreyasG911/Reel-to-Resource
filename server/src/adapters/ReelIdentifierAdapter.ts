import { 
  InstagramMessagingEvent, 
  ReelIdentificationResult, 
  InstagramAttachment 
} from '../types/instagram';

export class ReelIdentifierAdapter {
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

      const isReelType = type === 'ig_reel' || type === 'reel' || type === 'share';

      if (isReelType) {
        // Extract any potential numeric media ID candidate from supported payload properties
        const numericCandidate =
          this.sanitizeNumericCandidate(payload.reel_video_id) ||
          this.sanitizeNumericCandidate(payload.video_id) ||
          this.sanitizeNumericCandidate(payload.asset_id) ||
          (payload.url ? this.extractCdnAssetId(payload.url) : null) ||
          (this.isValidNumericMediaId(String(payload.reel_id || '')) ? String(payload.reel_id).trim() : null);

        // Case A: Payload has an explicit shortcode in reel_id
        if (payload.reel_id && typeof payload.reel_id === 'string') {
          const candidate = payload.reel_id.trim();
          if (this.isValidShortcode(candidate)) {
            return {
              status: 'identified',
              reelId: candidate,
              reelShortcode: candidate,
              numericMediaId: numericCandidate || undefined,
              canonicalReelUrl: this.toCanonicalUrl(candidate),
              source: 'shortcode_attachment',
              rawUrl: payload.url,
              metadata: {
                title: payload.title,
                attachmentType: type,
                extractedAt: new Date().toISOString(),
              },
            };
          }
        }

        // Case B: Payload has a URL (either public permalink or CDN lookaside)
        if (payload.url && typeof payload.url === 'string') {
          // Check if URL is an authentic Instagram permalink containing a shortcode
          const parsedUrl = this.parseInstagramUrl(payload.url);
          if (parsedUrl.isValid && parsedUrl.shortcode) {
            return {
              status: 'identified',
              reelId: parsedUrl.shortcode,
              reelShortcode: parsedUrl.shortcode,
              numericMediaId: numericCandidate || undefined,
              canonicalReelUrl: this.toCanonicalUrl(parsedUrl.shortcode),
              source: 'shortcode_attachment',
              rawUrl: this.sanitizeUrl(payload.url),
              metadata: {
                title: payload.title,
                attachmentType: type,
                extractedAt: new Date().toISOString(),
              },
            };
          }
        }

        // Case C: Payload contains a verified numeric media ID (without shortcode)
        if (numericCandidate) {
          // CRITICAL: Numeric media IDs are NEVER converted into canonical /reel/ URLs!
          return {
            status: 'identified',
            numericMediaId: numericCandidate,
            videoId: numericCandidate,
            reelId: numericCandidate, // Normalized identifier
            canonicalReelUrl: undefined, // Explicitly undefined to prevent 404 links
            source: 'numeric_media_id',
            cdnUrl: payload.url && this.isValidCdnHost(payload.url) ? this.sanitizeUrl(payload.url) : undefined,
            rawUrl: payload.url ? this.sanitizeUrl(payload.url) : undefined,
            metadata: {
              title: payload.title,
              attachmentType: type,
              extractedAt: new Date().toISOString(),
            },
          };
        }

        // Reel type matched, but payload had no usable URL, shortcode, or numeric ID
        return {
          status: 'unsupported_share',
          source: 'none',
          errorReason: `Attachment type was "${type}" but no valid Reel shortcode, permalink, or numeric video ID was found in payload`,
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
   * Uses identical strict URL validation as attachment parsing.
   */
  private static inspectText(text: string): ReelIdentificationResult | null {
    if (!text || typeof text !== 'string') return null;

    // Split text into tokens by whitespace to inspect each candidate URL
    const tokens = text.split(/\s+/);
    for (const token of tokens) {
      const cleaned = token.replace(/^[<(«"']+/, '').replace(/[)>»"',.;!?]+$/, '');
      if (!cleaned.includes('/')) continue;

      const parsed = this.parseInstagramUrl(cleaned);
      if (parsed.isValid && parsed.shortcode) {
        return {
          status: 'identified',
          reelId: parsed.shortcode,
          reelShortcode: parsed.shortcode,
          canonicalReelUrl: this.toCanonicalUrl(parsed.shortcode),
          source: 'shortcode_text',
          rawUrl: cleaned,
          metadata: {
            extractedAt: new Date().toISOString(),
          },
        };
      }
    }

    return null;
  }

  /**
   * Validates whether a given hostname strictly belongs to official Instagram domains.
   */
  public static isValidInstagramHost(hostname?: string): boolean {
    if (!hostname) return false;
    const h = hostname.trim().toLowerCase();
    return (
      h === 'instagram.com' ||
      h === 'www.instagram.com' ||
      h === 'instagr.am' ||
      h === 'www.instagr.am'
    );
  }

  /**
   * Validates whether a hostname belongs to Meta CDN Lookaside domains.
   */
  public static isValidCdnHost(urlOrHost?: string): boolean {
    if (!urlOrHost) return false;
    let h = urlOrHost.trim().toLowerCase();
    try {
      if (h.includes('://')) {
        h = new URL(h).hostname.toLowerCase();
      }
    } catch {
      // Keep h as raw string
    }
    return h === 'lookaside.fbsbx.com' || h.endsWith('.fbsbx.com');
  }

  /**
   * Parses and validates an Instagram permalink using URL() parsing.
   * Rejects lookalike hostnames, invalid paths, and unexpected protocols.
   */
  public static parseInstagramUrl(urlStr: string): {
    isValid: boolean;
    shortcode?: string;
    pathname?: string;
    hostname?: string;
  } {
    if (!urlStr || typeof urlStr !== 'string') return { isValid: false };
    const trimmed = urlStr.trim();

    let urlObj: URL;
    try {
      const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      urlObj = new URL(withScheme);
    } catch {
      return { isValid: false };
    }

    // Only allow http and https protocols
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return { isValid: false };
    }

    // Host must strictly match allowed Instagram domains (rejects evil-instagram.com, attacker.com, etc.)
    if (!this.isValidInstagramHost(urlObj.hostname)) {
      return { isValid: false, hostname: urlObj.hostname };
    }

    // Path must follow /reel/<code>, /reels/<code>, or /p/<code> format
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) return { isValid: false };

    const [section, codeCandidate] = pathParts;
    const validSections = ['reel', 'reels', 'p'];
    if (!validSections.includes(section.toLowerCase())) {
      return { isValid: false };
    }

    if (this.isValidShortcode(codeCandidate)) {
      return {
        isValid: true,
        shortcode: codeCandidate,
        pathname: urlObj.pathname,
        hostname: urlObj.hostname,
      };
    }

    return { isValid: false };
  }

  /**
   * Extracts the Reel shortcode from an Instagram URL string with strict host validation.
   */
  public static extractShortcode(url: string): string | null {
    const parsed = this.parseInstagramUrl(url);
    return parsed.isValid && parsed.shortcode ? parsed.shortcode : null;
  }

  /**
   * Extracts asset_id, video_id, or reel_video_id from Meta CDN lookaside URLs with hostname verification.
   */
  public static extractCdnAssetId(url: string): string | null {
    if (!url || typeof url !== 'string') return null;

    try {
      const withScheme = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
      const parsed = new URL(withScheme);
      if (!this.isValidCdnHost(parsed.hostname)) {
        return null;
      }

      const candidate =
        parsed.searchParams.get('asset_id') ||
        parsed.searchParams.get('video_id') ||
        parsed.searchParams.get('reel_video_id');

      if (candidate && this.isValidNumericMediaId(candidate)) {
        return candidate.trim();
      }
    } catch {
      return null;
    }

    return null;
  }

  /**
   * Validates shortcode syntax (alphanumeric, dashes, underscores, length 3-50).
   * Rejects pure numeric strings of 10+ digits (which are media IDs, not shortcodes).
   */
  public static isValidShortcode(shortcode?: string): boolean {
    if (!shortcode || typeof shortcode !== 'string') return false;
    const trimmed = shortcode.trim();

    // Purely numeric strings of 10+ digits are numeric media IDs, not shortcodes!
    if (/^\d{10,}$/.test(trimmed)) {
      return false;
    }

    return /^[a-zA-Z0-9_-]{3,50}$/.test(trimmed);
  }

  /**
   * Validates numeric Instagram media / video / asset IDs (typically 10-25 digits).
   */
  public static isValidNumericMediaId(id?: string): boolean {
    if (!id || typeof id !== 'string') return false;
    return /^\d{10,25}$/.test(id.trim());
  }

  /**
   * Helper to sanitize and validate a potential numeric ID property.
   */
  private static sanitizeNumericCandidate(val: unknown): string | null {
    if (!val) return null;
    const s = String(val).trim();
    return this.isValidNumericMediaId(s) ? s : null;
  }

  /**
   * Normalizes a validated shortcode into the canonical Instagram Reel URL format.
   * Throws if given a numeric media ID or invalid shortcode to prevent fabricating 404 URLs.
   */
  public static toCanonicalUrl(shortcode: string): string {
    if (!this.isValidShortcode(shortcode)) {
      throw new Error(`Cannot construct canonical URL: "${shortcode}" is not a valid alphanumeric shortcode.`);
    }
    return `https://www.instagram.com/reel/${shortcode.trim()}/`;
  }

  /**
   * Removes tracking parameters (igsh, utm_*, fbclid) from a URL safely.
   */
  public static sanitizeUrl(rawUrl: string): string {
    try {
      const parsed = new URL(rawUrl);
      const searchParams = new URLSearchParams(parsed.search);
      
      const trackingParams = ['igsh', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 's_rid'];
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
