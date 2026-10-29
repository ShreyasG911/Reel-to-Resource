import { Request, Response } from 'express';
import { Resource } from '../models/Resource';
import { ReelIdentifierAdapter } from '../adapters/ReelIdentifierAdapter';
import { escapeRegex, validateResourceInput, isValidDestinationUrl } from '../utils/validation';

export class ResourceController {
  /**
   * GET /api/v1/resources
   * List resources with pagination, escaped search, and filtering.
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
        const safeSearch = escapeRegex(search);
        query.$or = [
          { title: { $regex: safeSearch, $options: 'i' } },
          { reelId: { $regex: safeSearch, $options: 'i' } },
          { tags: { $in: [new RegExp(safeSearch, 'i')] } },
        ];
      }

      if (resourceType) {
        query.resourceType = resourceType.toLowerCase();
      }

      if (isAvailable !== undefined && isAvailable !== '') {
        query.isAvailable = isAvailable === 'true';
      }

      if (status) {
        query.status = status.toLowerCase();
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
   * Create a new resource with strict validation & duplicate Reel ID protection.
   */
  public static async create(req: Request, res: Response): Promise<void> {
    try {
      let candidateReelId = (req.body.reelId || '').trim();
      const extractedShortcode = ReelIdentifierAdapter.extractShortcode(candidateReelId);
      if (extractedShortcode) {
        candidateReelId = extractedShortcode;
      }

      const payload = {
        ...req.body,
        reelId: candidateReelId,
      };

      const validation = validateResourceInput(payload);
      if (!validation.valid || !validation.sanitized) {
        res.status(400).json({
          error: 'Validation failed',
          details: validation.errors,
        });
        return;
      }

      const sanitized = validation.sanitized;

      if (!ReelIdentifierAdapter.isValidShortcode(sanitized.reelId)) {
        res.status(400).json({
          error: `Invalid Reel identifier "${sanitized.reelId}". Must be 3-50 alphanumeric characters.`,
        });
        return;
      }

      // Check existing to provide a friendly message before DB write
      const existing = await Resource.findOne({ reelId: sanitized.reelId });
      if (existing) {
        res.status(409).json({
          error: `A resource is already registered for Reel ID "${sanitized.reelId}" ("${existing.title}")`,
          code: 'DUPLICATE_REEL_ID',
        });
        return;
      }

      const canonicalReelUrl = ReelIdentifierAdapter.toCanonicalUrl(sanitized.reelId);

      const newResource = await Resource.create({
        title: sanitized.title,
        description: sanitized.description,
        reelId: sanitized.reelId,
        reelShortcode: sanitized.reelId,
        numericMediaId: req.body.numericMediaId ? String(req.body.numericMediaId).trim() : undefined,
        canonicalReelUrl,
        resourceUrl: sanitized.resourceUrl,
        resourceType: sanitized.resourceType,
        tags: sanitized.tags,
        isAvailable: sanitized.isAvailable,
        status: sanitized.status,
        aliases: sanitized.aliases,
      });

      res.status(201).json({ data: newResource });
    } catch (err: any) {
      if (err.code === 11000) {
        res.status(409).json({
          error: 'A resource with this Reel identifier already exists (concurrent insert conflict).',
          code: 'DUPLICATE_REEL_ID',
        });
        return;
      }
      res.status(500).json({ error: 'Failed to create resource', details: err.message });
    }
  }

  /**
   * PATCH /api/v1/resources/:id
   */
  public static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const resource = await Resource.findById(id);
      if (!resource) {
        res.status(404).json({ error: 'Resource not found' });
        return;
      }

      const { title, description, resourceUrl, resourceType, tags, isAvailable, status, aliases } = req.body;

      if (title !== undefined) {
        const trimmed = String(title).trim();
        if (!trimmed || trimmed.length > 200) {
          res.status(400).json({ error: 'Title must be between 1 and 200 characters' });
          return;
        }
        resource.title = trimmed;
      }

      if (description !== undefined) {
        const trimmedDesc = String(description).trim();
        if (trimmedDesc.length > 1000) {
          res.status(400).json({ error: 'Description cannot exceed 1000 characters' });
          return;
        }
        resource.description = trimmedDesc;
      }

      if (resourceUrl !== undefined) {
        const trimmedUrl = String(resourceUrl).trim();
        if (!isValidDestinationUrl(trimmedUrl)) {
          res.status(400).json({ error: 'Resource URL must be a valid HTTP or HTTPS destination link' });
          return;
        }
        resource.resourceUrl = trimmedUrl;
      }

      if (resourceType !== undefined) {
        const allowed = ['template', 'guide', 'preset', 'code', 'link', 'other'];
        const typeLower = String(resourceType).toLowerCase();
        if (!allowed.includes(typeLower)) {
          res.status(400).json({ error: `Invalid resource type. Allowed: ${allowed.join(', ')}` });
          return;
        }
        resource.resourceType = typeLower as any;
      }

      if (status !== undefined) {
        const allowedStatuses = ['active', 'draft', 'archived'];
        const statusLower = String(status).toLowerCase();
        if (!allowedStatuses.includes(statusLower)) {
          res.status(400).json({ error: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
          return;
        }
        resource.status = statusLower as any;
      }

      if (tags !== undefined) {
        resource.tags = Array.isArray(tags)
          ? tags.map((t: any) => String(t).trim().toLowerCase()).filter((t: string) => t.length > 0 && t.length <= 30).slice(0, 50)
          : [];
      }

      if (isAvailable !== undefined) {
        resource.isAvailable = Boolean(isAvailable);
      }

      if (aliases !== undefined) {
        resource.aliases = Array.isArray(aliases)
          ? aliases.map((a: any) => String(a).trim()).filter((a: string) => a.length > 0 && a.length <= 50).slice(0, 20)
          : [];
      }

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
