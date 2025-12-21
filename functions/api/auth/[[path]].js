// Cloudflare Pages Function for OAuth with Decap CMS
// Supports GitHub and Google OAuth
// Environment variables needed:
//   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (optional)
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
  
  // Get credentials
  const githubClientId = env.GITHUB_CLIENT_ID;
  const githubClientSecret = env.GITHUB_CLIENT_SECRET;
  const googleClientId = env.GOOGLE_CLIENT_ID;
  const googleClientSecret = env.GOOGLE_CLIENT_SECRET;

  // Get provider from query param or path
  const provider = url.searchParams.get('provider') || 'github';

  // Handle /api/auth - show provider selection or redirect
  if (action === 'auth' && !url.searchParams.get('provider')) {
    // If both providers are configured, show selection page
    if (githubClientId && googleClientId) {
      return createProviderSelectionPage(siteUrl);
    }
    // If only GitHub, redirect directly
    if (githubClientId) {
      const redirectUri = `${siteUrl}/api/auth/callback`;
      const authUrl = `${GITHUB_OAUTH_URL}/authorize?client_id=${githubClientId}&scope=repo,user&redirect_uri=${encodeURIComponent(redirectUri)}`;
      return Response.redirect(authUrl, 302);
    }
    return new Response('No OAuth providers configured', { status: 500 });
  }

  // Handle /api/auth?provider=github
  if (action === 'auth' && provider === 'github') {
    if (!githubClientId || !githubClientSecret) {
      return new Response('GitHub OAuth not configured', { status: 500 });
    }
    const redirectUri = `${siteUrl}/api/auth/callback`;
    const authUrl = `${GITHUB_OAUTH_URL}/authorize?client_id=${githubClientId}&scope=repo,user&redirect_uri=${encodeURIComponent(redirectUri)}&state=github`;
    return Response.redirect(authUrl, 302);
  }

  // Handle /api/auth?provider=google
  if (action === 'auth' && provider === 'google') {
    if (!googleClientId || !googleClientSecret) {
      return new Response('Google OAuth not configured', { status: 500 });
    }
    const redirectUri = `${siteUrl}/api/auth/callback`;
    const authUrl = `${GOOGLE_OAUTH_URL}/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent('openid email profile')}&state=google&access_type=offline`;
    return Response.redirect(authUrl, 302);
  }

  // Handle /api/auth/callback
  if (action === 'callback') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state') || 'github'; // Default to github
    const error = url.searchParams.get('error');
    
    if (error) {
      const errorDesc = url.searchParams.get('error_description') || error;
      return createErrorPage('Authentication Error', errorDesc);
    }
    
    if (!code) {
      return createErrorPage('Missing Code', 'No authorization code was received.');
    }

    try {
      let token;
      let authProvider = state;

      if (state === 'google') {
        // Exchange Google code for token
        if (!googleClientId || !googleClientSecret) {
          return createErrorPage('Config Error', 'Google OAuth not configured');
        }
        
        const redirectUri = `${siteUrl}/api/auth/callback`;
        const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            code: code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });

        const tokenData = await tokenResponse.json();
        if (tokenData.error) {
          return createErrorPage('Token Error', tokenData.error_description || tokenData.error);
        }
        token = tokenData.access_token;
        authProvider = 'google';
        
      } else {
        // Exchange GitHub code for token (default)
        if (!githubClientId || !githubClientSecret) {
          return createErrorPage('Config Error', 'GitHub OAuth not configured');
        }

        const tokenResponse = await fetch(`${GITHUB_OAUTH_URL}/access_token`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: githubClientId,
            client_secret: githubClientSecret,
            code: code,
          }),
        });

        const tokenData = await tokenResponse.json();
        if (tokenData.error) {
          return createErrorPage('Token Error', tokenData.error_description || tokenData.error);
        }
        token = tokenData.access_token;
        authProvider = 'github';
      }

      // Return success page that handles both popup and redirect flows
      return createSuccessPage(token, authProvider);

    } catch (error) {
      return createErrorPage('Error', error.message);
    }
  }

  // Default: redirect to /admin/
  return Response.redirect(`${siteUrl}/admin/`, 302);
}

function createProviderSelectionPage(siteUrl) {
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
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      }
      .card { 
        background: white; 
        padding: 2.5rem; 
        border-radius: 16px; 
        box-shadow: 0 10px 40px rgba(0,0,0,0.3); 
        text-align: center;
        max-width: 380px;
        width: 90%;
      }
      h1 { margin: 0 0 0.5rem; color: #1f2937; font-size: 1.5rem; }
      p { color: #6b7280; margin: 0 0 2rem; font-size: 0.875rem; }
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
      .note { font-size: 0.75rem; color: #9ca3af; margin-top: 1.5rem; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Content Manager</h1>
      <p>Choose how you'd like to sign in</p>
      
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
      
      <p class="note">Note: GitHub is required to edit and publish content.</p>
    </div>
  </body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}

function createSuccessPage(token, provider) {
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Success!</title>
    <style>
      body { 
        font-family: system-ui, -apple-system, sans-serif; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        min-height: 100vh; 
        margin: 0; 
        background: #f9fafb; 
      }
      .card { 
        background: white; 
        padding: 2rem 3rem; 
        border-radius: 12px; 
        box-shadow: 0 4px 20px rgba(0,0,0,0.1); 
        text-align: center; 
      }
      .success { color: #059669; font-size: 1.25rem; margin-bottom: 0.5rem; }
      .info { color: #6b7280; font-size: 0.875rem; }
    </style>
  </head>
  <body>
    <div class="card">
      <p class="success">✓ Authentication successful!</p>
      <p class="info" id="status">Connecting to CMS...</p>
    </div>
    <script>
      (function() {
        var token = ${JSON.stringify(token)};
        var provider = ${JSON.stringify(provider)};
        
        var messageContent = JSON.stringify({ token: token, provider: provider });
        var message = 'authorization:' + provider + ':success:' + messageContent;
        
        // Try popup flow first
        if (window.opener) {
          window.opener.postMessage(message, '*');
          document.getElementById('status').textContent = 'Redirecting...';
          setTimeout(function() { window.close(); }, 500);
          return;
        }
        
        // Redirect flow: store token and redirect
        try {
          localStorage.setItem('netlify-cms-user', JSON.stringify({ token: token, provider: provider }));
          localStorage.setItem('decap-cms-user', JSON.stringify({ token: token, provider: provider }));
          document.getElementById('status').textContent = 'Redirecting to CMS...';
          setTimeout(function() { window.location.replace('/admin/'); }, 300);
        } catch(e) {
          document.getElementById('status').textContent = 'Error: ' + e.message;
        }
      })();
    </script>
  </body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}

function createErrorPage(title, message) {
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Error</title>
    <style>
      body { font-family: system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fef2f2; }
      .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
      h1 { color: #dc2626; font-size: 1.25rem; margin: 0 0 1rem; }
      p { color: #6b7280; margin: 0 0 1.5rem; }
      a { color: #2563eb; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${title}</h1>
      <p>${message}</p>
      <p><a href="/admin/">← Back to CMS</a></p>
    </div>
  </body>
</html>`;

  return new Response(html, { status: 400, headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}
