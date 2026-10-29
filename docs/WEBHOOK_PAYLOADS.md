# Meta Instagram Messaging Webhooks & Payload Reference

This document provides official specifications and sanitized payload examples for Instagram messaging webhooks, focusing on shared Reels, direct links, and attachment edge cases.

---

## 1. Webhook Handshake (GET Verification)

When configuring your webhook in the Meta App Dashboard, Meta sends an HTTP GET request to your endpoint:

```http
GET /api/v1/webhooks/instagram?hub.mode=subscribe&hub.challenge=1158201444&hub.verify_token=YOUR_VERIFY_TOKEN HTTP/1.1
Host: your-domain.com
```

### Required Response:
- Status: `200 OK`
- Body: Exact string value of `hub.challenge` (e.g. `1158201444`).
- If `hub.verify_token` does not match your internal configuration, return `403 Forbidden`.

---

## 2. Webhook Event Notifications (POST)

When a user interacts with your Instagram Professional account, Meta delivers an HTTP POST request:

### Headers:
- `Content-Type: application/json`
- `X-Hub-Signature-256: sha256=<HMAC_HEX_DIGEST>`

The signature is computed over the raw request body using your Meta `APP_SECRET` as the HMAC key.

---

## 3. Supported Reel Share Scenarios

### Scenario A: Native Shared Reel Attachment (`ig_reel` / `reel`)

When a user taps the Share icon on an Instagram Reel and selects your professional account, Meta fires a webhook with an attachment object:

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "17841400000000001",
      "time": 1736259749438,
      "messaging": [
        {
          "sender": {
            "id": "7489201192837461"
          },
          "recipient": {
            "id": "17841400000000001"
          },
          "timestamp": 1736259748810,
          "message": {
            "mid": "aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDcwODk2MDAxMTMyOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTc5MTk0ODIyMzQ2MTc4MzozMjAyODMzOTIzMTc5NTQ1MDg2NjM5ODQyNDgwMzA0OTQ3MgZDZD",
            "attachments": [
              {
                "type": "ig_reel",
                "payload": {
                  "url": "https://www.instagram.com/reel/DC5aXYZ89ab/?igsh=MWx1YnpqamVvMWQx",
                  "title": "Top 10 Design Resources",
                  "video_id": "18109567273171822"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

#### Key Characteristics:
- `attachments[0].type`: `"ig_reel"` or `"reel"`
- `payload.url`: The Instagram Reel URL (may contain tracking parameters like `?igsh=...`, `?utm_source=...`)
- `payload.video_id`: Internal Instagram media/video ID.
- `payload.title`: Optional caption or title from the creator.

---

### Scenario B: Share Attachment with CDN Lookaside URL & Video ID

In some Graph API versions, Meta encapsulates media assets via lookaside CDN URLs:

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "17841400000000001",
      "time": 1736259749500,
      "messaging": [
        {
          "sender": {
            "id": "7489201192837461"
          },
          "recipient": {
            "id": "17841400000000001"
          },
          "timestamp": 1736259749000,
          "message": {
            "mid": "mid.lookaside.attachment.12345",
            "attachments": [
              {
                "type": "ig_reel",
                "payload": {
                  "url": "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=18109567273171822&signature=abcdef12345",
                  "video_id": "18109567273171822"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

#### Extraction Strategy:
- The adapter extracts the `video_id` (`18109567273171822`) and the `asset_id` query parameter from the CDN URL as secondary deterministic identifiers.

---

### Scenario C: Direct Reel Link Pasted as Message Text

Users often copy a Reel link from the Instagram app or browser and paste it directly into the chat:

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "17841400000000001",
      "time": 1736259750000,
      "messaging": [
        {
          "sender": {
            "id": "7489201192837461"
          },
          "recipient": {
            "id": "17841400000000001"
          },
          "timestamp": 1736259749800,
          "message": {
            "mid": "mid.direct.link.paste.98765",
            "text": "Check this out https://www.instagram.com/reel/C-xyz789_AB/?utm_source=ig_web_copy_link"
          }
        }
      ]
    }
  ]
}
```

#### Extraction Strategy:
- Detects the presence of an Instagram Reel URL inside `message.text`.
- Extracts the shortcode `C-xyz789_AB`.
- Strips URL query params and fragments to produce canonical URL: `https://www.instagram.com/reel/C-xyz789_AB/`.

---

### Scenario D: Unsupported / Ambiguous Attachments

Users frequently send stickers, disappearing photos, raw voice notes, or stories:

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "17841400000000001",
      "time": 1736259751000,
      "messaging": [
        {
          "sender": {
            "id": "7489201192837461"
          },
          "recipient": {
            "id": "17841400000000001"
          },
          "timestamp": 1736259750900,
          "message": {
            "mid": "mid.unsupported.sticker.11111",
            "attachments": [
              {
                "type": "image",
                "payload": {
                  "url": "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=9999"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

#### Expected Adapter Result:
- Status: `unsupported_share`
- Reason: Non-reel attachment type `image` without Reel metadata.

---

### Scenario E: Unrelated Text Messages

General conversational inquiries (e.g. "Hi, how are you?"):

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "17841400000000001",
      "time": 1736259752000,
      "messaging": [
        {
          "sender": {
            "id": "7489201192837461"
          },
          "recipient": {
            "id": "17841400000000001"
          },
          "timestamp": 1736259751950,
          "message": {
            "mid": "mid.general.text.22222",
            "text": "Hello, when does your course start?"
          }
        }
      ]
    }
  ]
}
```

#### Expected Adapter Result:
- Status: `missing_identifier`
- The system will NOT trigger automated resource replies for plain conversational queries.

---

## 4. Normalization Rules

1. **Shortcode Character Set:** Instagram Reel shortcodes consist of alphanumeric characters, dashes, and underscores (`[a-zA-Z0-9_-]+`).
2. **Canonical Format:** Every identified Reel shortcode `<code>` is normalized to canonical URL:
   `https://www.instagram.com/reel/<code>/`
3. **Stripping Garbage:** Query parameters (such as `igsh`, `utm_*`, `fbclid`), trailing hashes, and trailing slashes are systematically stripped during normalization.
4. **URL Patterns Recognized:**
   - `https?://(www\.)?instagram\.com/reel/([a-zA-Z0-9_-]+)`
   - `https?://(www\.)?instagram\.com/reels/([a-zA-Z0-9_-]+)`
   - `https?://(www\.)?instagram\.com/p/([a-zA-Z0-9_-]+)` (when sent as reel)
   - `https?://instagr\.am/reel/([a-zA-Z0-9_-]+)`

