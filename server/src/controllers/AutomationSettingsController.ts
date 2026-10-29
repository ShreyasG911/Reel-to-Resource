import { Request, Response } from 'express';
import { IntegrationSetting } from '../models/IntegrationSetting';
import { ReelIdentifierAdapter } from '../adapters/ReelIdentifierAdapter';
import { ResourceMatcherService } from '../services/ResourceMatcherService';
import { TemplateRenderer } from '../services/TemplateRenderer';
import { InstagramMessagingEvent } from '../types/instagram';

export class AutomationSettingsController {
  /**
   * GET /api/v1/automation/settings
   */
  public static async getSettings(_req: Request, res: Response): Promise<void> {
    try {
      let settings = await IntegrationSetting.findOne({ singletonKey: 'global_settings' });
      if (!settings) {
        settings = await IntegrationSetting.create({
          singletonKey: 'global_settings',
          autoReplyEnabled: true,
          simulationMode: process.env.SIMULATION_MODE === 'true',
        });
      }
      res.status(200).json({ data: settings });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch settings', details: err.message });
    }
  }

  /**
   * PATCH /api/v1/automation/settings
   */
  public static async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const { autoReplyEnabled, simulationMode, templates, maxRetryAttempts } = req.body;

      let settings = await IntegrationSetting.findOne({ singletonKey: 'global_settings' });
      if (!settings) {
        settings = new IntegrationSetting({ singletonKey: 'global_settings' });
      }

      if (autoReplyEnabled !== undefined) {
        settings.autoReplyEnabled = Boolean(autoReplyEnabled);
      }

      if (simulationMode !== undefined) {
        settings.simulationMode = Boolean(simulationMode);
      }

      if (maxRetryAttempts !== undefined) {
        const retries = parseInt(maxRetryAttempts, 10);
        if (!isNaN(retries) && retries >= 1 && retries <= 10) {
          settings.maxRetryAttempts = retries;
        }
      }

      if (templates && typeof templates === 'object') {
        if (templates.resourceFound !== undefined) {
          settings.templates.resourceFound = templates.resourceFound;
        }
        if (templates.resourceNotFound !== undefined) {
          settings.templates.resourceNotFound = templates.resourceNotFound;
        }
        if (templates.unsupportedReel !== undefined) {
          settings.templates.unsupportedReel = templates.unsupportedReel;
        }
        if (templates.resourceUnavailable !== undefined) {
          settings.templates.resourceUnavailable = templates.resourceUnavailable;
        }
      }

      await settings.save();
      res.status(200).json({ data: settings, message: 'Settings updated successfully' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update settings', details: err.message });
    }
  }

  /**
   * POST /api/v1/automation/test-match
   * Tests Reel identification and matching without sending real Instagram messages.
   */
  public static async testMatch(req: Request, res: Response): Promise<void> {
    try {
      const { input } = req.body;

      if (!input || typeof input !== 'string') {
        res.status(400).json({ error: 'Input string (URL or shortcode or text) is required' });
        return;
      }

      // Synthesize a simulated event for testing
      const simulatedEvent: InstagramMessagingEvent = {
        sender: { id: 'test_operator_user' },
        recipient: { id: 'our_professional_account' },
        timestamp: Date.now(),
        message: {
          mid: `test_match_${Date.now()}`,
          text: input,
          attachments: [
            {
              type: 'ig_reel',
              payload: {
                url: input,
              },
            },
          ],
        },
      };

      const identification = ReelIdentifierAdapter.identify(simulatedEvent);
      let matchResult: any = null;
      let renderedReply = '';
      let templateUsed = '';

      const settings = (await IntegrationSetting.findOne({ singletonKey: 'global_settings' })) || {
        templates: {
          resourceFound: 'Found it! Here is the resource you requested: {{resourceUrl}}',
          resourceNotFound: "We couldn't find this Reel in our resource library yet. We'll review it and may add the resource later.",
          unsupportedReel: "We couldn't identify this Reel automatically. If possible, please send its direct Reel link.",
          resourceUnavailable: 'This resource is currently undergoing maintenance or is temporarily unavailable. Please check back later!',
        },
      };

      if (identification.status === 'identified') {
        matchResult = await ResourceMatcherService.match(
          identification.reelId,
          identification.canonicalReelUrl,
          identification.videoId,
          identification.reelShortcode,
          identification.numericMediaId
        );

        if (matchResult.status === 'matched' && matchResult.resource) {
          templateUsed = 'resourceFound';
          renderedReply = TemplateRenderer.render(settings.templates.resourceFound, {
            resourceUrl: matchResult.resource.resourceUrl,
            title: matchResult.resource.title,
            reelId: identification.reelId,
            senderId: 'test_operator_user',
          });
        } else if (matchResult.status === 'unavailable' && matchResult.resource) {
          templateUsed = 'resourceUnavailable';
          renderedReply = TemplateRenderer.render(settings.templates.resourceUnavailable, {
            resourceUrl: matchResult.resource.resourceUrl,
            title: matchResult.resource.title,
            reelId: identification.reelId,
            senderId: 'test_operator_user',
          });
        } else {
          templateUsed = 'resourceNotFound';
          renderedReply = TemplateRenderer.render(settings.templates.resourceNotFound, {
            reelId: identification.reelId,
            senderId: 'test_operator_user',
          });
        }
      } else if (identification.status === 'unsupported_share') {
        templateUsed = 'unsupportedReel';
        renderedReply = TemplateRenderer.render(settings.templates.unsupportedReel, {
          senderId: 'test_operator_user',
        });
      } else {
        templateUsed = 'none (conversational message ignored)';
        renderedReply = '(No automated reply would be dispatched for this message)';
      }

      res.status(200).json({
        data: {
          input,
          identification,
          match: matchResult
            ? {
                matchFound: matchResult.matchFound,
                status: matchResult.status,
                matchedBy: matchResult.matchedBy,
                resource: matchResult.resource
                  ? {
                      id: matchResult.resource._id,
                      title: matchResult.resource.title,
                      reelId: matchResult.resource.reelId,
                      canonicalReelUrl: matchResult.resource.canonicalReelUrl,
                      resourceUrl: matchResult.resource.resourceUrl,
                      isAvailable: matchResult.resource.isAvailable,
                    }
                  : null,
              }
            : null,
          templateUsed,
          renderedReply,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Test match execution failed', details: err.message });
    }
  }
}

