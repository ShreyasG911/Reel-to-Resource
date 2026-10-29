# Reel to Resource Matcher

> **Production-oriented, self-hostable Instagram Reel-to-Resource automation platform.**  
> Automatically identify shared Instagram Reels in Direct Messages (DMs), search your internal resource database, and reply with the corresponding digital asset link.

---

## 1. Core Product Objective

**Reel to Resource Matcher** revolves around a focused, deterministic workflow:

```
Instagram DM containing a shared Reel 
       ↓
Identify Reel Identifier & Shortcode
       ↓
Search Internal MongoDB Resource Library
       ↓
Reply with Resource Link (or polite fallback)
```

### The Typical Experience:
1. An Instagram user discovers a Reel about a useful website, Figma kit, Notion template, Lightroom preset, software code repository, or digital guide.
2. The user taps the native **Share** icon and sends that Reel directly to our Instagram professional account in DM.
3. Meta triggers an eligible messaging webhook event to our backend.
4. The system validates the webhook signature (`X-Hub-Signature-256`), detects deduplicated events, and passes the payload to the **Reel Identification Adapter**.
5. The adapter extracts the Reel shortcode or canonical URL, stripping tracking parameters (`?igsh=...`, `?utm_*`).
6. The engine queries the MongoDB resource collection for an active, available resource.
7. If found and available, the system sends the resource link via Meta's official Send API.
8. If not found or currently unavailable, it dispatches a polite configurable fallback reply.
9. All events, matching results, delivery attempts, and statuses are permanently audited in the dashboard.

---

## 2. Strict Scope: What It Intentionally Does NOT Do

This is a focused automation utility, **not** a ManyChat marketing clone.

- ❌ **No Comment Monitoring:** Does not listen to or scrape public Reel comments.
- ❌ **No Comment-to-DM Spam:** Does not mandate users comment "LINK" or keyword-scrape public threads.
- ❌ **No Story Scraping or Mass Messaging:** Does not broadcast cold DMs, scrapers, or unsolicited messages.
- ❌ **No AI Hallucinations:** Matching is 100% deterministic using exact normalized identifiers. No generative AI models are used to invent resource links.
- ❌ **No Unofficial APIs:** Uses only official Meta Instagram Graph API endpoints. Never uses browser automation, Puppeteer, cookie extraction, or password scraping.

---

## 3. Technology Stack

- **Backend:** Node.js (v20+), Express.js, TypeScript.
- **Database:** MongoDB & Mongoose (indexed unique constraints for atomic deduplication).
- **Frontend Dashboard:** React 19, Vite, TypeScript, Tailwind CSS, Lucide Icons.
- **Integration:** Official Meta Instagram Messaging Webhooks & Send API (`v21.0`).
- **Resilience:** HMAC-SHA256 timing-safe verification, bounded retries with exponential backoff & jitter, 24-hour messaging window enforcement.
- **Deployment:** Multi-stage Docker, Docker Compose, single-port self-contained production mode.

---

## 4. System Requirements

- Node.js `v20.x` or higher
- MongoDB `v6.x` or `v7.x` (or a free MongoDB Atlas cluster)
- Docker & Docker Compose (optional, for containerized deployment)
- A public HTTPS domain or tunnel (Cloudflare Tunnel / ngrok) for Meta webhook delivery

---

## 5. Quickstart & Local Installation

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/reel-to-resource-matcher.git
cd reel-to-resource-matcher

# Install server and client dependencies
cd server && npm install
cd ../client && npm install
cd ..
```

### 2. Configure Environment Variables
Copy the template configuration file:
```bash
cp .env.example .env
```
Key configuration parameters:
| Parameter | Description |
| :--- | :--- |
| `PORT` | Backend port (default `5000`) |
| `MONGODB_URI` | MongoDB connection string (`mongodb://localhost:27017/reel_to_resource`) |
| `META_APP_SECRET` | Secret from Meta App Dashboard (used for HMAC signature verification) |
| `META_WEBHOOK_VERIFY_TOKEN` | Custom token you define for the Meta handshake |
| `META_PAGE_ACCESS_TOKEN` | Long-lived Page Access Token with `instagram_manage_messages` |
| `SIMULATION_MODE` | Set `true` to test locally without calling live Meta API |

### 3. Seed Demonstration Resources
Populate your database with sample resources (templates, guides, code repos, unavailable presets):
```bash
npm run seed
```

### 4. Start Development Servers
```bash
# Terminal 1: Backend API (Port 5000)
npm run dev:server

# Terminal 2: Frontend Dashboard with HMR (Port 5173)
npm run dev:client
```
Open **`http://localhost:5173`** in your browser to view the operator dashboard.

---

## 6. Simulation & Testing Tools

### 1. Interactive Webhook & Matcher Simulator
Simulate 5 real-world scenarios against your MongoDB database (including retry deduplication):
```bash
npm run cli:simulate-webhook
```

### 2. Custom Reel URL Extraction Tester
Test how the Reel Identification Adapter extracts shortcodes from raw links:
```bash
npm run cli:test-payload "https://www.instagram.com/reel/C890_MySampleReel/?igsh=MWx1YnpqamVvMWQx"
```

### 3. Automated Vitest Suite (38 Tests)
```bash
npm test
```
Verifies URL sanitization, canonical normalization, 3-tier matching priority, availability gates, 24h messaging window rules, bounded retries, and REST endpoints.

---

## 7. Meta Developer Application Setup

1. **Create Meta App:**
   - Go to [developers.facebook.com](https://developers.facebook.com) > **My Apps** > **Create App**.
   - Select **Other** as use case, and **Business** as app type.
2. **Add Instagram Product:**
   - Add **Instagram** to your app products.
   - Request permissions: `instagram_manage_messages`, `pages_manage_metadata`, `pages_read_engagement`.
3. **Configure Webhook:**
   - Go to **Webhooks** > select **Instagram**.
   - Callback URL: `https://your-domain.com/api/v1/webhooks/instagram`
   - Verify Token: The value of your `META_WEBHOOK_VERIFY_TOKEN`.
   - Under Subscriptions, click **Subscribe** on the **`messages`** field.
4. **Enable Message Controls:**
   - On the Instagram mobile app for your Professional Account:
   - Navigate to: **Settings & Privacy** > **Messages and story replies** > **Message controls**.
   - Under **Connected tools**, toggle ON **Allow access to messages**.

For detailed setup walkthroughs, see [`docs/INSTAGRAM_SETUP.md`](docs/INSTAGRAM_SETUP.md).

---

## 8. Docker Deployment

Deploy a single-command self-hosted stack containing both MongoDB and the unified application container:

```bash
# Build and run with Docker Compose
docker compose up -d --build
```
Access the dashboard and API on `http://localhost:5000`.

To view container logs:
```bash
docker compose logs -f app
```

For production reverse proxy (Caddy / Nginx) configuration and SSL, see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## 9. Current Meta API Limitations & Protections

1. **24-Hour Messaging Window:** Meta strictly prohibits automated messages if the user's initial interaction occurred more than 24 hours ago. The engine enforces this rule and marks expired attempts as `failed`.
2. **Private Account Shares:** If a user shares a Reel originating from a *private* Instagram account, Meta's privacy security layer redacts the media shortcode or marks the payload with `is_unsupported: true`. The application detects this and delivers a polite guidance template.
3. **Webhook Retries & Idempotency:** Meta delivers webhooks with an *at-least-once* guarantee. The engine uses atomic MongoDB unique indexes on `providerMessageId` (`mid`) to ensure that retries never trigger duplicate replies to the user.

---

## 10. Documentation Index

- 📘 [System Architecture & Open-Source Evaluation](docs/ARCHITECTURE.md)
- 📗 [Meta Graph API Webhook & Payload Specifications](docs/WEBHOOK_PAYLOADS.md)
- 📙 [Meta Developer App Setup & Permissions](docs/INSTAGRAM_SETUP.md)
- 📕 [Resource Database Schema & Deterministic Matching](docs/RESOURCE_DATABASE.md)
- 🛡️ [Security Protocol & Signature Verification](docs/SECURITY.md)
- 🚀 [Production Deployment & SSL Guide](docs/DEPLOYMENT.md)
- 🔧 [Operational Troubleshooting Guide](docs/TROUBLESHOOTING.md)

---

## 11. License & Attribution

This project is open-source under the [MIT License](LICENSE).  
Built for creators, digital educators, and developers seeking reliable, self-hosted automation without SaaS vendor lock-in.

