/**
 * TypeScript definitions for Meta Instagram Messaging Webhooks and Reel Identification
 */

export type ReelIdentificationStatus = 
  | 'identified'
  | 'unsupported_share'
  | 'missing_identifier'
  | 'invalid_identifier';

export type IdentificationSource = 
  | 'shortcode_attachment'
  | 'shortcode_text'
  | 'numeric_media_id'
  | 'attachment_url'
  | 'attachment_video_id'
  | 'text_url'
  | 'none';

export interface ReelIdentificationResult {
  status: ReelIdentificationStatus;
  reelId?: string;               // Alphanumeric shortcode (e.g. "DC5aXYZ89ab")
  canonicalReelUrl?: string;     // Canonical URL built ONLY from verified shortcode: https://www.instagram.com/reel/{shortcode}/
  numericMediaId?: string;       // Numeric Meta video/media identifier (e.g. "18109567273171822") - NEVER fabricated into a canonical URL
  source: IdentificationSource;
  rawUrl?: string;               // Sanitized incoming URL if provided
  cdnUrl?: string;               // Lookaside CDN wrapper URL if provided
  videoId?: string;              // Alias for numericMediaId
  errorReason?: string;
  metadata?: {
    title?: string;
    attachmentType?: string;
    extractedAt: string;
  };
}

export interface InstagramAttachmentPayload {
  url?: string;
  title?: string;
  video_id?: string;
  asset_id?: string;
  reel_id?: string;
  [key: string]: unknown;
}

export interface InstagramAttachment {
  type: string;
  payload?: InstagramAttachmentPayload;
}

export interface InstagramMessagePayload {
  mid: string;
  text?: string;
  attachments?: InstagramAttachment[];
  is_unsupported?: boolean;
  is_deleted?: boolean;
  reply_to?: {
    mid: string;
  };
}

export interface InstagramMessagingEvent {
  sender: {
    id: string;
  };
  recipient: {
    id: string;
  };
  timestamp: number;
  message?: InstagramMessagePayload;
  read?: {
    watermark: number;
  };
  delivery?: {
    mids: string[];
    watermark: number;
  };
  reaction?: {
    mid: string;
    action: string;
    reaction: string;
  };
}

export interface InstagramWebhookEntry {
  id: string;
  time: number;
  messaging?: InstagramMessagingEvent[];
}

export interface InstagramWebhookPayload {
  object: 'instagram' | string;
  entry?: InstagramWebhookEntry[];
}
