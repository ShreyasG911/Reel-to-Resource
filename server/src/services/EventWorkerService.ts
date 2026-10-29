import { AutomationEvent, IAutomationEvent } from '../models/AutomationEvent';
import { ReplyLog, ReplyType } from '../models/ReplyLog';
import { IntegrationSetting } from '../models/IntegrationSetting';
import { ReelIdentifierAdapter } from '../adapters/ReelIdentifierAdapter';
import { ResourceMatcherService } from './ResourceMatcherService';
import { TemplateRenderer } from './TemplateRenderer';
import { MetaSendService } from './MetaSendService';
import { InstagramMessagingEvent } from '../types/instagram';

export class EventWorkerService {
  private static isRunning = false;

  /**
   * Enqueues an incoming webhook messaging event durably into MongoDB.
   * Atomic against duplicate deliveries with explicit E11000 handling.
   */
  public static async enqueueEvent(event: InstagramMessagingEvent): Promise<{
    persisted: boolean;
    isDuplicate: boolean;
    event?: IAutomationEvent;
  }> {
    const message = event.message;
    const mid = message?.mid;
    const senderId = event.sender?.id;
    const recipientId = event.recipient?.id;

    if (!mid || !senderId || !recipientId) {
      return { persisted: false, isDuplicate: false };
    }

    try {
      // Step 1: Pre-identification to categorize message type early
      const idResult = ReelIdentifierAdapter.identify(event);

      // Step 2: Atomic insert of pending event
      const newEvent = await AutomationEvent.create({
        providerMessageId: mid,
        senderId,
        recipientId,
        eventTimestamp: event.timestamp || Date.now(),
        messageType: idResult.source,
        extractedReelId: idResult.reelId,
        extractedCanonicalUrl: idResult.canonicalReelUrl,
        numericMediaId: idResult.numericMediaId,
        identificationStatus: idResult.status,
        processingStatus: 'pending',
        rawPayloadSummary: {
          rawUrl: idResult.rawUrl,
          videoId: idResult.videoId,
          errorReason: idResult.errorReason,
          metadata: idResult.metadata,
        },
        rawEventPayload: event as any,
      });

      return { persisted: true, isDuplicate: false, event: newEvent };
    } catch (err: any) {
      // Explicit handling of MongoDB duplicate-key error (code 11000)
      if (err.code === 11000 || err.name === 'MongoServerError' && err.message?.includes('E11000')) {
        const existing = await AutomationEvent.findOne({ providerMessageId: mid });
        return { persisted: false, isDuplicate: true, event: existing || undefined };
      }
      throw err;
    }
  }

  /**
   * Processes a specific event by ID with atomic locking to prevent race conditions.
   */
  public static async processEventById(eventId: string): Promise<boolean> {
    // Atomic lock acquisition: only grab if pending or recoverable
    const event = await AutomationEvent.findOneAndUpdate(
      {
        _id: eventId,
        processingStatus: { $in: ['pending', 'reply_pending'] },
      },
      {
        $set: {
          processingStatus: 'processing',
          lockedAt: new Date(),
        },
      },
      { new: true }
    );

    // If lock could not be acquired (already locked or completed by concurrent thread)
    if (!event) {
      return false;
    }

    try {
      const rawEvent = (event.rawEventPayload || {}) as unknown as InstagramMessagingEvent;
      const idResult = ReelIdentifierAdapter.identify(rawEvent);

      event.identificationStatus = idResult.status;
      event.extractedReelId = idResult.reelId;
      event.extractedCanonicalUrl = idResult.canonicalReelUrl;
      event.numericMediaId = idResult.numericMediaId;

      const settings = (await IntegrationSetting.findOne({ singletonKey: 'global_settings' })) || {
        autoReplyEnabled: true,
        simulationMode: process.env.SIMULATION_MODE === 'true',
        templates: {
          resourceFound: 'Found it! Here is the resource you requested: {{resourceUrl}}',
          resourceNotFound: "We couldn't find this Reel in our resource library yet. We'll review it and may add the resource later.",
          unsupportedReel: "We couldn't identify this Reel automatically. If possible, please send its direct Reel link.",
          resourceUnavailable: 'This resource is currently undergoing maintenance or is temporarily unavailable. Please check back later!',
        },
      };

      let replyType: ReplyType | null = null;
      let templateToUse: string | null = null;
      let resourceRef: any = undefined;

      if (idResult.status === 'identified') {
        const matchResult = await ResourceMatcherService.match(
          idResult.reelId,
          idResult.canonicalReelUrl,
          idResult.numericMediaId || idResult.videoId
        );

        if (matchResult.status === 'matched' && matchResult.resource) {
          event.processingStatus = 'matched';
          event.matchResult = {
            resourceId: matchResult.resource._id as any,
            resourceUrl: matchResult.resource.resourceUrl,
            title: matchResult.resource.title,
            matchedBy: matchResult.matchedBy,
          };
          resourceRef = matchResult.resource._id;
          replyType = 'resource_found';
          templateToUse = settings.templates.resourceFound;
        } else if (matchResult.status === 'unavailable' && matchResult.resource) {
          event.processingStatus = 'unavailable';
          event.matchResult = {
            resourceId: matchResult.resource._id as any,
            resourceUrl: matchResult.resource.resourceUrl,
            title: matchResult.resource.title,
          };
          resourceRef = matchResult.resource._id;
          replyType = 'resource_unavailable';
          templateToUse = settings.templates.resourceUnavailable;
        } else {
          event.processingStatus = 'not_found';
          replyType = 'resource_not_found';
          templateToUse = settings.templates.resourceNotFound;
        }
      } else if (idResult.status === 'unsupported_share') {
        event.processingStatus = 'unsupported_share';
        replyType = 'unsupported_reel';
        templateToUse = settings.templates.unsupportedReel;
      } else {
        // Conversational or empty query: ignore safely without sending a DM
        event.processingStatus = 'ignored';
        await event.save();
        return true;
      }

      await event.save();

      // Render the personalized direct message
      const renderedReply = TemplateRenderer.render(templateToUse, {
        resourceUrl: event.matchResult?.resourceUrl || '',
        title: event.matchResult?.title || '',
        reelId: event.extractedReelId || '',
        senderId: event.senderId,
      });

      // If automated replies are disabled
      if (!settings.autoReplyEnabled) {
        event.processingStatus = 'reply_pending';
        await event.save();
        return true;
      }

      // Check if a reply was already logged for this event (defense-in-depth)
      let replyLog = await ReplyLog.findOne({ eventId: event._id });
      if (!replyLog) {
        replyLog = await ReplyLog.create({
          eventId: event._id,
          recipientId: event.senderId,
          replyType: replyType!,
          resourceId: resourceRef,
          renderedMessage: renderedReply,
          deliveryStatus: 'pending',
          attemptCount: 1,
          sentAt: new Date(),
        });
      }

      // Dispatch reply via Meta Send API
      const sendResult = await MetaSendService.sendDirectMessage({
        replyLogId: (replyLog._id as any).toString(),
        recipientId: event.senderId,
        messageText: renderedReply,
        eventTimestamp: event.eventTimestamp,
        eventId: (event._id as any).toString(),
      });

      return sendResult.success;
    } catch (err: any) {
      console.error(`[EventWorker] Failed to process event ${eventId}:`, err.message);
      await AutomationEvent.updateOne(
        { _id: eventId },
        {
          $set: {
            processingStatus: 'reply_failed',
            errorCode: 'WORKER_PROCESSING_ERROR',
            errorDetails: err.message,
          },
          $inc: { retryCount: 1 },
        }
      );
      return false;
    }
  }

  /**
   * Sweeps pending events and crash-recovers stuck events.
   */
  public static async processPendingQueue(): Promise<number> {
    if (this.isRunning) return 0;
    this.isRunning = true;

    let processedCount = 0;
    try {
      // 1. Crash recovery: unlock events stuck in 'processing' for > 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      await AutomationEvent.updateMany(
        {
          processingStatus: 'processing',
          lockedAt: { $lt: fiveMinutesAgo },
          retryCount: { $lt: 3 },
        },
        {
          $set: { processingStatus: 'pending', lockedAt: undefined },
        }
      );

      // 2. Fetch up to 20 pending events
      const pendingEvents = await AutomationEvent.find({
        processingStatus: 'pending',
        retryCount: { $lt: 3 },
      })
        .sort({ createdAt: 1 })
        .limit(20)
        .select('_id');

      for (const item of pendingEvents) {
        const success = await this.processEventById((item._id as any).toString());
        if (success) processedCount++;
      }
    } finally {
      this.isRunning = false;
    }

    return processedCount;
  }
}
