// Cloudflare Pages Function for Blog Comments API
// Uses Cloudflare D1 for storage
// Environment variable: DB (D1 database binding)

// Simple hash function for IP addresses (privacy)
function hashIP(ip) {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

// Sanitize input to prevent XSS
function sanitizeInput(str) {
  if (!str) return '';
  return str
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Validate email format (basic)
function isValidEmail(email) {
  if (!email) return true; // Email is optional
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle OPTIONS request for CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: corsHeaders,
  });
}

// GET /api/comments?post=<slug> - Get comments for a post
export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const postSlug = url.searchParams.get('post');

  if (!postSlug) {
    return new Response(JSON.stringify({ error: 'Missing post parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    // Check if D1 binding exists
    if (!env.DB) {
      // Return empty comments if DB not configured yet
      return new Response(JSON.stringify({ 
        comments: [],
        message: 'Database not configured. Comments will appear once D1 is set up.'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get all approved comments for this post
    const { results } = await env.DB.prepare(`
      SELECT id, post_slug, parent_id, name, content, created_at
      FROM comments
      WHERE post_slug = ? AND approved = 1
      ORDER BY created_at ASC
    `).bind(postSlug).all();

    return new Response(JSON.stringify({ comments: results || [] }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch comments',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

// POST /api/comments - Create a new comment
export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const body = await request.json();
    const { post, name, email, content, parent_id } = body;

    // Validation
    if (!post || !name || !content) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: post, name, and content are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (name.length > 100) {
      return new Response(JSON.stringify({ error: 'Name too long (max 100 characters)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (content.length > 5000) {
      return new Response(JSON.stringify({ error: 'Comment too long (max 5000 characters)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (email && !isValidEmail(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Check if D1 binding exists
    if (!env.DB) {
      return new Response(JSON.stringify({ 
        error: 'Database not configured',
        message: 'The comment system is not yet set up. Please configure D1 database.'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Sanitize inputs
    const sanitizedName = sanitizeInput(name);
    const sanitizedContent = sanitizeInput(content);
    const sanitizedEmail = email ? sanitizeInput(email) : null;
    const sanitizedPost = sanitizeInput(post);

    // Get IP hash for spam prevention
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const ipHash = hashIP(clientIP);

    // Simple rate limiting: check for recent comments from same IP
    const recentComments = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM comments 
      WHERE ip_hash = ? AND created_at > datetime('now', '-1 minute')
    `).bind(ipHash).first();

    if (recentComments && recentComments.count >= 3) {
      return new Response(JSON.stringify({ 
        error: 'Too many comments. Please wait a moment before posting again.' 
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // If parent_id is provided, verify it exists
    if (parent_id) {
      const parentComment = await env.DB.prepare(`
        SELECT id FROM comments WHERE id = ? AND post_slug = ?
      `).bind(parent_id, sanitizedPost).first();

      if (!parentComment) {
        return new Response(JSON.stringify({ error: 'Parent comment not found' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // Insert the comment (auto-approved for now)
    const result = await env.DB.prepare(`
      INSERT INTO comments (post_slug, parent_id, name, email, content, ip_hash, approved)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).bind(
      sanitizedPost,
      parent_id || null,
      sanitizedName,
      sanitizedEmail,
      sanitizedContent,
      ipHash
    ).run();

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Comment posted successfully',
      commentId: result.meta?.last_row_id
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error('Error posting comment:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to post comment',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

