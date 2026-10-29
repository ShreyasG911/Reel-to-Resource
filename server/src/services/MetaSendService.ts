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
  deliveryStatus: 'delivered_to_api' | 'simulated' | 'failed' | 'uncertain_timeout';
  providerMessageId?: string;
  error?: string;
  errorCode?: string;
  isTransient?: boolean;
  isAmbiguous?: boolean;
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
    const isSimulation = settings?.simulationMode === true || process.env.SIMULATION_MODE === 'true';

    // 1. Messaging Window Guard (enforced across both live and simulated modes)
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

    // 2. Simulation Mode Guard (explicitly enabled only)
    if (isSimulation) {
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

    // 3. Credential Verification Guard (Live mode requires valid token; never silently simulates)
    const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
    if (!accessToken) {
      const errorMsg = 'Configuration Error: META_PAGE_ACCESS_TOKEN is missing. Set META_PAGE_ACCESS_TOKEN in .env or enable Simulation Mode in settings.';
      await this.updateFailureRecords(replyLogId, eventId, errorMsg, 1);
      return {
        success: false,
        deliveryStatus: 'failed',
        error: errorMsg,
        errorCode: 'MISSING_PAGE_ACCESS_TOKEN',
        isTransient: false,
        attemptsMade: 1,
      };
    }

    // 4. Live Meta Send API Call with Bounded Retries
    const apiVersion = process.env.META_GRAPH_API_VERSION || 'v21.0';
    const endpoint = `https://graph.facebook.com/${apiVersion}/me/messages`;
    const timeoutMs = Number(process.env.META_API_TIMEOUT_MS) || 10000;

    let attempt = 0;
    let lastError = '';
    let isTransientError = false;
    let isAmbiguousError = false;
    let finalDeliveryStatus: 'delivered_to_api' | 'simulated' | 'failed' | 'uncertain_timeout' = 'failed';
    let finalErrorCode = 'SEND_FAILED';

    while (attempt < maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

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
          signal: controller.signal,
        });

        clearTimeout(timer);

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
          finalErrorCode = metaError.code ? `META_ERROR_${metaError.code}` : 'META_API_ERROR';
          break;
        }

        // Exponential backoff with jitter before retry
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } catch (err: any) {
        clearTimeout(timer);

        if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('timeout')) {
          // Network timeout after dispatch: delivery status is ambiguous.
          // Because Meta Send API does not support client idempotency tokens, blind retry could duplicate DMs.
          lastError = `Meta Send API request timed out after ${timeoutMs}ms. Ambiguous delivery state; aborting automatic retry to prevent duplicate messages.`;
          isTransientError = false;
          isAmbiguousError = true;
          finalDeliveryStatus = 'uncertain_timeout';
          finalErrorCode = 'AMBIGUOUS_SEND_TIMEOUT';
          break;
        }

        lastError = `Network / Transport Error: ${err.message}`;
        isTransientError = true;
        finalErrorCode = 'TRANSPORT_ERROR';

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // If retries exhausted or permanent failure
    await this.updateFailureRecords(replyLogId, eventId, lastError, attempt, finalDeliveryStatus, finalErrorCode);

    return {
      success: false,
      deliveryStatus: finalDeliveryStatus,
      error: lastError,
      errorCode: finalErrorCode,
      isTransient: isTransientError,
      isAmbiguous: isAmbiguousError,
      attemptsMade: attempt,
    };
  }

  /**
   * Validates configured Meta credentials against the Graph API /me endpoint.
   * Sends token via Authorization header to prevent query parameter exposure in URLs and logs.
   * Inspects linked Instagram Professional Account to confirm messaging capability.
   */
  public static async verifyCredentials(): Promise<{
    valid: boolean;
    accountId?: string;
    accountName?: string;
    pageId?: string;
    pageName?: string;
    instagramBusinessAccountId?: string;
    hasInstagramAccount: boolean;
    messagingReady: boolean;
    warnings: string[];
    error?: string;
  }> {
    const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
    if (!accessToken) {
      return {
        valid: false,
        hasInstagramAccount: false,
        messagingReady: false,
        warnings: [],
        error: 'META_PAGE_ACCESS_TOKEN is not configured in environment',
      };
    }

    const apiVersion = process.env.META_GRAPH_API_VERSION || 'v21.0';
    // Access token passed securely via Authorization header, NOT in URL query string
    const endpoint = `https://graph.facebook.com/${apiVersion}/me?fields=id,name,instagram_business_account`;

    try {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data: any = await response.json();

      if (response.ok && data?.id) {
        const warnings: string[] = [];
        const igBusinessId = data.instagram_business_account?.id;
        const hasInstagramAccount = Boolean(igBusinessId);

        if (!hasInstagramAccount) {
          warnings.push(
            'The authenticated Facebook Page is not linked to an Instagram Professional/Business account. Link an Instagram Professional account in Facebook Page Settings > Linked Accounts.'
          );
        }

        return {
          valid: true,
          accountId: data.id,
          accountName: data.name,
          pageId: data.id,
          pageName: data.name,
          instagramBusinessAccountId: igBusinessId,
          hasInstagramAccount,
          messagingReady: hasInstagramAccount,
          warnings,
        };
      }

      return {
        valid: false,
        hasInstagramAccount: false,
        messagingReady: false,
        warnings: [],
        error: data?.error?.message || `HTTP ${response.status} verification failure`,
      };
    } catch (err: any) {
      return {
        valid: false,
        hasInstagramAccount: false,
        messagingReady: false,
        warnings: [],
        error: `Network error verifying credentials: ${err.message}`,
      };
    }
  }

  /**
   * Resolves an authoritative numeric media ID from a Reel shortcode via Meta Graph API.
   * Uses GET https://graph.facebook.com/${apiVersion}/${igUserId}/media?fields=id,shortcode,permalink
   * Returns null if credentials are not configured or no match is found.
   */
  public static async resolveAuthoritativeNumericId(
    shortcode: string
  ): Promise<{ numericMediaId?: string; permalink?: string } | null> {
    const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
    const igUserId = process.env.META_INSTAGRAM_ACCOUNT_ID;
    if (!accessToken || !igUserId || !shortcode) {
      return null;
    }

    const apiVersion = process.env.META_GRAPH_API_VERSION || 'v21.0';
    const endpoint = `https://graph.facebook.com/${apiVersion}/${igUserId}/media?fields=id,shortcode,permalink&limit=50`;

    try {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) return null;
      const data: any = await response.json();
      if (!data?.data || !Array.isArray(data.data)) return null;

      const found = data.data.find(
        (m: any) =>
          m.shortcode === shortcode ||
          m.permalink?.includes(`/reel/${shortcode}/`) ||
          m.permalink?.includes(`/p/${shortcode}/`)
      );

      if (found?.id) {
        return {
          numericMediaId: String(found.id),
          permalink: found.permalink,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private static async updateFailureRecords(
    replyLogId: string,
    eventId: string,
    error: string,
    attempts: number,
    deliveryStatus: 'failed' | 'uncertain_timeout' = 'failed',
    errorCode: string = 'SEND_FAILED'
  ): Promise<void> {
    await ReplyLog.updateOne(
      { _id: replyLogId },
      {
        $set: {
          deliveryStatus,
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
          errorCode,
          errorDetails: error,
        },
      }
    );
  }
}
