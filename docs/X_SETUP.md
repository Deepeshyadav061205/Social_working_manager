# X (Twitter) Direct API & OAuth 2.0 Setup Guide

> **Note:** Direct API publishing for X is **completely optional**. By default, Social Working Manager uses **One-Click Transfer** mode (`https://x.com/intent/tweet`), which requires zero credentials and zero API credits. Follow this guide only if you want one-click **Direct API** posting from inside the app.

---

## 1. Create an X Developer Account & App

1. Sign in to the [X Developer Console](https://developer.x.com/en/portal/dashboard) and create a developer account if you do not have one.
2. Create a **Project** and an **App** inside the Developer Console (or select an existing App enrolled in your Project).
3. Because X's API now uses pay-per-use credits (with no free write tier), open **Billing / Credits** in the X Developer Console and **buy a small amount of API credits** so your project can call `POST https://api.x.com/2/tweets` and `GET https://api.x.com/2/users/me`.

---

## 2. Configure User Authentication Settings (OAuth 2.0)

1. In your App dashboard, go to **Settings → User authentication settings** and click **Set up** (or **Edit**).
2. Configure the fields exactly as follows:
   - **App permissions:** Select **Read and write** (required to post tweets and threads).
   - **Type of App:** Select **Web App, Automated App or Bot** (Confidential client — uses PKCE + Basic Auth client secret).
   - **App info — Callback URI / Redirect URL:**
     - Local development (exact match required):
       ```text
       http://localhost:3000/api/connections/x/callback
       ```
     - Production deployment (add when deploying; exact match required, no trailing slash):
       ```text
       https://your-production-domain.com/api/connections/x/callback
       ```
   - **App info — Website URL:** Enter a valid URL (e.g. `https://example.com` or your production domain).
3. Click **Save**.

---

## 3. Copy OAuth 2.0 Credentials into `.env.local`

1. After saving User authentication settings (or under the **Keys and tokens** tab → **OAuth 2.0 Client ID and Client Secret**), copy your **Client ID** and **Client Secret** (not the OAuth 1.0a Consumer Keys or Bearer Token).
2. Add them to `.env.local` alongside `NEXT_PUBLIC_APP_URL`:
   ```env
   X_CLIENT_ID=your_oauth2_client_id_here
   X_CLIENT_SECRET=your_oauth2_client_secret_here
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```
   *(Make sure `TOKEN_ENCRYPTION_KEY` is also set to a 32-byte base64 string via `openssl rand -base64 32`.)*

---

## 4. Run Migration 003 in Supabase SQL Editor

X OAuth 2.0 access tokens expire after roughly **2 hours**. Social Working Manager requests the `offline.access` scope (`tweet.read tweet.write users.read offline.access`) and stores an AES-256-GCM encrypted refresh token in `public.platform_connections.refresh_token_enc` so tokens auto-refresh transparently.

1. Open your **Supabase Dashboard → SQL Editor → New query**.
2. Paste the contents of [`supabase/migrations/003_x_refresh_token.sql`](../supabase/migrations/003_x_refresh_token.sql) (or re-run [`supabase/setup_all.sql`](../supabase/setup_all.sql)) and click **Run**.

---

## 5. Testing Without API Credits (`X_MOCK=true`)

To test the entire OAuth connection flow, token verification, and direct publishing UI locally without spending X API credits or configuring an X developer app:

1. Set `X_MOCK=true` in `.env.local` (ignored automatically when `NODE_ENV=production`):
   ```env
   X_MOCK=true
   ```
2. Restart `npm run dev`, open **Connections**, and click **Connect** on the X card. It will simulate connecting as `@mock_user`, allow **Test connection**, and simulate direct publishing in the Publish dialog.

---

## 6. Troubleshooting

| Issue / Status | Cause | Resolution |
|---|---|---|
| **`redirect_uri` mismatch** (error on X authorize screen) | The callback URL sent by the app (`${NEXT_PUBLIC_APP_URL}/api/connections/x/callback`) does not match the Callback URI in the X Developer Console character-for-character. | Verify `NEXT_PUBLIC_APP_URL` in `.env.local` has no trailing slash (e.g. `http://localhost:3000`) and that `http://localhost:3000/api/connections/x/callback` is listed under **User authentication settings → Callback URI / Redirect URL**. |
| **`401 Unauthorized`** | Access token expired and the refresh token was revoked, missing, or invalid. | Click **Reconnect** on the X card in `/connections`. Ensure migration `003_x_refresh_token.sql` has been run in Supabase so rotated refresh tokens are persisted. |
| **`402 Payment Required` / Credits / Not enrolled** | Your X developer account has no remaining pay-per-use API credits, or the App is not attached to an enrolled Project in the X Developer Console. | Add API credits under **Billing** in the X Developer Console and ensure the App is inside a Project, or check **Use transfer link instead** to post via One-Click Transfer for free. |
| **`403 Forbidden` (Duplicate content)** | X rejects identical tweet text posted recently by the same account. | Edit the post wording slightly in the editor or Publish dialog and try again. |
| **`403 Forbidden` (Permissions)** | The X App was configured with **Read** permissions only before the account was connected. | Change **App permissions** to **Read and write** in the X Developer Console, save, and click **Reconnect** in `/connections` to grant `tweet.write`. |
| **`429 Too Many Requests`** | X per-user or per-app rate limit was reached. | Wait until the reset timestamp shown in the error message (from `x-rate-limit-reset`), or use **One-Click Transfer** mode to post immediately in the X web composer. |
