import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { Server } from 'http';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';
import { Resource } from '../src/models/Resource';
import { AutomationEvent } from '../src/models/AutomationEvent';
import { ReplyLog } from '../src/models/ReplyLog';
import { IntegrationSetting } from '../src/models/IntegrationSetting';
import { AdminUser } from '../src/models/AdminUser';

const TEST_DB_URI = 'mongodb://localhost:27017/reel_to_resource_rest_api_test';

describe('Dashboard REST API Endpoints & Security', () => {
  let server: Server;
  let baseUrl: string;
  let adminAuthHeader: { Authorization: string };

  beforeAll(async () => {
    process.env.DASHBOARD_JWT_SECRET = 'test_dashboard_jwt_secret_32_characters_long_min!';
    process.env.ADMIN_JWT_SECRET = 'test_dashboard_jwt_secret_32_characters_long_min!';
    await mongoose.connect(TEST_DB_URI);
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    server?.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await Resource.deleteMany({});
    await AutomationEvent.deleteMany({});
    await ReplyLog.deleteMany({});
    await IntegrationSetting.deleteMany({});
    await AdminUser.deleteMany({});

    // Provision test administrator
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('CorrectAdminPassword123!', salt);
    await AdminUser.create({
      username: 'admin',
      passwordHash,
    });

    // Obtain JWT token via login endpoint
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'CorrectAdminPassword123!',
      }),
    });
    const loginBody: any = await loginRes.json();
    adminAuthHeader = {
      Authorization: `Bearer ${loginBody.token}`,
    };
  });

  // 1. Authentication & Anonymous Access Tests
  it('rejects unauthenticated requests to protected endpoints with 401', async () => {
    const endpoints = [
      { method: 'GET', path: '/api/v1/resources' },
      { method: 'POST', path: '/api/v1/resources' },
      { method: 'GET', path: '/api/v1/automation/settings' },
      { method: 'GET', path: '/api/v1/integration/status' },
      { method: 'GET', path: '/api/v1/analytics/overview' },
      { method: 'GET', path: '/api/v1/events' },
    ];

    for (const ep of endpoints) {
      const res = await fetch(`${baseUrl}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(401);
      const body: any = await res.json();
      expect(body.error).toMatch(/unauthorized|authentication required|token/i);
    }
  });

  it('rejects login with invalid credentials with 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'WrongPassword!',
      }),
    });
    expect(res.status).toBe(401);
    const body: any = await res.json();
    expect(body.error).toContain('Invalid username or password');
  });

  // 2. Resource Management Tests (Authenticated)
  it('POST /api/v1/resources creates resource and auto-generates canonical URL', async () => {
    const res = await fetch(`${baseUrl}/api/v1/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminAuthHeader },
      body: JSON.stringify({
        title: 'Figma System',
        reelId: 'https://instagram.com/reel/FIGMA_123/?utm=copy', // URL input normalized to shortcode
        resourceUrl: 'https://example.com/figma',
        resourceType: 'template',
        tags: ['figma', 'ui'],
      }),
    });

    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.data.title).toBe('Figma System');
    expect(body.data.reelId).toBe('FIGMA_123');
    expect(body.data.canonicalReelUrl).toBe('https://www.instagram.com/reel/FIGMA_123/');
  });

  it('POST /api/v1/resources rejects duplicate Reel ID with 409 Conflict', async () => {
    await Resource.create({
      title: 'Existing Resource',
      reelId: 'DUP_REEL_001',
      canonicalReelUrl: 'https://www.instagram.com/reel/DUP_REEL_001/',
      resourceUrl: 'https://example.com/existing',
    });

    const res = await fetch(`${baseUrl}/api/v1/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminAuthHeader },
      body: JSON.stringify({
        title: 'New Resource',
        reelId: 'DUP_REEL_001',
        resourceUrl: 'https://example.com/new',
      }),
    });

    expect(res.status).toBe(409);
    const body: any = await res.json();
    expect(body.error).toContain('already registered');
  });

  it('POST /api/v1/resources validates destination URL and rejects unsafe protocols with 400', async () => {
    const res = await fetch(`${baseUrl}/api/v1/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminAuthHeader },
      body: JSON.stringify({
        title: 'Unsafe Resource',
        reelId: 'UNSAFE_001',
        resourceUrl: 'javascript:alert(1)',
      }),
    });

    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error).toBe('Validation failed');
    expect(body.details.join(' ')).toContain('HTTP or HTTPS');
  });

  it('GET /api/v1/resources safely escapes search regex and lists matching resources', async () => {
    await Resource.create([
      {
        title: 'React [Hooks] Handbook',
        reelId: 'REACT_HOOKS',
        canonicalReelUrl: 'https://www.instagram.com/reel/REACT_HOOKS/',
        resourceUrl: 'https://example.com/react',
        resourceType: 'guide',
        tags: ['react'],
      },
      {
        title: 'Vue 3 Cheatsheet',
        reelId: 'VUE_SHEET',
        canonicalReelUrl: 'https://www.instagram.com/reel/VUE_SHEET/',
        resourceUrl: 'https://example.com/vue',
        resourceType: 'guide',
        tags: ['vue'],
      },
    ]);

    // Test with special regex characters that would crash unescaped RegExp
    const safeRegexRes = await fetch(`${baseUrl}/api/v1/resources?search=[Hooks]`, {
      headers: adminAuthHeader,
    });
    expect(safeRegexRes.status).toBe(200);
    const safeRegexBody: any = await safeRegexRes.json();
    expect(safeRegexBody.data.length).toBe(1);
    expect(safeRegexBody.data[0].title).toBe('React [Hooks] Handbook');

    // Test normal search query
    const res = await fetch(`${baseUrl}/api/v1/resources?search=react`, {
      headers: adminAuthHeader,
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].title).toBe('React [Hooks] Handbook');
    expect(body.pagination.total).toBe(1);
  });

  it('PATCH /api/v1/resources/:id updates fields and availability', async () => {
    const resource = await Resource.create({
      title: 'Original Title',
      reelId: 'PATCH_TEST_001',
      canonicalReelUrl: 'https://www.instagram.com/reel/PATCH_TEST_001/',
      resourceUrl: 'https://example.com/patch',
      isAvailable: true,
    });

    const res = await fetch(`${baseUrl}/api/v1/resources/${resource._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...adminAuthHeader },
      body: JSON.stringify({
        isAvailable: false,
        title: 'Updated Title',
      }),
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.isAvailable).toBe(false);
    expect(body.data.title).toBe('Updated Title');
  });

  it('DELETE /api/v1/resources/:id removes resource', async () => {
    const resource = await Resource.create({
      title: 'To Be Deleted',
      reelId: 'DELETE_TEST_001',
      canonicalReelUrl: 'https://www.instagram.com/reel/DELETE_TEST_001/',
      resourceUrl: 'https://example.com/delete',
    });

    const res = await fetch(`${baseUrl}/api/v1/resources/${resource._id}`, {
      method: 'DELETE',
      headers: adminAuthHeader,
    });

    expect(res.status).toBe(200);
    const check = await Resource.findById(resource._id);
    expect(check).toBeNull();
  });

  it('GET and PATCH /api/v1/automation/settings manages automation settings', async () => {
    const getRes = await fetch(`${baseUrl}/api/v1/automation/settings`, {
      headers: adminAuthHeader,
    });
    expect(getRes.status).toBe(200);
    const getBody: any = await getRes.json();
    expect(getBody.data.autoReplyEnabled).toBe(true);

    const patchRes = await fetch(`${baseUrl}/api/v1/automation/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...adminAuthHeader },
      body: JSON.stringify({
        autoReplyEnabled: false,
        templates: {
          resourceFound: 'Custom reply: {{resourceUrl}}',
        },
      }),
    });

    expect(patchRes.status).toBe(200);
    const patchBody: any = await patchRes.json();
    expect(patchBody.data.autoReplyEnabled).toBe(false);
    expect(patchBody.data.templates.resourceFound).toBe('Custom reply: {{resourceUrl}}');
  });

  it('POST /api/v1/automation/test-match simulates matching without outbound DMs', async () => {
    await Resource.create({
      title: 'Test Match Kit',
      reelId: 'SIM_MATCH_001',
      canonicalReelUrl: 'https://www.instagram.com/reel/SIM_MATCH_001/',
      resourceUrl: 'https://example.com/sim-kit',
      isAvailable: true,
      status: 'active',
    });

    const res = await fetch(`${baseUrl}/api/v1/automation/test-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminAuthHeader },
      body: JSON.stringify({
        input: 'https://www.instagram.com/reel/SIM_MATCH_001/?igsh=share',
      }),
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.identification.status).toBe('identified');
    expect(body.data.match.status).toBe('matched');
    expect(body.data.renderedReply).toContain('https://example.com/sim-kit');
  });

  it('GET /api/v1/integration/status returns environment checklist without secrets', async () => {
    const res = await fetch(`${baseUrl}/api/v1/integration/status`, {
      headers: adminAuthHeader,
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.environmentChecklist).toBeDefined();
    expect(body.data.webhookEndpoint).toBe('/api/v1/webhooks/instagram');
    // Ensure no secrets are leaked
    expect(JSON.stringify(body)).not.toContain('test_meta_app_secret');
    expect(JSON.stringify(body)).not.toContain('passwordHash');
  });

  it('GET /api/v1/analytics/overview returns aggregated statistics', async () => {
    await Resource.create({
      title: 'Overview Resource',
      reelId: 'OVERVIEW_001',
      canonicalReelUrl: 'https://www.instagram.com/reel/OVERVIEW_001/',
      resourceUrl: 'https://example.com/overview',
      isAvailable: true,
      status: 'active',
    });

    const res = await fetch(`${baseUrl}/api/v1/analytics/overview`, {
      headers: adminAuthHeader,
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.metrics.totalResources).toBe(1);
    expect(body.data.metrics.availableResources).toBe(1);
  });
});
