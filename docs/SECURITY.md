# Security Architecture & Safeguards

This document describes the security protocols, signature verification mechanisms, and defensive practices implemented in **Reel to Resource Matcher**.

---

## 1. Webhook Signature Verification (HMAC-SHA256)

Meta signs all webhook notifications delivered via HTTP POST with an `X-Hub-Signature-256` header. The signature is computed using HMAC-SHA256 with the app's secret key (`META_APP_SECRET`) against the raw request body buffer.

### Verification Flow:
1. Incoming POST requests to `/api/v1/webhooks/instagram` must provide the `X-Hub-Signature-256` header.
2. The raw request body buffer is captured before JSON parsing.
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

## 2. Token & Secret Protection

- **Zero Exposure to Frontend:** Neither `META_APP_SECRET`, `META_PAGE_ACCESS_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN`, nor database connection strings are ever sent to client browsers or exposed in API responses.
- **Log Sanitization:** All request and response loggers filter out authorization headers, access tokens, and passwords before persisting to database or writing to stdout.
- **Sanitized Sender Data:** User identifiers (`sender.id`) are masked or stored as opaque platform-scoped IDs. Full private conversation histories are not retained.

---

## 3. Idempotency & Replay Attack Defense

Meta uses an *at-least-once* webhook delivery model. If network latency delays the 200 OK acknowledgment, Meta retries sending the same message.
- To prevent sending duplicate replies to the same user for the same Reel share, the system maintains a database constraint on `providerMessageId` (`mid`).
- If an event with an existing `mid` is received, it is flagged as `duplicate` and discarded before triggering the outbound Send API.

---

## 4. Input Validation & NoSQL Injection Defense

- All incoming parameters (Reel IDs, shortcodes, search queries) undergo strict type checking and regex validation.
- MongoDB queries use strongly typed Mongoose models with parameterized filters instead of raw object passes, mitigating NoSQL injection vulnerabilities.
- Outbound URLs are checked against trusted protocols (`https://`) to prevent SSRF and protocol smuggling.

---

## 5. Rate Limiting & Abuse Prevention

- Public webhook endpoints and authenticated dashboard API routes are wrapped in rate-limiters (`express-rate-limit`).
- Graph API calls adhere strictly to Meta's published rate limits, utilizing exponential backoff when encountering HTTP 429 or transient 5xx responses.

