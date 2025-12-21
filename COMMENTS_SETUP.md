# Comments System Setup Guide

This guide explains how to set up the Cloudflare D1-powered comments system for your blog.

## Overview

The comments system uses:
- **Cloudflare D1** - SQLite database for storing comments
- **Cloudflare Pages Functions** - API endpoints for reading/writing comments
- **Cloudflare Turnstile** - CAPTCHA alternative for spam protection
- **Custom UI** - Beautiful inline comment forms with sticky bar

## Setup Instructions

### Step 1: Install Wrangler CLI

If you haven't already, install the Wrangler CLI:

```bash
npm install -g wrangler
```

### Step 2: Login to Cloudflare

```bash
wrangler login
```

This will open a browser window to authenticate with your Cloudflare account.

### Step 3: Create the D1 Database

Create a new D1 database for your comments:

```bash
wrangler d1 create youngchai-comments
```

This will output something like:

```
✅ Successfully created DB 'youngchai-comments'

[[d1_databases]]
binding = "DB"
database_name = "youngchai-comments"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Copy the `database_id` value** - you'll need it in the next step.

### Step 4: Update wrangler.toml

Open `wrangler.toml` and replace `YOUR_DATABASE_ID_HERE` with the actual database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "youngchai-comments"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # Your actual ID
```

### Step 5: Create the Database Schema

Run the schema file to create the comments table:

```bash
wrangler d1 execute youngchai-comments --file=./db/schema.sql
```

For production, add the `--remote` flag:

```bash
wrangler d1 execute youngchai-comments --remote --file=./db/schema.sql
```

### Step 6: Configure Cloudflare Pages

In your Cloudflare Pages dashboard:

1. Go to your project **Settings** → **Functions** → **D1 database bindings**
2. Add a binding:
   - **Variable name**: `DB`
   - **D1 database**: Select `youngchai-comments`
3. Save the configuration

### Step 7: Set Up Cloudflare Turnstile (Spam Protection)

Turnstile is Cloudflare's free, privacy-friendly CAPTCHA alternative.

1. Go to **Cloudflare Dashboard** → **Turnstile**
2. Click **Add Site**
3. Configure:
   - **Site Name**: Young Chai Blog
   - **Domains**: `chailikethetea.com` (your domain)
   - **Widget Mode**: **Managed** (invisible for most users)
4. Click **Create**
5. Copy the **Site Key** and **Secret Key**

#### Add Keys to Your Project

**Site Key** (public - goes in client.json):
```json
{
  "turnstileSiteKey": "0x4AAAAAAAxxxxxxxxxxxxxxxxx"
}
```

**Secret Key** (private - goes in Cloudflare Pages environment variables):
1. Go to **Pages** → Your project → **Settings** → **Environment Variables**
2. Add a new variable:
   - **Variable name**: `TURNSTILE_SECRET_KEY`
   - **Value**: Your secret key (starts with `0x...`)
3. Save

### Step 8: Deploy

Deploy your site to Cloudflare Pages:

```bash
npm run build
wrangler pages deploy public
```

Or push to your GitHub repository if you have automatic deployments set up.

---

## Spam Protection

The system includes multiple layers of spam protection:

### 1. Cloudflare Turnstile
Invisible CAPTCHA that challenges suspicious users. Most legitimate users won't see it.

### 2. Honeypot Field
A hidden form field that bots fill out but humans can't see. If filled, the comment is silently rejected.

### 3. Rate Limiting
Prevents spam floods by limiting to 3 comments per minute per IP.

### 4. Input Sanitization
All inputs are sanitized to prevent XSS attacks.

---

## Admin Panel

Access the comments admin panel at: **`/admin/comments/`**

Features:
- 📊 View stats (total, approved, pending, today)
- ✅ Approve pending comments
- 🗑️ Delete spam or unwanted comments
- 🔍 Filter by status

---

## API Endpoints

### Public API

#### GET `/api/comments?post=<slug>`

Retrieves all approved comments for a specific post.

**Response:**
```json
{
  "comments": [
    {
      "id": 1,
      "post_slug": "finding-stillness",
      "parent_id": null,
      "name": "Jane Doe",
      "content": "Great article!",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

#### POST `/api/comments`

Creates a new comment.

**Request body:**
```json
{
  "post": "finding-stillness",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "content": "Great article!",
  "parent_id": null,
  "turnstile_token": "xxxxx"
}
```

### Admin API

> Note: These endpoints should be protected in production. Consider adding authentication.

#### GET `/api/admin/comments`
Lists all comments (including pending).

#### POST `/api/admin/comments/:id/approve`
Approves a pending comment.

#### DELETE `/api/admin/comments/:id`
Deletes a comment.

---

## CLI Moderation

You can also moderate comments via Wrangler CLI:

### View all comments
```bash
wrangler d1 execute youngchai-comments --remote --command="SELECT * FROM comments ORDER BY created_at DESC LIMIT 50"
```

### Approve a pending comment
```bash
wrangler d1 execute youngchai-comments --remote --command="UPDATE comments SET approved = 1 WHERE id = <comment_id>"
```

### Delete a comment
```bash
wrangler d1 execute youngchai-comments --remote --command="DELETE FROM comments WHERE id = <comment_id>"
```

### View spam attempts (pending comments)
```bash
wrangler d1 execute youngchai-comments --remote --command="SELECT * FROM comments WHERE approved = 0 ORDER BY created_at DESC"
```

---

## Customization

### Change auto-approval behavior

By default, comments are auto-approved. To require manual approval, edit `functions/api/comments.js`:

```javascript
// Change this line in the INSERT statement:
// From: approved: 1
// To: approved: 0 (requires manual approval)
```

### Styling

Comment styles are in `src/css/blog.css` under the "Comments Section" heading. Key CSS variables:

```css
:root {
  --comment-accent: #D48C70;     /* Accent color */
  --comment-bg: #FDFBF7;         /* Background */
  --comment-border: #e5e7eb;     /* Border color */
  --comment-text: #2C2C2C;       /* Text color */
  --comment-gray: #6b7280;       /* Secondary text */
}
```

---

## Troubleshooting

### "Database not configured" error

Make sure you've:
1. Created the D1 database with `wrangler d1 create`
2. Updated `wrangler.toml` with the correct database ID
3. Added the D1 binding in Cloudflare Pages dashboard

### "Verification failed" error

Check that:
1. Turnstile Site Key is in `src/_data/client.json`
2. Turnstile Secret Key is in Cloudflare Pages environment variables
3. Your domain is added to the Turnstile widget

### Comments not appearing

Check that:
1. The database schema was created
2. The post slug matches exactly (case-sensitive)
3. Comments are approved (`approved = 1`)

### Rate limit errors

Wait 1 minute before posting more comments, or adjust the rate limit in `functions/api/comments.js`.
