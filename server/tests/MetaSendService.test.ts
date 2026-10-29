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

  it('fails with MISSING_PAGE_ACCESS_TOKEN when access token is unset and simulation is off', async () => {
    delete process.env.META_PAGE_ACCESS_TOKEN;
    process.env.SIMULATION_MODE = 'false';

    const event = await AutomationEvent.create({
      providerMessageId: 'mid_no_token',
      senderId: 'ig_user_no_token',
      recipientId: 'page_123',
      eventTimestamp: Date.now(),
      messageType: 'attachment_url',
      identificationStatus: 'identified',
      processingStatus: 'processing',
    });

    const replyLog = await ReplyLog.create({
      eventId: event._id,
      recipientId: 'ig_user_no_token',
      replyType: 'resource_found',
      renderedMessage: 'No token test',
      deliveryStatus: 'pending',
    });

    const result = await MetaSendService.sendDirectMessage({
      replyLogId: (replyLog._id as any).toString(),
      recipientId: 'ig_user_no_token',
      messageText: 'No token test',
      eventTimestamp: Date.now(),
      eventId: (event._id as any).toString(),
    });

    expect(result.success).toBe(false);
    expect(result.deliveryStatus).toBe('failed');
    expect(result.errorCode).toBe('MISSING_PAGE_ACCESS_TOKEN');
    expect(result.error).toContain('META_PAGE_ACCESS_TOKEN is missing');
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

  it('verifies credentials using Authorization header without exposing token in URL query', async () => {
    process.env.META_PAGE_ACCESS_TOKEN = 'secret_test_token_never_in_url';

    let interceptedUrl = '';
    let interceptedAuthHeader = '';

    const fetchMock = vi.fn().mockImplementation((url: string, opts?: any) => {
      interceptedUrl = url;
      interceptedAuthHeader = opts?.headers?.Authorization || '';
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          id: '123456789',
          name: 'Verified Business Page',
          instagram_business_account: {
            id: '17841400099999',
          },
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await MetaSendService.verifyCredentials();

    expect(result.valid).toBe(true);
    expect(result.hasInstagramAccount).toBe(true);
    expect(result.messagingReady).toBe(true);
    expect(result.instagramBusinessAccountId).toBe('17841400099999');

    // CRITICAL SECURITY ASSERTION: Token must NEVER be passed in URL query string
    expect(interceptedUrl).not.toContain('access_token=');
    expect(interceptedUrl).not.toContain('secret_test_token_never_in_url');

    // Token must be passed securely in Authorization Bearer header
    expect(interceptedAuthHeader).toBe('Bearer secret_test_token_never_in_url');

    vi.unstubAllGlobals();
  });

  it('marks send as uncertain_timeout on request timeout and does NOT blind retry', async () => {
    process.env.META_PAGE_ACCESS_TOKEN = 'mock_valid_token';
    process.env.META_API_TIMEOUT_MS = '100'; // Short timeout for testing

    const event = await AutomationEvent.create({
      providerMessageId: 'mid_timeout_test',
      senderId: 'ig_user_timeout',
      recipientId: 'page_123',
      eventTimestamp: Date.now(),
      messageType: 'attachment_url',
      identificationStatus: 'identified',
      processingStatus: 'processing',
    });

    const replyLog = await ReplyLog.create({
      eventId: event._id,
      recipientId: 'ig_user_timeout',
      replyType: 'resource_found',
      renderedMessage: 'Timeout test message',
      deliveryStatus: 'pending',
    });

    // Mock fetch to simulate an AbortError (timeout)
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    const fetchMock = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal('fetch', fetchMock);

    const result = await MetaSendService.sendDirectMessage({
      replyLogId: (replyLog._id as any).toString(),
      recipientId: 'ig_user_timeout',
      messageText: 'Timeout test message',
      eventTimestamp: Date.now(),
      eventId: (event._id as any).toString(),
    });

    expect(result.success).toBe(false);
    expect(result.deliveryStatus).toBe('uncertain_timeout');
    expect(result.isAmbiguous).toBe(true);
    expect(result.errorCode).toBe('AMBIGUOUS_SEND_TIMEOUT');
    expect(result.attemptsMade).toBe(1); // Must NOT blind retry

    // Check DB
    const updatedReply = await ReplyLog.findById(replyLog._id);
    expect(updatedReply?.deliveryStatus).toBe('uncertain_timeout');

    const updatedEvent = await AutomationEvent.findById(event._id);
    expect(updatedEvent?.processingStatus).toBe('reply_failed');
    expect(updatedEvent?.errorCode).toBe('AMBIGUOUS_SEND_TIMEOUT');

    delete process.env.META_API_TIMEOUT_MS;
    vi.unstubAllGlobals();
  });

  it('resolves authoritative numeric ID from Reel shortcode using Graph API media endpoint', async () => {
    process.env.META_PAGE_ACCESS_TOKEN = 'test_token';
    process.env.META_INSTAGRAM_ACCOUNT_ID = '17841400012345';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          {
            id: '17922314289204730',
            shortcode: 'DC5aXYZ89ab',
            permalink: 'https://www.instagram.com/reel/DC5aXYZ89ab/',
          },
          {
            id: '18109567273171899',
            shortcode: 'OTHER_SHORTCODE',
            permalink: 'https://www.instagram.com/reel/OTHER_SHORTCODE/',
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const resolved = await MetaSendService.resolveAuthoritativeNumericId('DC5aXYZ89ab');
    expect(resolved).not.toBeNull();
    expect(resolved?.numericMediaId).toBe('17922314289204730');
    expect(resolved?.permalink).toBe('https://www.instagram.com/reel/DC5aXYZ89ab/');

    // Calling with non-existent shortcode
    const notFound = await MetaSendService.resolveAuthoritativeNumericId('DOES_NOT_EXIST');
    expect(notFound).toBeNull();

    vi.unstubAllGlobals();
  });
});

