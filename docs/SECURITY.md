# Security Architecture & Safeguards

This document describes the security protocols, authentication mechanisms, signature verification, and defensive practices implemented in **Reel to Resource Matcher**.

---

## 1. Webhook Signature Verification (HMAC-SHA256)

Meta signs all webhook notifications delivered via HTTP POST with an `X-Hub-Signature-256` header. The signature is computed using HMAC-SHA256 with the app's secret key (`META_APP_SECRET`) against the raw request body buffer.

### Verification Flow:
1. Incoming POST requests to `/api/v1/webhooks/instagram` must provide the `X-Hub-Signature-256` header.
2. The raw request body buffer is captured before JSON parsing via `express.json({ verify: ... })`.
3. The expected signature is computed:
   ```typescript
   const expectedSignature = 'sha256=' + crypto
     .createHmac('sha256', process.env.META_APP_SECRET!)
     .update(rawBodyBuffer)
     .digest('hex');
   ```
4. The incoming and expected signatures are compared using **timing-safe comparison** (`crypto.timingSafeEqual`) to prevent timing attacks.
5. If the signature is missing or mismatched, the request is immediately rejected with HTTP `403 Forbidden` and logged as a security alert.

---

## 2. Administrator Authentication & Authorization (RBAC)

The administrative dashboard and all `/api/v1/*` data routes (except public webhook ingest and login/health) are strictly protected by role-based authentication:
- **Authentication Scheme:** JWT bearer tokens via `Authorization: Bearer <token>` and `HttpOnly`, `SameSite=Strict` session cookies.
- **Password Storage:** Administrator passwords are salted and hashed using `bcryptjs` with work factor 10. Password hashes are excluded from default MongoDB model queries (`select: false`).
- **Brute-Force Rate Limiting:** `POST /api/v1/auth/login` is guarded by a dedicated rate-limiter allowing a maximum of 5 failed attempts per 15-minute window per IP.
- **Admin Provisioning:** Secure CLI script `npm run admin:create <username> <password>` enables initial credential generation without hardcoding secrets in source control.

---

## 3. Token & Secret Protection

- **Zero Exposure to Frontend:** Neither `META_APP_SECRET`, `META_PAGE_ACCESS_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN`, `DASHBOARD_JWT_SECRET`, nor database connection strings are ever sent to client browsers or exposed in API responses.
- **Log Sanitization:** All request and response loggers filter out authorization headers, access tokens, and passwords before persisting to database or writing to stdout.
- **Sanitized Sender Data:** User identifiers (`sender.id`) are masked or stored as opaque platform-scoped IDs. Full private conversation histories are not retained.

---

## 4. Idempotency, Durable Queue & Race Condition Defense

Meta uses an *at-least-once* webhook delivery model. If network latency delays the 200 OK acknowledgment, Meta retries sending the same message.
- **Atomic Locking:** Events are persisted immediately as `pending` with a unique index on `providerMessageId` (`mid`). Concurrent deliveries are deduplicated via MongoDB `E11000` unique index enforcement.
- **Worker Locking:** Background workers acquire events via atomic `findOneAndUpdate` updating state to `processing` and setting `lockedAt`.
- **Crash Recovery:** Events stuck in `processing` longer than 5 minutes due to unexpected node termination are automatically recovered and retried with exponential backoff up to `maxRetryAttempts`.

---

## 5. Input Validation, URL Scheme Guard & ReDoS Prevention

- **Regex Escaping:** All freeform search queries in resource and event queries pass through `escapeRegex()` before insertion into MongoDB `$regex` filters, completely eliminating Regular Expression Denial of Service (ReDoS).
- **Protocol Validation:** Destination URLs are strictly validated to permit only `http://` and `https://` schemes, preventing `javascript:`, `data:`, `file:`, and SSRF vectors.
- **Canonical URL Integrity:** Alphanumeric shortcodes produce canonical `https://www.instagram.com/reel/<shortcode>/` URLs. Numeric video IDs (from CDN attachments) are explicitly never fabricated into fake canonical URLs to prevent broken 404 links.

---

## 6. Rate Limiting & Abuse Prevention

- Public webhook endpoints, authentication endpoints, and API routes are wrapped in rate-limiters (`express-rate-limit`).
- Graph API calls adhere strictly to Meta's published rate limits, utilizing exponential backoff when encountering HTTP 429 or transient 5xx responses.


