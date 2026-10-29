import mongoose, { Document, Schema } from 'mongoose';

export interface IReplyTemplates {
  resourceFound: string;
  resourceNotFound: string;
  unsupportedReel: string;
  resourceUnavailable: string;
}

export interface IIntegrationSetting extends Document {
  singletonKey: string;
  autoReplyEnabled: boolean;
  simulationMode: boolean;
  templates: IReplyTemplates;
  maxRetryAttempts: number;
  connectedAccount: {
    accountId?: string;
    username?: string;
    instagramBusinessAccountId?: string;
    connectedAt?: Date;
    status: 'configured' | 'unconfigured' | 'error' | 'partial';
    lastError?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const IntegrationSettingSchema = new Schema<IIntegrationSetting>(
  {
    singletonKey: {
      type: String,
      default: 'global_settings',
      unique: true,
      index: true,
    },
    autoReplyEnabled: {
      type: Boolean,
      default: true,
    },
    simulationMode: {
      type: Boolean,
      default: false,
    },
    templates: {
      resourceFound: {
        type: String,
        default: 'Found it! Here is the resource you requested: {{resourceUrl}}',
      },
      resourceNotFound: {
        type: String,
        default: "We couldn't find this Reel in our resource library yet. We'll review it and may add the resource later.",
      },
      unsupportedReel: {
        type: String,
        default: "We couldn't identify this Reel automatically. If possible, please send its direct Reel link.",
      },
      resourceUnavailable: {
        type: String,
        default: 'This resource is currently undergoing maintenance or is temporarily unavailable. Please check back later!',
      },
    },
    maxRetryAttempts: {
      type: Number,
      default: 3,
      min: 1,
      max: 10,
    },
    connectedAccount: {
      accountId: String,
      username: String,
      instagramBusinessAccountId: String,
      connectedAt: Date,
      status: {
        type: String,
        enum: ['configured', 'unconfigured', 'error', 'partial'],
        default: 'unconfigured',
      },
      lastError: String,
    },
  },
  {
    timestamps: true,
  }
);

export const IntegrationSetting = mongoose.model<IIntegrationSetting>(
  'IntegrationSetting',
  IntegrationSettingSchema
);

