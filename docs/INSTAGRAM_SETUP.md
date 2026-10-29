# Meta Instagram Graph API Setup Guide

This guide walks through configuring your Meta Developer Application to enable automated Instagram Direct Message replies for shared Reels.

---

## 1. Prerequisites

1. An **Instagram Professional Account** (Business or Creator). Personal accounts cannot receive messaging webhooks.
2. A **Facebook Page** linked to the Instagram Professional Account.
3. A **Meta Developer Account** (https://developers.facebook.com).

---

## 2. Meta App Creation

1. Go to the [Meta App Dashboard](https://developers.facebook.com/apps/).
2. Click **Create App**.
3. Select **Other** as the use case, then choose **Business** as the app type.
4. Enter an App Name (e.g. `Reel to Resource Matcher`) and select your Business Account.
5. Once created, add the **Instagram** product to your app.

---

## 3. Required Permissions

Your app requires the following permissions for Instagram Direct Message automation:

| Permission | Purpose | Access Level |
| :--- | :--- | :--- |
| `instagram_manage_messages` | Read incoming direct messages & send responses via Send API | Advanced Access (for production) |
| `pages_manage_metadata` | Subscribe to webhooks on linked Facebook Page | Advanced Access |
| `pages_read_engagement` | Read account information | Advanced Access |

> [!NOTE]
> During development, any Instagram account added as an **App Tester** or **App Administrator** can receive messages without undergoing Meta App Review.

---

## 4. Webhook Configuration

1. In the Meta App Dashboard, navigate to **Webhooks** > Select **Instagram** from the dropdown.
2. Click **Subscribe to this object**.
3. Enter your publicly accessible HTTPS callback URL:
   - **Callback URL:** `https://your-domain.com/api/v1/webhooks/instagram`
   - **Verify Token:** The value of `META_WEBHOOK_VERIFY_TOKEN` defined in your `.env` file.
4. Click **Verify and Save**. Meta will send a GET request with `hub.challenge`.
5. Under Webhook Subscriptions, find the field **`messages`** and click **Subscribe**.

---

## 5. Connecting Your Instagram Account

1. Under the Instagram API product settings, navigate to **Basic Display** or **Instagram Graph API**.
2. Generate a long-lived **Page Access Token** with `instagram_manage_messages` scope.
3. Copy the token into your `.env` file under `META_PAGE_ACCESS_TOKEN`.
4. Ensure your Instagram account has **Allow Access to Messages** enabled:
   - Open Instagram App on mobile.
   - Go to **Settings & Privacy** > **Messages and story replies** > **Message controls**.
   - Under Connected tools, toggle ON **Allow access to messages**.

---

## 6. Messaging Window & Eligibility Rules

- **24-Hour Messaging Window:** When an Instagram user sends a message or shares a Reel to your account, a 24-hour window opens. Automated replies must be sent within this 24-hour period.
- **Recipient Eligibility:** The Send API can only message users who have initiated a conversation with your account. It cannot be used for unsolicited cold outreach.

