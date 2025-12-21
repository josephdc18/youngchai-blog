// Admin API for individual comment operations
// DELETE /api/admin/comments/:id - Delete a comment

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const commentId = params.id;

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

    // Delete the comment
    const result = await env.DB.prepare(`
      DELETE FROM comments WHERE id = ?
    `).bind(parseInt(commentId)).run();

    if (result.meta?.changes === 0) {
      return new Response(JSON.stringify({ error: 'Comment not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Comment deleted successfully' 
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error('Error deleting comment:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to delete comment',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

