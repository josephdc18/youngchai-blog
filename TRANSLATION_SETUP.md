# CMS Auto-Translation Setup

This blog includes an auto-translation feature powered by OpenAI GPT-4o-mini that lets you translate content between English and Korean directly in the Decap CMS.

## Features

- **Translate All Button**: Floating button in the CMS editor to translate all fields at once
- **Per-Field Translation**: Individual translate buttons on title, description, and body fields
- **Smart Translation**: Uses GPT-4o-mini for high-quality, context-aware translations
- **Clipboard Integration**: Translations are copied to clipboard for easy pasting into the other language tab
- **Markdown Preservation**: Maintains all formatting (headers, bold, links, etc.)

## Setup Instructions

### 1. Get an OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to **API Keys** in the left sidebar
4. Click **Create new secret key**
5. Copy the key (starts with `sk-...`)

### 2. Add the API Key to Cloudflare

1. Go to your [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your **Pages** project (youngchai-blog or similar)
3. Go to **Settings** → **Environment variables**
4. Click **Add variable**
5. Add:
   - **Variable name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (sk-...)
   - **Environment**: Production (and Preview if desired)
6. Click **Save**

### 3. Redeploy

After adding the environment variable, trigger a new deployment:
- Push a new commit, OR
- Go to Cloudflare Pages → **Deployments** → **Retry deployment**

## Usage

### In the CMS Editor

1. Open a blog post for editing
2. You'll see:
   - **Translate buttons** next to translatable fields (title, description, body)
   - **"Translate All" button** in the bottom-right corner

3. Click a translate button to translate that specific field
4. The translation is copied to your clipboard
5. Switch to the other language tab (Korean/English) and paste

### Translation Workflow

**English → Korean:**
1. Write your post in English
2. Click "Translate All to 한국어"
3. Switch to the Korean tab
4. Paste translations into the corresponding fields

**Korean → English:**
1. Write your post in Korean
2. Click "Translate All to English"
3. Switch to the English tab
4. Paste translations into the corresponding fields

## Cost Estimate

GPT-4o-mini is very affordable:
- ~$0.15 per 1 million input tokens
- ~$0.60 per 1 million output tokens

For a typical 1,000 word blog post:
- Input: ~1,500 tokens
- Output: ~2,000 tokens (Korean is longer)
- **Cost: ~$0.001 (less than 1 cent)**

You can translate ~1,000 blog posts for about $1.

## Troubleshooting

### "OpenAI API key not configured"
- Make sure you added `OPENAI_API_KEY` to Cloudflare environment variables
- Redeploy after adding the variable

### "Translation failed"
- Check browser console for detailed errors
- Verify your OpenAI API key is valid and has credits
- Ensure you haven't exceeded rate limits

### Buttons not appearing
- Wait a few seconds for the CMS to fully load
- Refresh the page
- Check browser console for JavaScript errors

## API Endpoint

The translation API is available at:
```
POST /api/translate
```

Request body:
```json
{
  "text": "Hello, world!",
  "targetLang": "ko",
  "fieldType": "body"  // optional: "title", "description", or "body"
}
```

Response:
```json
{
  "translation": "안녕하세요!",
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 10,
    "total_tokens": 60
  }
}
```

