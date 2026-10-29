import { Request, Response } from 'express';
import { AutomationEvent } from '../models/AutomationEvent';
import { ReplyLog } from '../models/ReplyLog';
import { escapeRegex } from '../utils/validation';

export class EventsController {
  /**
   * GET /api/v1/events
   */
  public static async list(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 15));
      const status = req.query.status as string;
      const identificationStatus = req.query.identificationStatus as string;
      const search = (req.query.search as string || '').trim();

      const query: any = {};

      if (status) {
        query.processingStatus = status;
      }

      if (identificationStatus) {
        query.identificationStatus = identificationStatus;
      }

      if (search) {
        const safeSearch = escapeRegex(search);
        query.$or = [
          { providerMessageId: { $regex: safeSearch, $options: 'i' } },
          { senderId: { $regex: safeSearch, $options: 'i' } },
          { extractedReelId: { $regex: safeSearch, $options: 'i' } },
        ];
      }

      const total = await AutomationEvent.countDocuments(query);
      const events = await AutomationEvent.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('matchResult.resourceId', 'title resourceUrl reelId')
        .lean();

      res.status(200).json({
        data: events,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch events', details: err.message });
    }
  }

  /**
   * GET /api/v1/events/:id
   */
  public static async getById(req: Request, res: Response): Promise<void> {
    try {
      const event = await AutomationEvent.findById(req.params.id)
        .populate('matchResult.resourceId', 'title resourceUrl reelId canonicalReelUrl isAvailable')
        .lean();

      if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      const replies = await ReplyLog.find({ eventId: event._id }).sort({ createdAt: -1 }).lean();

      res.status(200).json({
        data: {
          ...event,
          replies,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch event', details: err.message });
    }
  }
}

