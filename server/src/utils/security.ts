import crypto from 'crypto';

/**
 * Validates that the runtime security configuration meets production standards.
 * Fails fast at startup if configuration is missing, weak, or insecure in production.
 */
export function validateProductionSecurity(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const secret = process.env.DASHBOARD_JWT_SECRET || process.env.ADMIN_JWT_SECRET;

  if (isProduction) {
    if (!secret) {
      console.error('\n[FATAL SECURITY ERROR] DASHBOARD_JWT_SECRET is missing in production!');
      console.error('[FATAL SECURITY ERROR] The application cannot start without a secure, persistent JWT secret.');
      process.exit(1);
    }

    if (secret.length < 32) {
      console.error('\n[FATAL SECURITY ERROR] DASHBOARD_JWT_SECRET is too short (< 32 characters) for production!');
      console.error('[FATAL SECURITY ERROR] Generate a strong secret with: openssl rand -base64 32');
      process.exit(1);
    }
  } else {
    if (!secret) {
      console.warn('[Security Warning] No DASHBOARD_JWT_SECRET found. Using local development fallback secret.');
    }
  }
}

/**
 * Returns the active JWT secret.
 * Strictly forbids hardcoded secrets when NODE_ENV === 'production'.
 */
export function getJwtSecret(): string {
  const secret = process.env.DASHBOARD_JWT_SECRET || process.env.ADMIN_JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: DASHBOARD_JWT_SECRET environment variable is missing in production.');
    }
    return 'dev_fallback_secret_min_32_characters_long';
  }

  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('FATAL: DASHBOARD_JWT_SECRET must be at least 32 characters in production.');
  }

  return secret;
}

/**
 * Generates a cryptographically strong CSRF token.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Timing-safe comparison of CSRF tokens to prevent timing attacks.
 */
export function timingSafeCsrfCompare(tokenA?: string, tokenB?: string): boolean {
  if (!tokenA || !tokenB) return false;
  const bufA = Buffer.from(tokenA);
  const bufB = Buffer.from(tokenB);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

