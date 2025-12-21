// Admin API for managing comments
// GET /api/admin/comments - List all comments
// Requires GitHub token in Authorization header

const GITHUB_USER_URL = "https://api.github.com/user";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Verify GitHub token and check allowlist
async function verifyAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header', status: 401 };
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Verify token by fetching user info from GitHub
    const userResponse = await fetch(GITHUB_USER_URL, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "User-Agent": "YoungChai-Admin",
      },
    });
    
    if (!userResponse.ok) {
      return { error: 'Invalid or expired token', status: 401 };
    }
    
    const userData = await userResponse.json();
    const username = userData.login;
    
    // Check allowlist
    const allowedUsers = env.CMS_ALLOWED_USERS 
      ? env.CMS_ALLOWED_USERS.split(',').map(u => u.trim().toLowerCase())
      : [];
    
    if (allowedUsers.length > 0 && !allowedUsers.includes(username.toLowerCase())) {
      return { error: `User @${username} is not authorized`, status: 403 };
    }
    
    return { user: userData };
    
  } catch (error) {
    console.error('Auth verification error:', error);
    return { error: 'Authentication failed', status: 500 };
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { env, request } = context;

  // Verify authentication
  const auth = await verifyAuth(request, env);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    if (!env.DB) {
      return new Response(JSON.stringify({ 
        error: 'Database not configured',
        comments: [] 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get all comments (including pending ones for admin)
    const { results } = await env.DB.prepare(`
      SELECT id, post_slug, parent_id, name, email, content, created_at, approved, ip_hash
      FROM comments
      ORDER BY created_at DESC
      LIMIT 500
    `).all();

    return new Response(JSON.stringify({ 
      success: true,
      comments: results || [] 
    }), {
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
