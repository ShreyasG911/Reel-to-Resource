# Self-Hosting & Deployment Guide

This guide describes how to deploy **Reel to Resource Matcher** in production using Docker Compose, a VPS, or a cloud provider.

---

## 1. System Requirements

- **Server:** 1 vCPU, 1 GB RAM (minimal footprint).
- **OS:** Any Linux distribution with Docker installed (Ubuntu 22.04 LTS recommended).
- **Public HTTPS Domain:** Meta Graph API strictly requires valid SSL/HTTPS for all webhook endpoints.
- **Docker & Docker Compose:** Docker v24+ and Compose v2+.

---

## 2. Quickstart with Docker Compose (Recommended)

### Step 1: Clone Repository & Configure Environment
```bash
git clone https://github.com/your-username/reel-to-resource-matcher.git
cd reel-to-resource-matcher

# Create your production .env file
cp .env.example .env
nano .env
```
Ensure you configure:
- `META_APP_ID` & `META_APP_SECRET`
- `META_WEBHOOK_VERIFY_TOKEN` (a strong random token)
- `META_PAGE_ACCESS_TOKEN` (long-lived token with `instagram_manage_messages`)
- `FRONTEND_ORIGIN` (e.g. `https://matcher.yourdomain.com`)

### Step 2: Launch Containers
```bash
docker compose up -d --build
```
This builds the unified production container and initializes the MongoDB database with persistent volume storage.

### Step 3: Provision Administrator Credentials
The dashboard requires an authenticated administrator:
```bash
docker compose exec app npm run admin:create admin "YourSuperSecurePassword123!"
```
Alternatively, seeding demo data will provision an initial `admin` / `AdminPass123!` account (remember to change or recreate in production):
```bash
docker compose exec app npm run seed
```

---

## 3. Reverse Proxy & SSL Setup

Meta requires an HTTPS endpoint for incoming webhooks. You can terminate SSL using **Caddy** or **Nginx**.

### Option A: Caddy (Recommended — Automatic Let's Encrypt SSL)
Create a `Caddyfile`:
```caddy
matcher.yourdomain.com {
    reverse_proxy localhost:5000
}
```
Run Caddy:
```bash
caddy run --config Caddyfile
```
Caddy automatically provisions and renews SSL certificates.

### Option B: Nginx with Certbot
```nginx
server {
    server_name matcher.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Obtain SSL:
```bash
sudo certbot --nginx -d matcher.yourdomain.com
```

---

## 4. Local Testing with Cloudflare Tunnels or ngrok

During local development, Meta cannot reach `http://localhost:5000`. Use a tunnel to expose your local instance to HTTPS:

### Using Cloudflare Tunnels (Free & Persistent):
```bash
cloudflared tunnel --url http://localhost:5000
```
Copy the generated `https://*.trycloudflare.com` URL into your Meta App Dashboard as the Webhook Callback URL:
`https://your-tunnel-subdomain.trycloudflare.com/api/v1/webhooks/instagram`

### Using ngrok:
```bash
ngrok http 5000
```

---

## 5. MongoDB Backups & Maintenance

To create a backup of your resources and audit logs:
```bash
docker compose exec mongo mongodump --db reel_to_resource --out /data/db/backup
```

To restore from a backup:
```bash
docker compose exec mongo mongorestore --db reel_to_resource /data/db/backup/reel_to_resource
```

---

## 6. Updating the Application
```bash
git pull origin main
docker compose up -d --build
```
Database records in `mongo_data` remain intact during updates.

