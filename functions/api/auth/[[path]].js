// Cloudflare Pages Function for OAuth with Decap CMS
// Supports GitHub OAuth for content editing
// Environment variables needed:
//   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
//   SITE_URL (e.g., https://chailikethetea.com)

const GITHUB_OAUTH_URL = 'https://github.com/login/oauth';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  const siteUrl = env.SITE_URL || url.origin;
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;

  // Debug logging
  console.log('OAuth Request:', { action, pathname: url.pathname, pathParts });

  if (!clientId || !clientSecret) {
    return new Response(`
      <html>
        <body style="font-family: system-ui; padding: 2rem; text-align: center;">
          <h1>OAuth Not Configured</h1>
          <p>Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables in Cloudflare Pages.</p>
          <p>Go to: Settings → Environment Variables</p>
        </body>
      </html>
    `, { 
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Handle /api/auth - redirect to GitHub
  if (action === 'auth') {
    const scope = 'repo,user';
    const redirectUri = `${siteUrl}/api/auth/callback`;
    const authUrl = `${GITHUB_OAUTH_URL}/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    console.log('Redirecting to GitHub:', authUrl);
    return Response.redirect(authUrl, 302);
  }

  // Handle /api/auth/callback - exchange code for token
  if (action === 'callback') {
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');
    
    if (error) {
      return new Response(`
        <html>
          <body style="font-family: system-ui; padding: 2rem; text-align: center;">
            <h1>Authentication Error</h1>
            <p>${errorDescription || error}</p>
            <p><a href="/admin/">Try again</a></p>
          </body>
        </html>
      `, { 
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    if (!code) {
      return new Response(`
        <html>
          <body style="font-family: system-ui; padding: 2rem; text-align: center;">
            <h1>Missing Authorization Code</h1>
            <p>No code was received from GitHub.</p>
            <p><a href="/admin/">Try again</a></p>
          </body>
        </html>
      `, { 
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    try {
      console.log('Exchanging code for token...');
      
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
      console.log('Token response received:', { hasToken: !!tokenData.access_token, error: tokenData.error });

      if (tokenData.error) {
        return new Response(`
          <html>
            <body style="font-family: system-ui; padding: 2rem; text-align: center;">
              <h1>Token Exchange Error</h1>
              <p>${tokenData.error_description || tokenData.error}</p>
              <p><a href="/admin/">Try again</a></p>
            </body>
          </html>
        `, { 
          status: 400,
          headers: { 'Content-Type': 'text/html' }
        });
      }

      const token = tokenData.access_token;

      // Return HTML that communicates with Decap CMS
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
      .spinner {
        width: 24px;
        height: 24px;
        border: 3px solid #e5e7eb;
        border-top: 3px solid #059669;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 1rem auto;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  </head>
  <body>
    <div class="card">
      <p class="success">✓ Authentication successful!</p>
      <div class="spinner"></div>
      <p class="info" id="status">Connecting to CMS...</p>
    </div>
    <script>
      (function() {
        const token = ${JSON.stringify(token)};
        
        function sendMessage() {
          const message = 'authorization:github:success:' + JSON.stringify({
            token: token,
            provider: 'github'
          });
          
          console.log('Attempting to send message to opener...');
          
          // Try to communicate with opener (popup flow)
          if (window.opener) {
            console.log('Found window.opener, posting message');
            window.opener.postMessage(message, '*');
            document.getElementById('status').textContent = 'Redirecting...';
            setTimeout(function() { 
              window.close(); 
            }, 500);
            return true;
          }
          
          // Try parent frame (iframe flow)
          if (window.parent && window.parent !== window) {
            console.log('Found window.parent, posting message');
            window.parent.postMessage(message, '*');
            document.getElementById('status').textContent = 'Redirecting...';
            return true;
          }
          
          return false;
        }
        
        // Try immediately
        if (!sendMessage()) {
          // If no opener/parent, user navigated directly - redirect to admin
          console.log('No opener or parent found, redirecting to /admin/');
          document.getElementById('status').textContent = 'Redirecting to admin...';
          
          // Store token in localStorage for Decap CMS
          try {
            localStorage.setItem('netlify-cms-user', JSON.stringify({
              token: token,
              provider: 'github'
            }));
          } catch(e) {
            console.error('Could not store token:', e);
          }
          
          setTimeout(function() {
            window.location.href = '/admin/';
          }, 1000);
        }
      })();
    </script>
  </body>
</html>`;

      return new Response(html, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });

    } catch (error) {
      console.error('OAuth error:', error);
      return new Response(`
        <html>
          <body style="font-family: system-ui; padding: 2rem; text-align: center;">
            <h1>Authentication Error</h1>
            <p>${error.message}</p>
            <p><a href="/admin/">Try again</a></p>
          </body>
        </html>
      `, { 
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }

  // Default: show a simple auth page or redirect to /admin/
  return Response.redirect(`${siteUrl}/admin/`, 302);
}
