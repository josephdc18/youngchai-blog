# Security Setup Guide

This guide covers security configuration for the Young Chai Blog.

---

## 1. CMS Access Control (GitHub Allowlist)

The CMS now includes an allowlist to restrict who can log in.

### Setup

1. Go to **Cloudflare Dashboard** → **Pages** → Your project → **Settings** → **Environment Variables**

2. Add a new variable:
   - **Variable name**: `CMS_ALLOWED_USERS`
   - **Value**: Comma-separated GitHub usernames (e.g., `josephdc18,wifesusername`)

3. **Save** and trigger a new deployment

### How It Works

- When someone logs in via GitHub OAuth, their username is checked against the allowlist
- If not on the list, they see an "Access Denied" page
- If the `CMS_ALLOWED_USERS` variable is not set, **anyone can log in** (for initial setup)

### Example Values

```
# Single user
josephdc18

# Multiple users
josephdc18,wifesusername,editorname
```

---

## 2. Comments Admin Protection (Cloudflare Access)

The `/admin/comments/` page should be protected with Cloudflare Access.

### Setup Steps

1. **Go to Cloudflare Dashboard**
   - Navigate to **Zero Trust** (in the left sidebar)
   - If prompted, set up your Zero Trust organization (free for up to 50 users)

2. **Create an Access Application**
   - Go to **Access** → **Applications**
   - Click **Add an application**
   - Choose **Self-hosted**

3. **Configure the Application**
   - **Application name**: `Young Chai Comments Admin`
   - **Session Duration**: 24 hours (or your preference)
   - **Application domain**: 
     - **Subdomain**: `chailikethetea` (or leave blank)
     - **Domain**: `chailikethetea.com`
     - **Path**: `/admin/comments/`

4. **Add a Second Path for the API**
   - Click **Add another application**
   - Add path: `/api/admin/`
   - This protects the admin API endpoints too

5. **Create Access Policy**
   - **Policy name**: `Allowed Editors`
   - **Action**: Allow
   - **Include**: Choose one of:
     - **Emails**: Add specific email addresses
     - **Emails ending in**: Your domain (e.g., `@youngchai.com`)
     - **GitHub organization**: If you have one
     - **Everyone**: (Not recommended for admin pages)

6. **Authentication Methods**
   - Enable **One-time PIN** (easiest - sends code to email)
   - Optionally enable **GitHub** or **Google**

7. **Save and Deploy**

### What This Does

- Anyone visiting `/admin/comments/` sees a Cloudflare login screen
- Only users matching your policy can access the page
- The admin API (`/api/admin/comments`) is also protected
- All authentication is handled by Cloudflare (enterprise-grade security)

### Testing

1. Open an incognito window
2. Go to `https://chailikethetea.com/admin/comments/`
3. You should see the Cloudflare Access login page
4. Enter your email and check for the one-time PIN
5. After authentication, you'll see the comments admin

---

## 3. Environment Variables Summary

| Variable | Purpose | Example |
|----------|---------|---------|
| `GITHUB_CLIENT_ID` | GitHub OAuth App ID | `Iv1.abc123...` |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Secret | `abc123...` |
| `CMS_ALLOWED_USERS` | Comma-separated GitHub usernames for CMS | `josephdc18,wife` |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret for spam protection | `0x4AAA...` |

---

## 4. Security Checklist

- [ ] Set `CMS_ALLOWED_USERS` environment variable
- [ ] Configure Cloudflare Access for `/admin/comments/`
- [ ] Configure Cloudflare Access for `/api/admin/`
- [ ] Test CMS login with an unauthorized account (should be denied)
- [ ] Test comments admin access in incognito (should require auth)
- [ ] Verify Turnstile is working on comment forms

---

## Troubleshooting

### "Access Denied" when logging into CMS
- Check that your GitHub username is in `CMS_ALLOWED_USERS`
- Usernames are case-insensitive
- Make sure there are no extra spaces in the variable

### Cloudflare Access not showing
- Make sure you've configured the correct path (`/admin/comments/`)
- Check that the application is enabled
- Clear your browser cache or try incognito

### Can't access comments admin API
- Make sure `/api/admin/` path is also protected by Cloudflare Access
- The API and UI need separate path rules

