import { ReplyLog, IReplyLog } from '../models/ReplyLog';
import { AutomationEvent } from '../models/AutomationEvent';
import { IntegrationSetting } from '../models/IntegrationSetting';

export interface SendMessageOptions {
  replyLogId: string;
  recipientId: string;
  messageText: string;
  eventTimestamp: number;
  eventId: string;
}

export interface SendMessageResult {
  success: boolean;
  deliveryStatus: 'delivered_to_api' | 'simulated' | 'failed';
  providerMessageId?: string;
  error?: string;
  isTransient?: boolean;
  attemptsMade: number;
}

export class MetaSendService {
  private static readonly TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  /**
   * Validates if the message is within Meta's 24-hour messaging window rule.
   */
  public static isWithinMessagingWindow(eventTimestamp: number): boolean {
    if (!eventTimestamp) return false;
    const elapsed = Date.now() - eventTimestamp;
    return elapsed >= 0 && elapsed <= this.TWENTY_FOUR_HOURS_MS;
  }

  /**
   * Dispatches an outbound direct message via Meta's Instagram Send API with bounded retry logic.
   */
  public static async sendDirectMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    const { replyLogId, recipientId, messageText, eventTimestamp, eventId } = options;

    const settings = await IntegrationSetting.findOne({ singletonKey: 'global_settings' });
    const maxRetries = settings?.maxRetryAttempts || 3;
    const isSimulation = settings?.simulationMode || process.env.SIMULATION_MODE === 'true';

    // 1. Messaging Window Guard
    if (!this.isWithinMessagingWindow(eventTimestamp)) {
      const errorMsg = 'Messaging window expired: Instagram Send API only permits replies within 24 hours of incoming message.';
      await this.updateFailureRecords(replyLogId, eventId, errorMsg, 1);
      return {
        success: false,
        deliveryStatus: 'failed',
        error: errorMsg,
        isTransient: false,
        attemptsMade: 1,
      };
    }

    // 2. Simulation Mode Guard
    const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
    if (isSimulation || !accessToken) {
      const simulatedMid = `sim_mid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await ReplyLog.updateOne(
        { _id: replyLogId },
        {
          $set: {
            deliveryStatus: 'simulated',
            providerMessageId: simulatedMid,
            sentAt: new Date(),
          },
        }
      );
      await AutomationEvent.updateOne(
        { _id: eventId },
        { $set: { processingStatus: 'reply_sent' } }
      );

      return {
        success: true,
        deliveryStatus: 'simulated',
        providerMessageId: simulatedMid,
        attemptsMade: 1,
      };
    }

    // 3. Live Meta Send API Call with Bounded Retries
    const apiVersion = process.env.META_GRAPH_API_VERSION || 'v21.0';
    const endpoint = `https://graph.facebook.com/${apiVersion}/me/messages`;

    let attempt = 0;
    let lastError = '';
    let isTransientError = false;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text: messageText },
          }),
        });

        const data: any = await response.json();

        if (response.ok && data?.message_id) {
          // Success: API accepted the message
          await ReplyLog.updateOne(
            { _id: replyLogId },
            {
              $set: {
                deliveryStatus: 'delivered_to_api',
                providerMessageId: data.message_id,
                attemptCount: attempt,
                sentAt: new Date(),
              },
            }
          );
          await AutomationEvent.updateOne(
            { _id: eventId },
            { $set: { processingStatus: 'reply_sent' } }
          );

          return {
            success: true,
            deliveryStatus: 'delivered_to_api',
            providerMessageId: data.message_id,
            attemptsMade: attempt,
          };
        }

        // Categorize error from Meta Graph API
        const metaError = data?.error || {};
        const statusCode = response.status;
        lastError = `Meta API Error (${statusCode}): ${metaError.message || 'Unknown error'} (Code: ${metaError.code || 'N/A'}, Subcode: ${metaError.error_subcode || 'N/A'})`;

        // HTTP 429 (rate limit) or 5xx are transient; 4xx are permanent permissions/bad request errors
        isTransientError = statusCode === 429 || (statusCode >= 500 && statusCode < 600);

        if (!isTransientError) {
          // Fail fast on permanent error (e.g. invalid recipient, permissions missing)
          break;
        }

        // Exponential backoff with jitter before retry
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } catch (err: any) {
        lastError = `Network / Transport Error: ${err.message}`;
        isTransientError = true;

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // If retries exhausted or permanent failure
    await this.updateFailureRecords(replyLogId, eventId, lastError, attempt);

    return {
      success: false,
      deliveryStatus: 'failed',
      error: lastError,
      isTransient: isTransientError,
      attemptsMade: attempt,
    };
  }

  private static async updateFailureRecords(
    replyLogId: string,
    eventId: string,
    error: string,
    attempts: number
  ): Promise<void> {
    await ReplyLog.updateOne(
      { _id: replyLogId },
      {
        $set: {
          deliveryStatus: 'failed',
          lastError: error,
          attemptCount: attempts,
        },
      }
    );
    await AutomationEvent.updateOne(
      { _id: eventId },
      {
        $set: {
          processingStatus: 'reply_failed',
          errorCode: 'SEND_FAILED',
          errorDetails: error,
        },
      }
    );
  }
}

