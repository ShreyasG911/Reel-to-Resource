import { Request, Response } from 'express';
import { Resource } from '../models/Resource';
import { AutomationEvent } from '../models/AutomationEvent';
import { ReplyLog } from '../models/ReplyLog';
import { IntegrationSetting } from '../models/IntegrationSetting';
import { MetaSendService } from '../services/MetaSendService';

export class IntegrationController {
  /**
   * GET /api/v1/integration/status
   * Reports system configuration checklist and verified integration readiness.
   * NEVER exposes actual secrets or token contents.
   */
  public static async getStatus(_req: Request, res: Response): Promise<void> {
    try {
      const settings = await IntegrationSetting.findOne({ singletonKey: 'global_settings' });

      const envChecks = {
        META_APP_ID: Boolean(process.env.META_APP_ID && process.env.META_APP_ID !== 'your_meta_app_id_here'),
        META_APP_SECRET: Boolean(process.env.META_APP_SECRET && process.env.META_APP_SECRET !== 'your_meta_app_secret_here'),
        META_WEBHOOK_VERIFY_TOKEN: Boolean(process.env.META_WEBHOOK_VERIFY_TOKEN && process.env.META_WEBHOOK_VERIFY_TOKEN !== 'your_custom_webhook_verify_token_here'),
        META_PAGE_ACCESS_TOKEN: Boolean(process.env.META_PAGE_ACCESS_TOKEN && process.env.META_PAGE_ACCESS_TOKEN !== 'your_meta_long_lived_page_access_token_here'),
        INSTAGRAM_ACCOUNT_ID: Boolean(process.env.INSTAGRAM_ACCOUNT_ID && process.env.INSTAGRAM_ACCOUNT_ID !== 'your_instagram_account_id_here'),
        MONGODB_URI: Boolean(process.env.MONGODB_URI),
      };

      const requiredKeys = ['META_APP_SECRET', 'META_WEBHOOK_VERIFY_TOKEN', 'META_PAGE_ACCESS_TOKEN'];
      const configuredCount = requiredKeys.filter((k) => (envChecks as any)[k]).length;

      let readinessStatus: 'ready' | 'partial' | 'unconfigured' = 'unconfigured';
      if (configuredCount === requiredKeys.length) {
        readinessStatus = 'ready';
      } else if (configuredCount > 0) {
        readinessStatus = 'partial';
      }

      res.status(200).json({
        data: {
          readinessStatus,
          simulationMode: settings?.simulationMode === true || process.env.SIMULATION_MODE === 'true',
          autoReplyEnabled: settings?.autoReplyEnabled ?? true,
          graphApiVersion: process.env.META_GRAPH_API_VERSION || 'v21.0',
          instagramAccountId: envChecks.INSTAGRAM_ACCOUNT_ID ? process.env.INSTAGRAM_ACCOUNT_ID : null,
          environmentChecklist: envChecks,
          webhookEndpoint: '/api/v1/webhooks/instagram',
          connectedAccount: settings?.connectedAccount || { status: 'unconfigured' },
          verificationCategories: {
            configuration: readinessStatus,
            credentialValidity: envChecks.META_PAGE_ACCESS_TOKEN ? 'configured' : 'missing',
            webhookEndpoint: 'available',
            simulationMode: (settings?.simulationMode === true || process.env.SIMULATION_MODE === 'true') ? 'active' : 'inactive',
          },
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve integration status', details: err.message });
    }
  }

  /**
   * POST /api/v1/integration/verify-credentials
   * Live validation of configured Meta Page Access Token against Graph API.
   */
  public static async verifyCredentials(_req: Request, res: Response): Promise<void> {
    try {
      const result = await MetaSendService.verifyCredentials();
      if (result.valid) {
        // Update connectedAccount status in database settings
        await IntegrationSetting.updateOne(
          { singletonKey: 'global_settings' },
          {
            $set: {
              'connectedAccount.accountId': result.accountId,
              'connectedAccount.username': result.accountName,
              'connectedAccount.connectedAt': new Date(),
              'connectedAccount.status': 'configured',
              'connectedAccount.lastError': undefined,
            },
          },
          { upsert: true }
        );

        res.status(200).json({
          success: true,
          verified: true,
          data: {
            accountId: result.accountId,
            accountName: result.accountName,
          },
          message: 'Meta credentials verified successfully with Graph API.',
        });
      } else {
        await IntegrationSetting.updateOne(
          { singletonKey: 'global_settings' },
          {
            $set: {
              'connectedAccount.status': 'error',
              'connectedAccount.lastError': result.error,
            },
          },
          { upsert: true }
        );

        res.status(400).json({
          success: false,
          verified: false,
          error: result.error,
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: 'Credential verification request failed', details: err.message });
    }
  }

  /**
   * GET /api/v1/analytics/overview
   * Aggregated dashboard metrics and recent operational logs.
   */
  public static async getOverview(_req: Request, res: Response): Promise<void> {
    try {
      const [
        totalResources,
        availableResources,
        totalEvents,
        matchedEvents,
        notFoundEvents,
        unsupportedEvents,
        ignoredEvents,
        successfulReplies,
        failedReplies,
        recentEvents,
      ] = await Promise.all([
        Resource.countDocuments(),
        Resource.countDocuments({ isAvailable: true, status: 'active' }),
        AutomationEvent.countDocuments(),
        AutomationEvent.countDocuments({ processingStatus: 'matched' }),
        AutomationEvent.countDocuments({ processingStatus: 'not_found' }),
        AutomationEvent.countDocuments({ processingStatus: 'unsupported_share' }),
        AutomationEvent.countDocuments({ processingStatus: 'ignored' }),
        ReplyLog.countDocuments({ deliveryStatus: { $in: ['delivered_to_api', 'simulated'] } }),
        ReplyLog.countDocuments({ deliveryStatus: 'failed' }),
        AutomationEvent.find()
          .sort({ createdAt: -1 })
          .limit(10)
          .populate('matchResult.resourceId', 'title resourceUrl')
          .lean(),
      ]);

      res.status(200).json({
        data: {
          metrics: {
            totalResources,
            availableResources,
            totalEvents,
            matchedEvents,
            notFoundEvents,
            unsupportedEvents,
            ignoredEvents,
            successfulReplies,
            failedReplies,
          },
          recentActivity: recentEvents,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve dashboard overview', details: err.message });
    }
  }
}
