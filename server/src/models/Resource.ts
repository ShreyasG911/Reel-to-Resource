import mongoose, { Document, Schema } from 'mongoose';

export type ResourceType = 'template' | 'guide' | 'preset' | 'code' | 'link' | 'other';
export type ResourceLifecycleStatus = 'active' | 'draft' | 'archived';

export interface IResource extends Document {
  title: string;
  description?: string;
  reelId: string;
  canonicalReelUrl: string;
  resourceUrl: string;
  resourceType: ResourceType;
  tags: string[];
  isAvailable: boolean;
  status: ResourceLifecycleStatus;
  aliases: string[];
  matchCount: number;
  lastMatchedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ResourceSchema = new Schema<IResource>(
  {
    title: {
      type: String,
      required: [true, 'Resource title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    reelId: {
      type: String,
      required: [true, 'Reel identifier/shortcode is required'],
      trim: true,
      unique: true,
      index: true,
    },
    canonicalReelUrl: {
      type: String,
      required: [true, 'Canonical Reel URL is required'],
      trim: true,
      index: true,
    },
    resourceUrl: {
      type: String,
      required: [true, 'Destination resource URL is required'],
      trim: true,
      validate: {
        validator: function (v: string) {
          try {
            const url = new URL(v);
            return url.protocol === 'http:' || url.protocol === 'https:';
          } catch {
            return false;
          }
        },
        message: 'Resource URL must be a valid HTTP or HTTPS URL',
      },
    },
    resourceType: {
      type: String,
      enum: ['template', 'guide', 'preset', 'code', 'link', 'other'],
      default: 'link',
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'draft', 'archived'],
      default: 'active',
      index: true,
    },
    aliases: {
      type: [String],
      default: [],
      index: true,
    },
    matchCount: {
      type: Number,
      default: 0,
    },
    lastMatchedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast deterministic lookup and filtering
ResourceSchema.index({ reelId: 1, isAvailable: 1, status: 1 });
ResourceSchema.index({ canonicalReelUrl: 1, isAvailable: 1, status: 1 });
ResourceSchema.index({ aliases: 1, isAvailable: 1, status: 1 });

export const Resource = mongoose.model<IResource>('Resource', ResourceSchema);

