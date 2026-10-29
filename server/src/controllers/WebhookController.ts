import { Request, Response } from 'express';
import { EventWorkerService } from '../services/EventWorkerService';
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
   * Persists events durably into MongoDB before acknowledging with 200 OK.
   */
  public static async handleEvent(req: Request, res: Response): Promise<void> {
    const payload = req.body as InstagramWebhookPayload;

    // Validate that payload belongs to instagram object
    if (!payload || payload.object !== 'instagram' || !Array.isArray(payload.entry)) {
      res.status(200).json({ status: 'ignored', reason: 'Non-instagram webhook object' });
      return;
    }

    // Step 1: Durably persist/enqueue all valid incoming events before acknowledgment
    for (const entry of payload.entry) {
      if (!Array.isArray(entry.messaging)) continue;

      for (const event of entry.messaging) {
        // Skip echo messages sent by our own account
        if ((event.message as any)?.is_echo) {
          continue;
        }

        // Only process incoming messages (skip read receipts, delivery confirmations, reactions)
        if (!event.message || !event.message.mid) {
          continue;
        }

        try {
          const enqueueResult = await EventWorkerService.enqueueEvent(event);
          if (!enqueueResult.persisted && !enqueueResult.isDuplicate) {
            console.error(`[WebhookController] Event persistence incomplete for ${event.message.mid}`);
            res.status(500).json({ error: 'Failed to durably persist incoming event' });
            return;
          }
        } catch (err: any) {
          console.error(`[WebhookController] Failed to enqueue event ${event.message.mid}:`, err.message);
          res.status(500).json({ error: 'Database error persisting incoming webhook event' });
          return;
        }
      }
    }

    // Step 2: Acknowledge Meta with 200 OK after durable event persistence
    res.status(200).json({ status: 'ok', received: true });

    // Step 3: Trigger durable worker processing asynchronously
    EventWorkerService.processPendingQueue().catch((err) => {
      console.error('[WebhookController] Background event worker error:', err);
    });
  }
}
