import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MetaSendService } from '../src/services/MetaSendService';
import { ReplyLog } from '../src/models/ReplyLog';
import { AutomationEvent } from '../src/models/AutomationEvent';
import { IntegrationSetting } from '../src/models/IntegrationSetting';

const TEST_DB_URI = 'mongodb://localhost:27017/reel_to_resource_send_test';

describe('MetaSendService', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URI);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await ReplyLog.deleteMany({});
    await AutomationEvent.deleteMany({});
    await IntegrationSetting.deleteMany({});
    delete process.env.META_PAGE_ACCESS_TOKEN;
    delete process.env.SIMULATION_MODE;
  });

  it('rejects sending when 24-hour messaging window has elapsed', async () => {
    const expiredTimestamp = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago

    expect(MetaSendService.isWithinMessagingWindow(expiredTimestamp)).toBe(false);

    const event = await AutomationEvent.create({
      providerMessageId: 'mid_expired_window',
      senderId: 'ig_user_expired',
      recipientId: 'page_123',
      eventTimestamp: expiredTimestamp,
      messageType: 'text_url',
      identificationStatus: 'identified',
      processingStatus: 'processing',
    });

    const replyLog = await ReplyLog.create({
      eventId: event._id,
      recipientId: 'ig_user_expired',
      replyType: 'resource_found',
      renderedMessage: 'Expired reply test',
      deliveryStatus: 'pending',
    });

    const result = await MetaSendService.sendDirectMessage({
      replyLogId: (replyLog._id as any).toString(),
      recipientId: 'ig_user_expired',
      messageText: 'Expired reply test',
      eventTimestamp: expiredTimestamp,
      eventId: (event._id as any).toString(),
    });

    expect(result.success).toBe(false);
    expect(result.deliveryStatus).toBe('failed');
    expect(result.error).toContain('Messaging window expired');

    // Verify DB updated
    const updatedReply = await ReplyLog.findById(replyLog._id);
    expect(updatedReply?.deliveryStatus).toBe('failed');
    expect(updatedReply?.lastError).toContain('Messaging window expired');
  });

  it('delivers as simulated when SIMULATION_MODE is enabled', async () => {
    process.env.SIMULATION_MODE = 'true';

    const event = await AutomationEvent.create({
      providerMessageId: 'mid_simulated_mode',
      senderId: 'ig_user_sim',
      recipientId: 'page_123',
      eventTimestamp: Date.now(),
      messageType: 'attachment_url',
      identificationStatus: 'identified',
      processingStatus: 'processing',
    });

    const replyLog = await ReplyLog.create({
      eventId: event._id,
      recipientId: 'ig_user_sim',
      replyType: 'resource_found',
      renderedMessage: 'Simulated reply text',
      deliveryStatus: 'pending',
    });

    const result = await MetaSendService.sendDirectMessage({
      replyLogId: (replyLog._id as any).toString(),
      recipientId: 'ig_user_sim',
      messageText: 'Simulated reply text',
      eventTimestamp: Date.now(),
      eventId: (event._id as any).toString(),
    });

    expect(result.success).toBe(true);
    expect(result.deliveryStatus).toBe('simulated');
    expect(result.providerMessageId).toContain('sim_mid_');

    const updatedReply = await ReplyLog.findById(replyLog._id);
    expect(updatedReply?.deliveryStatus).toBe('simulated');
  });

  it('fails fast on permanent Meta API error (e.g. 403 Forbidden)', async () => {
    process.env.META_PAGE_ACCESS_TOKEN = 'mock_invalid_token';

    const event = await AutomationEvent.create({
      providerMessageId: 'mid_perm_error',
      senderId: 'ig_user_fail',
      recipientId: 'page_123',
      eventTimestamp: Date.now(),
      messageType: 'attachment_url',
      identificationStatus: 'identified',
      processingStatus: 'processing',
    });

    const replyLog = await ReplyLog.create({
      eventId: event._id,
      recipientId: 'ig_user_fail',
      replyType: 'resource_found',
      renderedMessage: 'Permanent error text',
      deliveryStatus: 'pending',
    });

    // Mock global fetch to return 403 Forbidden from Meta
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: {
          message: '(#200) Provide valid permissions or account access',
          code: 200,
          error_subcode: 0,
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await MetaSendService.sendDirectMessage({
      replyLogId: (replyLog._id as any).toString(),
      recipientId: 'ig_user_fail',
      messageText: 'Permanent error text',
      eventTimestamp: Date.now(),
      eventId: (event._id as any).toString(),
    });

    expect(result.success).toBe(false);
    expect(result.deliveryStatus).toBe('failed');
    expect(result.isTransient).toBe(false);
    expect(result.attemptsMade).toBe(1); // No futile retries
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});

