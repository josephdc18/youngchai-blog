// Admin API for approving comments
// POST /api/admin/comments/:id/approve - Approve a comment
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
    
    const allowedUsers = env.CMS_ALLOWED_USERS 
      ? env.CMS_ALLOWED_USERS.split(',').map(u => u.trim().toLowerCase())
      : [];
    
    if (allowedUsers.length > 0 && !allowedUsers.includes(username.toLowerCase())) {
      return { error: `User @${username} is not authorized`, status: 403 };
    }
    
    return { user: userData };
    
  } catch (error) {
    return { error: 'Authentication failed', status: 500 };
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { env, params, request } = context;
  const commentId = params.id;

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
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!commentId || isNaN(parseInt(commentId))) {
      return new Response(JSON.stringify({ error: 'Invalid comment ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Approve the comment
    const result = await env.DB.prepare(`
      UPDATE comments SET approved = 1 WHERE id = ?
    `).bind(parseInt(commentId)).run();

    if (result.meta?.changes === 0) {
      return new Response(JSON.stringify({ error: 'Comment not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log(`Comment ${commentId} approved by @${auth.user.login}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Comment approved successfully' 
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error('Error approving comment:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to approve comment',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
