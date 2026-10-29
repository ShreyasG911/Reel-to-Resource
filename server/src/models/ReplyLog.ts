import mongoose, { Document, Schema } from 'mongoose';

export type ReplyType =
  | 'resource_found'
  | 'resource_not_found'
  | 'unsupported_reel'
  | 'resource_unavailable'
  | 'custom';

export type ReplyDeliveryStatus =
  | 'pending'
  | 'delivered_to_api'
  | 'failed'
  | 'simulated'
  | 'uncertain_timeout';

export interface IReplyLog extends Document {
  eventId: mongoose.Types.ObjectId;
  recipientId: string;
  replyType: ReplyType;
  resourceId?: mongoose.Types.ObjectId;
  renderedMessage: string;
  deliveryStatus: ReplyDeliveryStatus;
  providerMessageId?: string;
  attemptCount: number;
  lastError?: string;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReplyLogSchema = new Schema<IReplyLog>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'AutomationEvent',
      required: true,
      unique: true,
      index: true,
    },
    recipientId: {
      type: String,
      required: true,
      index: true,
    },
    replyType: {
      type: String,
      enum: [
        'resource_found',
        'resource_not_found',
        'unsupported_reel',
        'resource_unavailable',
        'custom',
      ],
      required: true,
      index: true,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      ref: 'Resource',
      index: true,
    },
    renderedMessage: {
      type: String,
      required: true,
    },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'delivered_to_api', 'failed', 'simulated', 'uncertain_timeout'],
      default: 'pending',
      index: true,
    },
    providerMessageId: {
      type: String,
    },
    attemptCount: {
      type: Number,
      default: 1,
    },
    lastError: {
      type: String,
    },
    sentAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

ReplyLogSchema.index({ createdAt: -1 });
ReplyLogSchema.index({ recipientId: 1, createdAt: -1 });

export const ReplyLog = mongoose.model<IReplyLog>('ReplyLog', ReplyLogSchema);

