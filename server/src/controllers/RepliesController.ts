import { Request, Response } from 'express';
import { ReplyLog } from '../models/ReplyLog';

export class RepliesController {
  /**
   * GET /api/v1/replies
   */
  public static async list(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 15));
      const deliveryStatus = req.query.deliveryStatus as string;
      const replyType = req.query.replyType as string;

      const query: any = {};

      if (deliveryStatus) {
        query.deliveryStatus = deliveryStatus;
      }

      if (replyType) {
        query.replyType = replyType;
      }

      const total = await ReplyLog.countDocuments(query);
      const replies = await ReplyLog.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('resourceId', 'title resourceUrl reelId')
        .populate('eventId', 'extractedReelId identificationStatus providerMessageId')
        .lean();

      res.status(200).json({
        data: replies,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch replies', details: err.message });
    }
  }

  /**
   * GET /api/v1/replies/:id
   */
  public static async getById(req: Request, res: Response): Promise<void> {
    try {
      const reply = await ReplyLog.findById(req.params.id)
        .populate('resourceId', 'title resourceUrl reelId')
        .populate('eventId')
        .lean();

      if (!reply) {
        res.status(404).json({ error: 'Reply log not found' });
        return;
      }

      res.status(200).json({ data: reply });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch reply log', details: err.message });
    }
  }
}

