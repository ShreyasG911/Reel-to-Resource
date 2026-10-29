export type ResourceType = 'template' | 'guide' | 'preset' | 'code' | 'link' | 'other';
export type ResourceStatus = 'active' | 'draft' | 'archived';

export interface Resource {
  _id: string;
  title: string;
  description?: string;
  reelId: string;
  canonicalReelUrl: string;
  resourceUrl: string;
  resourceType: ResourceType;
  tags: string[];
  isAvailable: boolean;
  status: ResourceStatus;
  aliases?: string[];
  matchCount: number;
  lastMatchedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationEvent {
  _id: string;
  providerMessageId: string;
  senderId: string;
  recipientId: string;
  eventTimestamp: number;
  messageType: string;
  extractedReelId?: string;
  extractedCanonicalUrl?: string;
  identificationStatus: 'identified' | 'unsupported_share' | 'missing_identifier' | 'invalid_identifier';
  processingStatus:
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
  matchResult?: {
    resourceId?: any;
    resourceUrl?: string;
    title?: string;
    matchedBy?: string;
  };
  errorCode?: string;
  errorDetails?: string;
  rawPayloadSummary?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  replies?: ReplyLog[];
}

export interface ReplyLog {
  _id: string;
  eventId: any;
  recipientId: string;
  replyType: 'resource_found' | 'resource_not_found' | 'unsupported_reel' | 'resource_unavailable' | 'custom';
  resourceId?: any;
  renderedMessage: string;
  deliveryStatus: 'pending' | 'delivered_to_api' | 'failed' | 'simulated';
  providerMessageId?: string;
  attemptCount: number;
  lastError?: string;
  sentAt?: string;
  createdAt: string;
}

export interface IntegrationStatus {
  readinessStatus: 'ready' | 'partial' | 'unconfigured';
  simulationMode: boolean;
  autoReplyEnabled: boolean;
  graphApiVersion: string;
  instagramAccountId: string | null;
  environmentChecklist: Record<string, boolean>;
  webhookEndpoint: string;
}

export interface OverviewMetrics {
  metrics: {
    totalResources: number;
    availableResources: number;
    totalEvents: number;
    matchedEvents: number;
    notFoundEvents: number;
    unsupportedEvents: number;
    ignoredEvents: number;
    successfulReplies: number;
    failedReplies: number;
  };
  recentActivity: AutomationEvent[];
}

export interface AutomationSettings {
  autoReplyEnabled: boolean;
  simulationMode: boolean;
  templates: {
    resourceFound: string;
    resourceNotFound: string;
    unsupportedReel: string;
    resourceUnavailable: string;
  };
  maxRetryAttempts: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

