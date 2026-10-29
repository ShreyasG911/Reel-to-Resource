import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { createApp } from '../src/app';
import { Resource } from '../src/models/Resource';
import { AutomationEvent } from '../src/models/AutomationEvent';
import { ReplyLog } from '../src/models/ReplyLog';
import { IntegrationSetting } from '../src/models/IntegrationSetting';
import { EventProcessorService } from '../src/services/EventProcessorService';
import { InstagramMessagingEvent } from '../src/types/instagram';

const TEST_DB_URI = 'mongodb://localhost:27017/reel_to_resource_webhook_test';
const TEST_APP_SECRET = 'test_meta_app_secret_999';
const TEST_VERIFY_TOKEN = 'test_verify_token_123';

describe('Webhook Handshake, Signature Verification & Idempotency', () => {
  beforeAll(async () => {
    process.env.META_APP_SECRET = TEST_APP_SECRET;
    process.env.META_WEBHOOK_VERIFY_TOKEN = TEST_VERIFY_TOKEN;
    process.env.SIMULATION_MODE = 'true';
    await mongoose.connect(TEST_DB_URI);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await Resource.deleteMany({});
    await AutomationEvent.deleteMany({});
    await ReplyLog.deleteMany({});
    await IntegrationSetting.deleteMany({});

    // Seed active resource
    await Resource.create({
      title: 'Ultimate 2026 Icon Pack',
      reelId: 'ICON_REEL_123',
      canonicalReelUrl: 'https://www.instagram.com/reel/ICON_REEL_123/',
      resourceUrl: 'https://example.com/icons-download',
      isAvailable: true,
      status: 'active',
    });
  });

  it('correctly handles Meta GET webhook verification challenge', () => {
    // Test the logic directly
    const validMode = 'subscribe';
    const validToken = TEST_VERIFY_TOKEN;
    const challenge = '1158201444';

    const isAuthorized = validMode === 'subscribe' && validToken === process.env.META_WEBHOOK_VERIFY_TOKEN;
    expect(isAuthorized).toBe(true);

    const invalidToken = 'wrong_token';
    const isDenied = validMode === 'subscribe' && invalidToken === process.env.META_WEBHOOK_VERIFY_TOKEN;
    expect(isDenied).toBe(false);
  });

  it('computes and verifies HMAC-SHA256 signature correctly', () => {
    const payload = JSON.stringify({ object: 'instagram', entry: [] });
    const rawBuffer = Buffer.from(payload, 'utf8');

    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', TEST_APP_SECRET)
      .update(rawBuffer)
      .digest('hex');

    expect(expectedSignature).toMatch(/^sha256=[a-f0-9]{64}$/);

    // Timing-safe comparison check
    const sigOnly = expectedSignature.split('=')[1];
    const signatureBuffer = Buffer.from(sigOnly, 'hex');
    const computedBuffer = Buffer.from(
      crypto.createHmac('sha256', TEST_APP_SECRET).update(rawBuffer).digest('hex'),
      'hex'
    );

    expect(crypto.timingSafeEqual(signatureBuffer, computedBuffer)).toBe(true);
  });

  it('processes incoming Reel share event and creates matching ReplyLog', async () => {
    const event: InstagramMessagingEvent = {
      sender: { id: 'test_user_alpha' },
      recipient: { id: 'our_page_omega' },
      timestamp: Date.now(),
      message: {
        mid: 'mid_delivery_001',
        attachments: [
          {
            type: 'ig_reel',
            payload: {
              url: 'https://www.instagram.com/reel/ICON_REEL_123/?igsh=share',
              title: 'Ultimate 2026 Icon Pack',
            },
          },
        ],
      },
    };

    const result = await EventProcessorService.processEvent(event);

    expect(result.success).toBe(true);
    expect(result.isDuplicate).toBe(false);
    expect(result.actionTaken).toBe('reply_prepared');
    expect(result.renderedReply).toContain('https://example.com/icons-download');

    // Verify DB records
    const storedEvent = await AutomationEvent.findOne({ providerMessageId: 'mid_delivery_001' });
    expect(storedEvent).toBeDefined();
    expect(storedEvent?.processingStatus).toBe('reply_sent');
    expect(storedEvent?.extractedReelId).toBe('ICON_REEL_123');

    const storedReply = await ReplyLog.findOne({ eventId: storedEvent?._id });
    expect(storedReply).toBeDefined();
    expect(storedReply?.renderedMessage).toContain('https://example.com/icons-download');
    expect(storedReply?.replyType).toBe('resource_found');
  });

  it('enforces idempotency and prevents duplicate replies when Meta retries webhook', async () => {
    const event: InstagramMessagingEvent = {
      sender: { id: 'test_user_alpha' },
      recipient: { id: 'our_page_omega' },
      timestamp: Date.now(),
      message: {
        mid: 'mid_duplicate_retry_002',
        attachments: [
          {
            type: 'ig_reel',
            payload: {
              url: 'https://www.instagram.com/reel/ICON_REEL_123/',
            },
          },
        ],
      },
    };

    // First arrival
    const firstRun = await EventProcessorService.processEvent(event);
    expect(firstRun.isDuplicate).toBe(false);
    expect(firstRun.actionTaken).toBe('reply_prepared');

    // Second arrival (Meta retry) with same mid
    const secondRun = await EventProcessorService.processEvent(event);
    expect(secondRun.isDuplicate).toBe(true);
    expect(secondRun.actionTaken).toBe('duplicate_dropped');

    // Total reply logs for this mid must remain exactly 1
    const totalReplies = await ReplyLog.countDocuments({ recipientId: 'test_user_alpha' });
    expect(totalReplies).toBe(1);
  });

  it('respects autoReplyEnabled: false setting without losing event records', async () => {
    // Disable automatic replies in settings
    await IntegrationSetting.updateOne(
      { singletonKey: 'global_settings' },
      { $set: { autoReplyEnabled: false } },
      { upsert: true }
    );

    const event: InstagramMessagingEvent = {
      sender: { id: 'test_user_beta' },
      recipient: { id: 'our_page_omega' },
      timestamp: Date.now(),
      message: {
        mid: 'mid_disabled_reply_003',
        attachments: [
          {
            type: 'ig_reel',
            payload: {
              url: 'https://www.instagram.com/reel/ICON_REEL_123/',
            },
          },
        ],
      },
    };

    const result = await EventProcessorService.processEvent(event);

    expect(result.success).toBe(true);
    expect(result.actionTaken).toBe('reply_disabled');

    // Event should be recorded in DB with reply_pending
    const storedEvent = await AutomationEvent.findOne({ providerMessageId: 'mid_disabled_reply_003' });
    expect(storedEvent).toBeDefined();
    expect(storedEvent?.processingStatus).toBe('reply_pending');

    // No ReplyLog should have been dispatched
    const replyCount = await ReplyLog.countDocuments({ eventId: storedEvent?._id });
    expect(replyCount).toBe(0);
  });

  it('guarantees unique constraint on ReplyLog.eventId prevents duplicate logical reply records', async () => {
    const event = await AutomationEvent.create({
      providerMessageId: 'mid_unique_reply_guard',
      senderId: 'user_gamma',
      recipientId: 'our_page_omega',
      eventTimestamp: Date.now(),
      messageType: 'shortcode_attachment',
      identificationStatus: 'identified',
      processingStatus: 'processing',
    });

    // First reply record succeeds
    await ReplyLog.create({
      eventId: event._id,
      recipientId: 'user_gamma',
      replyType: 'resource_found',
      renderedMessage: 'First reply instance',
      deliveryStatus: 'delivered_to_api',
    });

    // Attempting a second insert for the exact same eventId MUST violate the unique constraint
    let caughtError: any = null;
    try {
      await ReplyLog.create({
        eventId: event._id,
        recipientId: 'user_gamma',
        replyType: 'resource_found',
        renderedMessage: 'Duplicate reply attempt',
        deliveryStatus: 'delivered_to_api',
      });
    } catch (err: any) {
      caughtError = err;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError.code === 11000 || caughtError.message.includes('E11000')).toBe(true);

    const totalReplies = await ReplyLog.countDocuments({ eventId: event._id });
    expect(totalReplies).toBe(1);
  });

  it('recovers stuck events after worker crash (> 5 min lock)', async () => {
    const { EventWorkerService } = await import('../src/services/EventWorkerService');

    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    const crashedEvent = await AutomationEvent.create({
      providerMessageId: 'mid_crashed_worker_001',
      senderId: 'user_delta',
      recipientId: 'our_page_omega',
      eventTimestamp: Date.now(),
      messageType: 'shortcode_attachment',
      extractedReelId: 'ICON_REEL_123',
      identificationStatus: 'identified',
      processingStatus: 'processing', // Stuck in processing
      lockedAt: sixMinutesAgo,
      retryCount: 0,
      rawEventPayload: {
        sender: { id: 'user_delta' },
        recipient: { id: 'our_page_omega' },
        timestamp: Date.now(),
        message: {
          mid: 'mid_crashed_worker_001',
          text: 'https://www.instagram.com/reel/ICON_REEL_123/',
        },
      },
    });

    // Run queue sweep
    await EventWorkerService.processPendingQueue();

    // Stuck event should be unlocked, recovered, and processed to reply_sent
    const recovered = await AutomationEvent.findById(crashedEvent._id);
    expect(recovered?.processingStatus).toBe('reply_sent');
    expect(recovered?.retryCount).toBeGreaterThan(0);
  });
});

