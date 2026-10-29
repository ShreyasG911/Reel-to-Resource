# Troubleshooting & Operational Guide

This document provides resolutions for common operational, network, and Meta Graph API integration issues.

---

## 1. Webhook Handshake Verification Issues

### Symptom:
When clicking **Verify and Save** in the Meta App Dashboard, Meta shows:
> "The URL couldn't be validated. Response did not match the challenge."

### Diagnostic Steps:
1. **Verify Token Mismatch:** Check that `META_WEBHOOK_VERIFY_TOKEN` in `.env` matches the exact string entered in the Meta dashboard.
2. **HTTPS Protocol:** Meta strictly rejects non-HTTPS URLs and self-signed SSL certificates. If testing locally, ensure your Cloudflare Tunnel or ngrok URL is active.
3. **Response Body:** Meta expects the raw string value of `hub.challenge` as plain text, not JSON wrapped in `{"challenge": "..."}`. The application automatically returns plain text.
4. **Test Manually:**
   ```bash
   curl "https://your-domain.com/api/v1/webhooks/instagram?hub.mode=subscribe&hub.challenge=12345&hub.verify_token=YOUR_VERIFY_TOKEN"
   ```
   Must return HTTP `200` with body `12345`.

---

## 2. Meta Send API Permission Errors

### Symptom:
Reply logs show:
> `(#200) Provide valid permissions or account access`

### Cause & Resolution:
1. **Missing Permission:** The Page Access Token must have the **`instagram_manage_messages`** permission. Regenerate the token in the Meta Graph API Explorer, selecting `instagram_manage_messages`, `pages_manage_metadata`, and `pages_read_engagement`.
2. **Connected Tools Toggle Disabled:**
   - In the Instagram mobile app for the professional account, navigate to:
     **Settings & Privacy** &gt; **Messages and story replies** &gt; **Message controls**.
   - Under **Connected tools**, enable **Allow access to messages**.
3. **App Review vs Developer Mode:**
   - In Development Mode, the app can only message users who are designated as **App Testers** or **Administrators** in the Meta App Dashboard.
   - For public Instagram users, the app must undergo Meta App Review for Advanced Access on `instagram_manage_messages`.

---

## 3. 24-Hour Messaging Window Expiration

### Symptom:
Reply status shows `failed` with:
> `Messaging window expired: Instagram Send API only permits replies within 24 hours of incoming message.`

### Meta Policy:
Meta restricts professional accounts from sending automated direct messages to users unless the user sent a message within the last 24 hours. The application enforces this policy to protect your Meta developer account from penalty.

---

## 4. Private Account Reels & Disappearing Media

### Symptom:
A user shares a Reel, but the system logs `unsupported_share` or `missing_identifier`.

### Cause:
- If a user shares a Reel originating from a **private Instagram account**, Meta's privacy boundaries drop the media URL or mark the attachment with `is_unsupported: true`.
- In such cases, the Reel shortcode is redacted by Meta. The system automatically responds with the configured fallback template asking the user to provide a direct public link if available.

---

## 5. Duplicate Webhook Deliveries

### Symptom:
Meta logs multiple delivery attempts for the same message.

### Resolution:
Meta operates on an *at-least-once* delivery model. If network congestion delays the `200 OK` acknowledgment, Meta automatically retries sending the webhook up to 3 times.
- The application's deduplication engine intercepts repeated incoming events using MongoDB unique indexes on `providerMessageId` (`mid`).
- Subsequent retries are logged as `duplicate` and safely discarded without sending duplicate direct messages to the user.

---

## 6. How to Toggle Simulation Mode

If you wish to test your deployment without connecting live Meta API credentials:
1. Navigate to the **Automation Settings** tab in the dashboard.
2. Toggle ON **Simulation Mode**.
3. Alternatively, set `SIMULATION_MODE=true` in your `.env` file.
All incoming webhooks will execute full database matching and log replies with status `simulated` without making external calls to Meta.

