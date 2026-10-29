/**
 * Input sanitization, regex escaping, and URL validation utilities
 */

/**
 * Escapes special regex characters in untrusted user input to prevent ReDoS and injection.
 */
export function escapeRegex(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validates destination URLs against safe protocols and formats.
 * Rejects javascript:, data:, file:, and unsafe SSRF targets.
 */
export function isValidDestinationUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  
  const trimmed = urlStr.trim();
  if (trimmed.length > 2048) return false;

  try {
    const parsed = new URL(trimmed);
    // Allow only http: and https: protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Reject localhost / loopback in production to prevent SSRF
    if (process.env.NODE_ENV === 'production') {
      const blockedHostnames = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254.169.254'];
      if (blockedHostnames.includes(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

export interface ValidatedResourceData {
  title: string;
  description?: string;
  reelId: string;
  resourceUrl: string;
  resourceType: 'template' | 'guide' | 'preset' | 'code' | 'link' | 'other';
  tags: string[];
  isAvailable: boolean;
  status: 'active' | 'draft' | 'archived';
  aliases: string[];
}

/**
 * Strict validator for resource creation and updates.
 */
export function validateResourceInput(data: any): { valid: boolean; errors: string[]; sanitized?: ValidatedResourceData } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Resource payload must be an object'] };
  }

  // Title validation
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  if (!title) {
    errors.push('Resource title is required');
  } else if (title.length > 200) {
    errors.push('Resource title cannot exceed 200 characters');
  }

  // Description validation
  let description: string | undefined;
  if (data.description !== undefined && data.description !== null) {
    description = String(data.description).trim();
    if (description.length > 1000) {
      errors.push('Description cannot exceed 1000 characters');
    }
  }

  // Reel ID validation
  const reelId = typeof data.reelId === 'string' ? data.reelId.trim() : '';
  if (!reelId) {
    errors.push('Reel identifier is required');
  } else if (reelId.length < 3 || reelId.length > 50) {
    errors.push('Reel identifier must be between 3 and 50 characters');
  }

  // Resource URL validation
  const resourceUrl = typeof data.resourceUrl === 'string' ? data.resourceUrl.trim() : '';
  if (!resourceUrl) {
    errors.push('Destination resource URL is required');
  } else if (!isValidDestinationUrl(resourceUrl)) {
    errors.push('Resource URL must be a valid HTTP or HTTPS destination link');
  }

  // Resource Type validation
  const allowedTypes = ['template', 'guide', 'preset', 'code', 'link', 'other'];
  const resourceType = data.resourceType ? String(data.resourceType).toLowerCase() : 'link';
  if (!allowedTypes.includes(resourceType)) {
    errors.push(`Invalid resource type "${resourceType}". Allowed: ${allowedTypes.join(', ')}`);
  }

  // Status validation
  const allowedStatuses = ['active', 'draft', 'archived'];
  const status = data.status ? String(data.status).toLowerCase() : 'active';
  if (!allowedStatuses.includes(status)) {
    errors.push(`Invalid status "${status}". Allowed: ${allowedStatuses.join(', ')}`);
  }

  // Tags validation
  let tags: string[] = [];
  if (Array.isArray(data.tags)) {
    tags = data.tags
      .map((t: any) => String(t).trim().toLowerCase())
      .filter((t: string) => t.length > 0 && t.length <= 30)
      .slice(0, 50);
  }

  // Aliases validation
  let aliases: string[] = [];
  if (Array.isArray(data.aliases)) {
    aliases = data.aliases
      .map((a: any) => String(a).trim())
      .filter((a: string) => a.length > 0 && a.length <= 50)
      .slice(0, 20);
  }

  const isAvailable = data.isAvailable !== undefined ? Boolean(data.isAvailable) : true;

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    sanitized: {
      title,
      description,
      reelId,
      resourceUrl,
      resourceType: resourceType as any,
      tags,
      isAvailable,
      status: status as any,
      aliases,
    },
  };
}

