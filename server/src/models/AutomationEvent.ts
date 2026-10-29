import mongoose, { Document, Schema } from 'mongoose';
import { ReelIdentificationStatus } from '../types/instagram';

export type EventProcessingStatus =
  | 'received'
  | 'ignored'
  | 'processing'
  | 'identified'
  | 'matched'
  | 'not_found'
  | 'unavailable'
  | 'unsupported_share'
  | 'reply_pending'
  | 'reply_sent'
  | 'reply_failed'
  | 'duplicate';

export interface IAutomationEvent extends Document {
  providerMessageId: string;
  senderId: string;
  recipientId: string;
  eventTimestamp: number;
  messageType: string;
  extractedReelId?: string;
  extractedCanonicalUrl?: string;
  identificationStatus: ReelIdentificationStatus;
  processingStatus: EventProcessingStatus;
  matchResult?: {
    resourceId?: mongoose.Types.ObjectId;
    resourceUrl?: string;
    title?: string;
    matchedBy?: 'reelId' | 'canonicalReelUrl' | 'alias';
  };
  errorCode?: string;
  errorDetails?: string;
  rawPayloadSummary?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const AutomationEventSchema = new Schema<IAutomationEvent>(
  {
    providerMessageId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    senderId: {
      type: String,
      required: true,
      index: true,
    },
    recipientId: {
      type: String,
      required: true,
      index: true,
    },
    eventTimestamp: {
      type: Number,
      required: true,
    },
    messageType: {
      type: String,
      required: true,
      default: 'none',
    },
    extractedReelId: {
      type: String,
      index: true,
    },
    extractedCanonicalUrl: {
      type: String,
    },
    identificationStatus: {
      type: String,
      enum: ['identified', 'unsupported_share', 'missing_identifier', 'invalid_identifier'],
      required: true,
      index: true,
    },
    processingStatus: {
      type: String,
      enum: [
        'received',
        'ignored',
        'processing',
        'identified',
        'matched',
        'not_found',
        'unavailable',
        'unsupported_share',
        'reply_pending',
        'reply_sent',
        'reply_failed',
        'duplicate',
      ],
      default: 'received',
      index: true,
    },
    matchResult: {
      resourceId: {
        type: Schema.Types.ObjectId,
        ref: 'Resource',
      },
      resourceUrl: String,
      title: String,
      matchedBy: {
        type: String,
        enum: ['reelId', 'canonicalReelUrl', 'alias'],
      },
    },
    errorCode: String,
    errorDetails: String,
    rawPayloadSummary: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

AutomationEventSchema.index({ createdAt: -1 });
AutomationEventSchema.index({ senderId: 1, createdAt: -1 });

export const AutomationEvent = mongoose.model<IAutomationEvent>(
  'AutomationEvent',
  AutomationEventSchema
);

