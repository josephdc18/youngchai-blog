// Admin API for managing comments
// GET /api/admin/comments - List all comments

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { env } = context;

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

