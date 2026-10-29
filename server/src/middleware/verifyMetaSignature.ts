import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

/**
 * Middleware to verify Meta's X-Hub-Signature-256 header using timing-safe comparison.
 */
export function verifyMetaSignature(req: RawBodyRequest, res: Response, next: NextFunction): void {
  const signatureHeader = req.headers['x-hub-signature-256'] as string;
  const appSecret = process.env.META_APP_SECRET;

  // In test or local dev mode without an app secret configured, allow unverified bypass only if configured
  if (!appSecret) {
    if (process.env.NODE_ENV === 'production') {
      res.status(500).json({ error: 'META_APP_SECRET is not configured on server' });
      return;
    }
    return next();
  }

  if (!signatureHeader) {
    res.status(401).json({ error: 'Missing X-Hub-Signature-256 signature header' });
    return;
  }

  const parts = signatureHeader.split('=');
  const signature = parts[1];

  if (!signature || parts[0] !== 'sha256') {
    res.status(400).json({ error: 'Invalid signature header format. Expected sha256=...' });
    return;
  }

  if (!req.rawBody) {
    res.status(500).json({ error: 'Raw request body buffer unavailable for signature verification' });
    return;
  }

  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody)
    .digest('hex');

  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    res.status(403).json({ error: 'Signature mismatch. Request verification failed.' });
    return;
  }

  next();
}

