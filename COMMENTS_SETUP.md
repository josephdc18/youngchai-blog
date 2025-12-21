# Comments System Setup Guide

This guide explains how to set up the Cloudflare D1-powered comments system for your blog.

## Overview

The comments system uses:
- **Cloudflare D1** - SQLite database for storing comments
- **Cloudflare Pages Functions** - API endpoints for reading/writing comments
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

### Step 7: Deploy

Deploy your site to Cloudflare Pages:

```bash
npm run build
wrangler pages deploy public
```

Or push to your GitHub repository if you have automatic deployments set up.

## How It Works

### API Endpoints

The comments API is available at `/api/comments`:

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
  "email": "jane@example.com",  // Optional
  "content": "Great article!",
  "parent_id": null  // Optional, for replies
}
```

**Response:**
```json
{
  "success": true,
  "message": "Comment posted successfully",
  "commentId": 1
}
```

### Features

- ✅ **Guest comments** - Anyone can comment without logging in
- ✅ **Threaded replies** - Reply to specific comments
- ✅ **Rate limiting** - Prevents spam (3 comments per minute per IP)
- ✅ **XSS protection** - All inputs are sanitized
- ✅ **Privacy-conscious** - IPs are hashed, not stored raw
- ✅ **Sticky comment bar** - Appears while scrolling

## Moderation

To moderate comments, you can query the D1 database directly:

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

## Customization

### Change auto-approval behavior

By default, comments are auto-approved (`approved = 1`). To require manual approval, edit `functions/api/comments.js`:

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

## Troubleshooting

### "Database not configured" error

Make sure you've:
1. Created the D1 database with `wrangler d1 create`
2. Updated `wrangler.toml` with the correct database ID
3. Added the D1 binding in Cloudflare Pages dashboard

### Comments not appearing

Check that:
1. The database schema was created (`wrangler d1 execute ... --file=./db/schema.sql`)
2. The post slug matches exactly (case-sensitive)
3. Comments are approved (`approved = 1`)

### Rate limit errors

Wait 1 minute before posting more comments, or adjust the rate limit in `functions/api/comments.js`.

