// Cloudflare Pages Function for GitHub OAuth with Decap CMS
// Environment variables GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET should be set in Cloudflare Pages

const GITHUB_OAUTH_URL = 'https://github.com/login/oauth';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response('OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.', { 
      status: 500 
    });
  }

  // Handle /api/auth or /api/auth/auth - redirect to GitHub
  if (action === 'auth' || pathParts.length === 2) {
    const scope = 'repo,user';
    const authUrl = `${GITHUB_OAUTH_URL}/authorize?client_id=${clientId}&scope=${scope}`;
    return Response.redirect(authUrl, 302);
  }

  // Handle /api/auth/callback - exchange code for token
  if (action === 'callback') {
    const code = url.searchParams.get('code');
    
    if (!code) {
      return new Response('Missing code parameter', { status: 400 });
    }

    try {
      const tokenResponse = await fetch(`${GITHUB_OAUTH_URL}/access_token`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        return new Response(`OAuth Error: ${tokenData.error_description || tokenData.error}`, { 
          status: 400 
        });
      }

      // Return HTML that posts the token to Decap CMS
      const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Authenticating...</title>
  </head>
  <body>
    <p>Authenticating with GitHub...</p>
    <script>
      (function() {
        const token = ${JSON.stringify(tokenData.access_token)};
        const provider = "github";
        
        if (window.opener) {
          window.opener.postMessage(
            'authorization:' + provider + ':success:' + JSON.stringify({ token: token, provider: provider }),
            '*'
          );
          setTimeout(function() { window.close(); }, 1000);
        } else {
          document.body.innerHTML = '<p>Authentication successful! You can close this window.</p>';
        }
      })();
    </script>
  </body>
</html>`;

      return new Response(html, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });

    } catch (error) {
      return new Response(`OAuth Error: ${error.message}`, { status: 500 });
    }
  }

  return new Response('Not Found', { status: 404 });
}

