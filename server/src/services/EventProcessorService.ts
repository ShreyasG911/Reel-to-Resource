import { InstagramMessagingEvent } from '../types/instagram';
import { ReelIdentifierAdapter } from '../adapters/ReelIdentifierAdapter';
import { ResourceMatcherService } from './ResourceMatcherService';
import { TemplateRenderer } from './TemplateRenderer';
import { AutomationEvent, IAutomationEvent } from '../models/AutomationEvent';
import { ReplyLog, IReplyLog, ReplyType } from '../models/ReplyLog';
import { IntegrationSetting, IIntegrationSetting } from '../models/IntegrationSetting';
import { MetaSendService } from './MetaSendService';

export interface ProcessEventResult {
  success: boolean;
  isDuplicate: boolean;
  event: IAutomationEvent;
  replyLog?: IReplyLog;
  renderedReply?: string;
  actionTaken: 'reply_prepared' | 'ignored' | 'duplicate_dropped' | 'reply_disabled';
}

export class EventProcessorService {
  /**
   * Retrieves active settings singleton or initializes default settings.
   */
  public static async getSettings(): Promise<IIntegrationSetting> {
    let settings = await IntegrationSetting.findOne({ singletonKey: 'global_settings' });
    if (!settings) {
      settings = await IntegrationSetting.create({
        singletonKey: 'global_settings',
        autoReplyEnabled: true,
        simulationMode: process.env.SIMULATION_MODE === 'true',
      });
    }
    return settings;
  }

  /**
   * Processes an incoming Instagram messaging webhook event end-to-end.
   */
  public static async processEvent(event: InstagramMessagingEvent): Promise<ProcessEventResult> {
    const message = event.message;
    const senderId = event.sender?.id;
    const recipientId = event.recipient?.id;
    const mid = message?.mid;

    if (!mid || !senderId || !recipientId) {
      throw new Error('Invalid Instagram messaging event: missing mid, sender.id, or recipient.id');
    }

    // Step 1: Atomic Deduplication Check via unique providerMessageId
    const existingEvent = await AutomationEvent.findOne({ providerMessageId: mid });
    if (existingEvent) {
      return {
        success: true,
        isDuplicate: true,
        event: existingEvent,
        actionTaken: 'duplicate_dropped',
      };
    }

    // Step 2: Reel Identification via Adapter
    const identificationResult = ReelIdentifierAdapter.identify(event);

    // Create the AutomationEvent record
    const eventDoc = new AutomationEvent({
      providerMessageId: mid,
      senderId,
      recipientId,
      eventTimestamp: event.timestamp || Date.now(),
      messageType: identificationResult.source,
      extractedReelId: identificationResult.reelId,
      extractedCanonicalUrl: identificationResult.canonicalReelUrl,
      identificationStatus: identificationResult.status,
      processingStatus: 'processing',
      rawPayloadSummary: {
        rawUrl: identificationResult.rawUrl,
        videoId: identificationResult.videoId,
        metadata: identificationResult.metadata,
        errorReason: identificationResult.errorReason,
      },
    });

    const settings = await this.getSettings();
    let replyType: ReplyType | null = null;
    let templateToRender: string | null = null;
    let resourceRef = undefined;

    // Step 3: Match against Resource Database based on identification
    if (identificationResult.status === 'identified') {
      const matchResult = await ResourceMatcherService.match(
        identificationResult.reelId,
        identificationResult.canonicalReelUrl,
        identificationResult.videoId
      );

      if (matchResult.status === 'matched' && matchResult.resource) {
        eventDoc.processingStatus = 'matched';
        eventDoc.matchResult = {
          resourceId: matchResult.resource._id as any,
          resourceUrl: matchResult.resource.resourceUrl,
          title: matchResult.resource.title,
          matchedBy: matchResult.matchedBy,
        };
        resourceRef = matchResult.resource._id;
        replyType = 'resource_found';
        templateToRender = settings.templates.resourceFound;
      } else if (matchResult.status === 'unavailable' && matchResult.resource) {
        eventDoc.processingStatus = 'unavailable';
        eventDoc.matchResult = {
          resourceId: matchResult.resource._id as any,
          resourceUrl: matchResult.resource.resourceUrl,
          title: matchResult.resource.title,
        };
        resourceRef = matchResult.resource._id;
        replyType = 'resource_unavailable';
        templateToRender = settings.templates.resourceUnavailable;
      } else {
        eventDoc.processingStatus = 'not_found';
        replyType = 'resource_not_found';
        templateToRender = settings.templates.resourceNotFound;
      }
    } else if (identificationResult.status === 'unsupported_share') {
      eventDoc.processingStatus = 'unsupported_share';
      replyType = 'unsupported_reel';
      templateToRender = settings.templates.unsupportedReel;
    } else {
      // missing_identifier or invalid_identifier: regular conversational message, ignore
      eventDoc.processingStatus = 'ignored';
      await eventDoc.save();
      return {
        success: true,
        isDuplicate: false,
        event: eventDoc,
        actionTaken: 'ignored',
      };
    }

    // Persist event document immediately to lock MID and save matching result
    await eventDoc.save();

    // Step 4: Construct and format the reply message
    const renderedReply = TemplateRenderer.render(templateToRender, {
      resourceUrl: eventDoc.matchResult?.resourceUrl || '',
      title: eventDoc.matchResult?.title || '',
      reelId: eventDoc.extractedReelId || '',
      senderId,
    });

    // Check if automatic replies are toggled off
    if (!settings.autoReplyEnabled) {
      eventDoc.processingStatus = 'reply_pending';
      await eventDoc.save();

      return {
        success: true,
        isDuplicate: false,
        event: eventDoc,
        renderedReply,
        actionTaken: 'reply_disabled',
      };
    }

    // Step 5: Log and dispatch the reply via MetaSendService
    const replyLog = new ReplyLog({
      eventId: eventDoc._id,
      recipientId: senderId,
      replyType: replyType!,
      resourceId: resourceRef as any,
      renderedMessage: renderedReply,
      deliveryStatus: 'pending',
      attemptCount: 1,
      sentAt: new Date(),
    });

    await replyLog.save();

    // Call Send API client (handles simulation mode, 24h window, and Meta Graph API calls)
    const sendResult = await MetaSendService.sendDirectMessage({
      replyLogId: (replyLog._id as any).toString(),
      recipientId: senderId,
      messageText: renderedReply,
      eventTimestamp: event.timestamp || Date.now(),
      eventId: (eventDoc._id as any).toString(),
    });

    // Refresh records
    const updatedEvent = (await AutomationEvent.findById(eventDoc._id)) || eventDoc;
    const updatedReplyLog = (await ReplyLog.findById(replyLog._id)) || replyLog;

    return {
      success: sendResult.success,
      isDuplicate: false,
      event: updatedEvent,
      replyLog: updatedReplyLog,
      renderedReply,
      actionTaken: 'reply_prepared',
    };
  }
}

