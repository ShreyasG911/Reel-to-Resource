import { Request, Response } from 'express';
import { Resource } from '../models/Resource';
import { ReelIdentifierAdapter } from '../adapters/ReelIdentifierAdapter';

export class ResourceController {
  /**
   * GET /api/v1/resources
   * List resources with pagination, search, and filtering.
   */
  public static async list(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
      const search = (req.query.search as string || '').trim();
      const resourceType = req.query.resourceType as string;
      const isAvailable = req.query.isAvailable as string;
      const status = req.query.status as string;

      const query: any = {};

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { reelId: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } },
        ];
      }

      if (resourceType) {
        query.resourceType = resourceType;
      }

      if (isAvailable !== undefined && isAvailable !== '') {
        query.isAvailable = isAvailable === 'true';
      }

      if (status) {
        query.status = status;
      }

      const total = await Resource.countDocuments(query);
      const resources = await Resource.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      res.status(200).json({
        data: resources,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch resources', details: err.message });
    }
  }

  /**
   * GET /api/v1/resources/:id
   */
  public static async getById(req: Request, res: Response): Promise<void> {
    try {
      const resource = await Resource.findById(req.params.id);
      if (!resource) {
        res.status(404).json({ error: 'Resource not found' });
        return;
      }
      res.status(200).json({ data: resource });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch resource', details: err.message });
    }
  }

  /**
   * POST /api/v1/resources
   * Create a new resource with normalization & duplicate Reel ID checks.
   */
  public static async create(req: Request, res: Response): Promise<void> {
    try {
      const { title, description, reelId, resourceUrl, resourceType, tags, isAvailable, status, aliases } = req.body;

      if (!title || !title.trim()) {
        res.status(400).json({ error: 'Resource title is required' });
        return;
      }

      if (!reelId || !reelId.trim()) {
        res.status(400).json({ error: 'Reel ID or shortcode is required' });
        return;
      }

      if (!resourceUrl || !resourceUrl.trim()) {
        res.status(400).json({ error: 'Destination resource URL is required' });
        return;
      }

      // Extract shortcode if user pasted a full URL instead of raw shortcode
      let normalizedReelId = reelId.trim();
      const extractedShortcode = ReelIdentifierAdapter.extractShortcode(normalizedReelId);
      if (extractedShortcode) {
        normalizedReelId = extractedShortcode;
      }

      if (!ReelIdentifierAdapter.isValidShortcode(normalizedReelId)) {
        res.status(400).json({
          error: `Invalid Reel identifier "${normalizedReelId}". Must be 3-50 alphanumeric characters (including dashes/underscores).`,
        });
        return;
      }

      // Check for duplicate Reel ID
      const existing = await Resource.findOne({ reelId: normalizedReelId });
      if (existing) {
        res.status(409).json({
          error: `A resource is already registered for Reel ID "${normalizedReelId}" ("${existing.title}")`,
        });
        return;
      }

      const canonicalReelUrl = ReelIdentifierAdapter.toCanonicalUrl(normalizedReelId);

      const newResource = await Resource.create({
        title: title.trim(),
        description: description?.trim(),
        reelId: normalizedReelId,
        canonicalReelUrl,
        resourceUrl: resourceUrl.trim(),
        resourceType: resourceType || 'link',
        tags: Array.isArray(tags) ? tags.map((t: string) => t.trim().toLowerCase()) : [],
        isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
        status: status || 'active',
        aliases: Array.isArray(aliases) ? aliases.map((a: string) => a.trim()) : [],
      });

      res.status(201).json({ data: newResource });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create resource', details: err.message });
    }
  }

  /**
   * PATCH /api/v1/resources/:id
   */
  public static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { title, description, resourceUrl, resourceType, tags, isAvailable, status, aliases } = req.body;

      const resource = await Resource.findById(id);
      if (!resource) {
        res.status(404).json({ error: 'Resource not found' });
        return;
      }

      if (title !== undefined) resource.title = title.trim();
      if (description !== undefined) resource.description = description.trim();
      if (resourceUrl !== undefined) resource.resourceUrl = resourceUrl.trim();
      if (resourceType !== undefined) resource.resourceType = resourceType;
      if (tags !== undefined) resource.tags = Array.isArray(tags) ? tags.map((t: string) => t.trim().toLowerCase()) : [];
      if (isAvailable !== undefined) resource.isAvailable = Boolean(isAvailable);
      if (status !== undefined) resource.status = status;
      if (aliases !== undefined) resource.aliases = Array.isArray(aliases) ? aliases.map((a: string) => a.trim()) : [];

      await resource.save();

      res.status(200).json({ data: resource });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update resource', details: err.message });
    }
  }

  /**
   * DELETE /api/v1/resources/:id
   */
  public static async delete(req: Request, res: Response): Promise<void> {
    try {
      const resource = await Resource.findByIdAndDelete(req.params.id);
      if (!resource) {
        res.status(404).json({ error: 'Resource not found' });
        return;
      }
      res.status(200).json({ message: 'Resource deleted successfully', id: req.params.id });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete resource', details: err.message });
    }
  }
}

