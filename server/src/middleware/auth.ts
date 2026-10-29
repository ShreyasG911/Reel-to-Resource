import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret, timingSafeCsrfCompare } from '../utils/security';

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
  let isCookieAuth = false;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if ((req as any).cookies?.admin_token) {
    token = (req as any).cookies.admin_token;
    isCookieAuth = true;
  }

  if (!token) {
    res.status(401).json({
      error: 'Authentication required. Please log in with administrator credentials.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  // CSRF Protection: For state-changing methods authenticated via cookies, verify CSRF token
  const mutatingMethods = ['POST', 'PATCH', 'PUT', 'DELETE'];
  if (isCookieAuth && mutatingMethods.includes(req.method.toUpperCase())) {
    const headerCsrf = req.headers['x-csrf-token'] as string | undefined;
    const cookieCsrf = (req as any).cookies?.csrf_token as string | undefined;

    if (!headerCsrf || !cookieCsrf || !timingSafeCsrfCompare(headerCsrf, cookieCsrf)) {
      res.status(403).json({
        error: 'CSRF validation failed: Missing or invalid X-CSRF-Token header.',
        code: 'CSRF_INVALID',
      });
      return;
    }
  }

  let jwtSecret: string;
  try {
    jwtSecret = getJwtSecret();
  } catch (err: any) {
    res.status(500).json({
      error: 'Server security configuration error: DASHBOARD_JWT_SECRET is missing or invalid.',
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
