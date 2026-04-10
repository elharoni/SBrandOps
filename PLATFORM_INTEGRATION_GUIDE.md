# 🔌 Platform Integration Guide

## Overview
هذا الدليل يشرح كيفية إعداد OAuth integration لكل منصة من منصات Social Media.

---

## 1. Facebook & Instagram

### Setup Steps:

#### A. Create Facebook App
1. Go to: https://developers.facebook.com/apps
2. Click **Create App**
3. Select **Business** type
4. Fill in app details:
   - App Name: "SBrandOps"
   - Contact Email: your email
5. Click **Create App**

#### B. Configure App
1. Go to **Settings** > **Basic**
2. Copy your **App ID** and **App Secret**
3. Add to `.env`:
   ```env
   VITE_FACEBOOK_APP_ID=your_app_id_here
   VITE_FACEBOOK_APP_SECRET=your_app_secret_here
   ```

#### C. Set Allowed Domains
1. Go to **Settings** > **Basic**
2. Add **App Domains**:
   ```
   localhost
   ```
3. Add **Site URL**:
   ```
   https://localhost:3000/
   ```

#### D. Enable Required Products
1. Go to **Add Product**
2. Enable **Facebook Login**:
   - Valid OAuth Redirect URIs: `https://localhost:3000/`
3. Enable **Instagram Basic Display**
4. Go to **Permissions** and request:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `instagram_basic`
   - `instagram_content_publish`

#### E. Make App Live
1. Toggle **App Mode** from "Development" to "Live"
2. Complete **App Review** if needed for advanced permissions

---

## 2. Twitter / X

### Setup Steps:

#### A. Create Twitter Developer Account
1. Go to: https://developer.x.com/
2. Apply for **Developer Account** (if you don't have one)
3. Create a new **Project** and **App**

#### B. Get API Keys
1. Go to your app's **Keys and tokens** tab
2. Generate:
   - API Key
   - API Secret
   - Bearer Token
   - Access Token & Secret

3. Add to `.env`:
   ```env
   VITE_TWITTER_API_KEY=your_api_key
   VITE_TWITTER_API_SECRET=your_api_secret
   VITE_TWITTER_BEARER_TOKEN=your_bearer_token
   VITE_TWITTER_ACCESS_TOKEN=your_access_token
   VITE_TWITTER_ACCESS_TOKEN_SECRET=your_token_secret
   ```

#### C. Configure OAuth Settings
1. Go to **App settings** > **User authentication settings**
2. Enable **OAuth 2.0**
3. Set **Callback URL**: `https://localhost:3000/auth/twitter/callback`
4. Set **Website URL**: `https://localhost:3000`
5. Permissions: **Read and Write**

---

## 3. LinkedIn

### Setup Steps:

#### A. Create LinkedIn App
1. Go to: https://www.linkedin.com/developers/apps
2. Click **Create app**
3. Fill in:
   - App name
   - LinkedIn Page (you need a company page)
   - Privacy policy URL
   - App logo

#### B. Get Client Credentials
1. Go to **Auth** tab
2. Copy **Client ID** and **Client Secret**
3. Add to `.env`:
   ```env
   VITE_LINKEDIN_CLIENT_ID=your_client_id
   VITE_LINKEDIN_CLIENT_SECRET=your_client_secret
   ```

#### C. Configure OAuth
1. Go to **Auth** tab
2. Add **Authorized redirect URLs**:
   ```
   https://localhost:3000/auth/linkedin/callback
   ```
3. Request **OAuth 2.0 scopes**:
   - `w_member_social` (Share on LinkedIn)
   - `r_organization_social` (Read company page posts)
   - `w_organization_social` (Share as company page)

---

## 4. TikTok

### Setup Steps:

#### A. Register as TikTok Developer
1. Go to: https://developers.tiktok.com/
2. Register your account
3. Create a new app

#### B. Get App Credentials
1. Go to your app's dashboard
2. Copy **Client Key** and **Client Secret**
3. Add to `.env`:
   ```env
   VITE_TIKTOK_CLIENT_KEY=your_client_key
   VITE_TIKTOK_CLIENT_SECRET=your_client_secret
   ```

#### C. Configure OAuth
1. Set **Redirect URI**: `https://localhost:3000/auth/tiktok/callback`
2. Request **Scopes**:
   - `user.info.basic`
   - `video.upload`
   - `video.publish`

---

## 5. Pinterest

### Setup Steps:

#### A. Create Pinterest App
1. Go to: https://developers.pinterest.com/apps/
2. Create a new app
3. Fill in app details

#### B. Get App Credentials
1. Copy **App ID** and **App secret**
2. Add to `.env`:
   ```env
   VITE_PINTEREST_APP_ID=your_app_id
   VITE_PINTEREST_APP_SECRET=your_app_secret
   ```

#### C. Configure OAuth
1. Set **Redirect URI**: `https://localhost:3000/auth/pinterest/callback`
2. Request **Scopes**:
   - `boards:read`
   - `boards:write`
   - `pins:read`
   - `pins:write`

---

## Testing OAuth Flow

### For Each Platform:

1. **Load Facebook SDK** (already done for Facebook/Instagram)
2. **Implement OAuth 2.0 Flow** for other platforms
3. **Test Connection**:
   - Click "Connect Account" button
   - Authorize the app
   - Select pages/accounts
   - Verify saved in database

---

## Current Status

| Platform | OAuth | Fetch Assets | Save to DB | Status |
|----------|-------|--------------|------------|--------|
| Facebook | ✅ | ✅ | ✅ | **Working** |
| Instagram | ✅ | ✅ | ✅ | **Working** |
| Twitter | ⚠️ | ⚠️ | ⚠️ | Mock |
| LinkedIn | ⚠️ | ⚠️ | ⚠️ | Mock |
| TikTok | ⚠️ | ⚠️ | ⚠️ | Mock |
| Pinterest | ⚠️ | ⚠️ | ⚠️ | Mock |

---

## Next Steps

1. **Set up Facebook App** (if not done yet)
2. **Test Facebook/Instagram** connection
3. **Implement real OAuth for Twitter/X, LinkedIn, TikTok**
4. **Add token encryption** for production

---

## Need Help?

Check console logs at https://localhost:3000/ for detailed error messages during OAuth flow.
