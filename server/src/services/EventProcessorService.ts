import { InstagramMessagingEvent } from '../types/instagram';
import { AutomationEvent, IAutomationEvent } from '../models/AutomationEvent';
import { ReplyLog, IReplyLog } from '../models/ReplyLog';
import { IntegrationSetting, IIntegrationSetting } from '../models/IntegrationSetting';
import { EventWorkerService } from './EventWorkerService';

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
   * Synchronously processes an incoming event for testing/simulation purposes
   * using the atomic queue and worker pipeline.
   */
  public static async processEvent(event: InstagramMessagingEvent): Promise<ProcessEventResult> {
    const enqueueResult = await EventWorkerService.enqueueEvent(event);

    if (enqueueResult.isDuplicate && enqueueResult.event) {
      return {
        success: true,
        isDuplicate: true,
        event: enqueueResult.event,
        actionTaken: 'duplicate_dropped',
      };
    }

    if (!enqueueResult.event) {
      throw new Error('Failed to persist messaging event to database');
    }

    const eventId = (enqueueResult.event._id as any).toString();
    const success = await EventWorkerService.processEventById(eventId);

    const updatedEvent = (await AutomationEvent.findById(eventId)) || enqueueResult.event;
    const replyLog = await ReplyLog.findOne({ eventId: updatedEvent._id }) || undefined;

    let actionTaken: 'reply_prepared' | 'ignored' | 'duplicate_dropped' | 'reply_disabled' = 'reply_prepared';
    if (updatedEvent.processingStatus === 'ignored') {
      actionTaken = 'ignored';
    } else if (updatedEvent.processingStatus === 'reply_pending') {
      actionTaken = 'reply_disabled';
    }

    return {
      success,
      isDuplicate: false,
      event: updatedEvent,
      replyLog,
      renderedReply: replyLog?.renderedMessage,
      actionTaken,
    };
  }
}
