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

## 2. Comments Admin Protection (GitHub OAuth)

The `/admin/comments/` page is protected using the **same GitHub allowlist** as the CMS.

### How It Works

1. User visits `/admin/comments/`
2. They see a "Sign in with GitHub" button
3. After GitHub login, their username is checked against `CMS_ALLOWED_USERS`
4. If not on the list → "Access Denied"
5. If authorized → they can manage comments

### Setup

**No additional setup required!** The comments admin uses the same `CMS_ALLOWED_USERS` environment variable as the CMS.

Just make sure you've added it:
1. Go to **Cloudflare Dashboard** → **Pages** → **Settings** → **Environment Variables**
2. Set `CMS_ALLOWED_USERS` = `josephdc18,wifesusername`

### Security Features

- ✅ GitHub OAuth authentication
- ✅ Allowlist-based access control
- ✅ Token stored in browser localStorage (session persists)
- ✅ All admin API endpoints require valid token
- ✅ Token is verified against GitHub API on each request

### Testing

1. Open an incognito window
2. Go to `https://chailikethetea.com/admin/comments/`
3. Click "Sign in with GitHub"
4. After authentication, you should see the comments dashboard
5. Try with a non-allowed GitHub account → should see "Access Denied"

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

