import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AdminUser } from '../models/AdminUser';

export interface AuthenticatedRequest extends Request {
  admin?: {
    id: string;
    username: string;
    role: string;
  };
}

export function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if ((req as any).cookies?.admin_token) {
    token = (req as any).cookies.admin_token;
  }

  if (!token) {
    res.status(401).json({
      error: 'Authentication required. Please log in with administrator credentials.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const jwtSecret =
    process.env.DASHBOARD_JWT_SECRET ||
    process.env.ADMIN_JWT_SECRET ||
    (process.env.NODE_ENV !== 'production' ? 'dev_fallback_secret_min_32_characters_long' : undefined);

  if (!jwtSecret) {
    res.status(500).json({
      error: 'Server security configuration error: DASHBOARD_JWT_SECRET is missing.',
      code: 'SERVER_MISCONFIGURED',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as { id: string; username: string; role: string };
    req.admin = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role || 'admin',
    };
    next();
  } catch (err: any) {
    res.status(401).json({
      error: 'Invalid or expired session token. Please log in again.',
      code: 'INVALID_TOKEN',
    });
  }
}
