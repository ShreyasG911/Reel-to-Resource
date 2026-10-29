import { Request, Response } from 'express';
import { EventProcessorService } from '../services/EventProcessorService';
import { InstagramWebhookPayload } from '../types/instagram';

export class WebhookController {
  /**
   * Handles Meta's webhook handshake challenge: GET /api/v1/webhooks/instagram
   */
  public static verify(req: Request, res: Response): void {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const configuredToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === configuredToken && challenge) {
      // Return raw challenge as plain text to satisfy Meta's validator
      res.status(200).send(challenge);
      return;
    }

    res.status(403).send('Webhook verification failed: Invalid verify token or subscription mode');
  }

  /**
   * Handles incoming webhook event notifications: POST /api/v1/webhooks/instagram
   */
  public static async handleEvent(req: Request, res: Response): Promise<void> {
    const payload = req.body as InstagramWebhookPayload;

    // Immediately acknowledge Meta with 200 OK to prevent delivery timeouts & retries
    res.status(200).json({ status: 'ok', received: true });

    // Validate that payload belongs to instagram object
    if (!payload || payload.object !== 'instagram' || !Array.isArray(payload.entry)) {
      return;
    }

    // Process messaging events asynchronously
    for (const entry of payload.entry) {
      if (!Array.isArray(entry.messaging)) continue;

      for (const event of entry.messaging) {
        // Skip echo events (messages dispatched by our own account)
        if ((event.message as any)?.is_echo) {
          continue;
        }

        // Only process incoming messages (skip read receipts, delivery confirmations, reactions)
        if (!event.message) {
          continue;
        }

        try {
          await EventProcessorService.processEvent(event);
        } catch (err: any) {
          console.error(`[WebhookController] Failed to process event ${event.message.mid}:`, err.message);
        }
      }
    }
  }
}

