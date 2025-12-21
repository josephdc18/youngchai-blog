// Cloudflare Pages Function for OAuth with Decap CMS
// Supports both GitHub and Google OAuth
// Environment variables needed:
//   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET (for GitHub)
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (for Google)
//   SITE_URL (e.g., https://chailikethetea.com)

const GITHUB_OAUTH_URL = 'https://github.com/login/oauth';
const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  const siteUrl = env.SITE_URL || url.origin;

  // Check for provider parameter
  const provider = url.searchParams.get('provider') || 'github';

  // ========== GITHUB OAUTH ==========
  if (provider === 'github') {
    const clientId = env.GITHUB_CLIENT_ID;
    const clientSecret = env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return new Response('GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.', { 
        status: 500 
      });
    }

    // Handle /api/auth or /api/auth/auth - redirect to GitHub
    if (action === 'auth' || (pathParts.length === 2 && action !== 'callback')) {
      const scope = 'repo,user';
      const redirectUri = `${siteUrl}/api/auth/callback?provider=github`;
      const authUrl = `${GITHUB_OAUTH_URL}/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}`;
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
        return createSuccessResponse(tokenData.access_token, 'github');

      } catch (error) {
        return new Response(`OAuth Error: ${error.message}`, { status: 500 });
      }
    }
  }

  // ========== GOOGLE OAUTH ==========
  if (provider === 'google') {
    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return new Response('Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.', { 
        status: 500 
      });
    }

    // Handle /api/auth?provider=google - redirect to Google
    if (action === 'auth' || (pathParts.length === 2 && action !== 'callback')) {
      const scope = 'openid email profile';
      const redirectUri = `${siteUrl}/api/auth/callback?provider=google`;
      const authUrl = `${GOOGLE_OAUTH_URL}/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
      return Response.redirect(authUrl, 302);
    }

    // Handle callback
    if (action === 'callback') {
      const code = url.searchParams.get('code');
      
      if (!code) {
        return new Response('Missing code parameter', { status: 400 });
      }

      try {
        const redirectUri = `${siteUrl}/api/auth/callback?provider=google`;
        
        const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
          return new Response(`OAuth Error: ${tokenData.error_description || tokenData.error}`, { 
            status: 400 
          });
        }

        // Get user info to verify authentication
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
          },
        });
        const userData = await userResponse.json();

        // Note: For Decap CMS with GitHub backend, we still need GitHub access
        // This Google auth can be used for user identification, but you'll need
        // to also configure GitHub OAuth or use git-gateway backend
        
        // For now, we return the Google token - you may need to map this to GitHub
        return createSuccessResponse(tokenData.access_token, 'google', userData.email);

      } catch (error) {
        return new Response(`OAuth Error: ${error.message}`, { status: 500 });
      }
    }
  }

  // Default: redirect to auth selection page
  if (action === 'auth' || pathParts.length === 2) {
    return createAuthSelectionPage(siteUrl);
  }

  return new Response('Not Found', { status: 404 });
}

function createSuccessResponse(token, provider, email = '') {
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Authenticating...</title>
    <style>
      body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
      .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
      .success { color: #059669; }
    </style>
  </head>
  <body>
    <div class="card">
      <p class="success">✓ Authentication successful!</p>
      <p>Connecting to CMS...</p>
    </div>
    <script>
      (function() {
        const token = ${JSON.stringify(token)};
        const provider = ${JSON.stringify(provider)};
        
        if (window.opener) {
          window.opener.postMessage(
            'authorization:' + provider + ':success:' + JSON.stringify({ token: token, provider: provider }),
            '*'
          );
          setTimeout(function() { window.close(); }, 1000);
        } else {
          document.querySelector('.card').innerHTML = '<p class="success">✓ Authentication successful!</p><p>You can close this window.</p>';
        }
      })();
    </script>
  </body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}

function createAuthSelectionPage(siteUrl) {
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Login to CMS</title>
    <style>
      * { box-sizing: border-box; }
      body { 
        font-family: system-ui, -apple-system, sans-serif; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        min-height: 100vh; 
        margin: 0; 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
      .card { 
        background: white; 
        padding: 2.5rem; 
        border-radius: 16px; 
        box-shadow: 0 10px 40px rgba(0,0,0,0.2); 
        text-align: center;
        max-width: 400px;
        width: 90%;
      }
      h1 { margin: 0 0 0.5rem; color: #1f2937; font-size: 1.5rem; }
      p { color: #6b7280; margin: 0 0 2rem; }
      .btn { 
        display: flex; 
        align-items: center; 
        justify-content: center;
        gap: 0.75rem;
        width: 100%; 
        padding: 0.875rem 1.5rem; 
        border: none; 
        border-radius: 8px; 
        font-size: 1rem; 
        font-weight: 500;
        cursor: pointer; 
        text-decoration: none;
        transition: transform 0.2s, box-shadow 0.2s;
        margin-bottom: 1rem;
      }
      .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
      .btn-github { background: #24292e; color: white; }
      .btn-google { background: white; color: #1f2937; border: 1px solid #e5e7eb; }
      .icon { width: 20px; height: 20px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Welcome Back</h1>
      <p>Sign in to access the Content Manager</p>
      
      <a href="${siteUrl}/api/auth?provider=github" class="btn btn-github">
        <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
        </svg>
        Continue with GitHub
      </a>
      
      <a href="${siteUrl}/api/auth?provider=google" class="btn btn-google">
        <svg class="icon" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </a>
      
      <p style="font-size: 0.75rem; color: #9ca3af; margin-top: 1.5rem;">
        Note: GitHub login is required to edit content.
      </p>
    </div>
  </body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}
