/**
 * Cloudflare Pages Function for GitHub OAuth
 * Used by Decap CMS for authentication
 * 
 * Setup:
 * 1. Create a GitHub OAuth App at https://github.com/settings/developers
 * 2. Set the Authorization callback URL to: https://chailikethetea.com/api/auth
 * 3. Add these environment variables in Cloudflare Pages:
 *    - GITHUB_CLIENT_ID: Your GitHub OAuth App Client ID
 *    - GITHUB_CLIENT_SECRET: Your GitHub OAuth App Client Secret
 *    - CMS_ALLOWED_USERS: Comma-separated list of GitHub usernames (e.g., "josephdc18,wifesusername")
 */

const GITHUB_OAUTH_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    // Handle the initial OAuth redirect (no code = first visit)
    if (!url.searchParams.has("code")) {
        const state = crypto.randomUUID();
        const authUrl = new URL(GITHUB_OAUTH_URL);
        authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
        authUrl.searchParams.set("redirect_uri", `${url.origin}/api/auth`);
        authUrl.searchParams.set("scope", "repo,user");
        authUrl.searchParams.set("state", state);
        
        return Response.redirect(authUrl.toString(), 302);
    }
    
    // Handle the callback with authorization code
    const code = url.searchParams.get("code");
    
    try {
        // Exchange code for access token
        const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                client_id: env.GITHUB_CLIENT_ID,
                client_secret: env.GITHUB_CLIENT_SECRET,
                code: code,
            }),
        });
        
        const tokenData = await tokenResponse.json();
        
        if (tokenData.error) {
            return new Response(`OAuth Error: ${tokenData.error_description}`, { status: 400 });
        }
        
        const accessToken = tokenData.access_token;
        
        // Get user info
        const userResponse = await fetch(GITHUB_USER_URL, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Accept": "application/json",
                "User-Agent": "YoungChai-CMS",
            },
        });
        
        const userData = await userResponse.json();
        const username = userData.login;
        
        // Check if user is in allowlist
        const allowedUsers = env.CMS_ALLOWED_USERS 
            ? env.CMS_ALLOWED_USERS.split(',').map(u => u.trim().toLowerCase())
            : [];
        
        // If allowlist is configured, check if user is allowed
        if (allowedUsers.length > 0 && !allowedUsers.includes(username.toLowerCase())) {
            console.log(`Access denied for user: ${username}`);
            return new Response(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Access Denied</title>
                    <style>
                        body {
                            font-family: system-ui, -apple-system, sans-serif;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            min-height: 100vh;
                            margin: 0;
                            background: #FDFBF7;
                            color: #2C2C2C;
                        }
                        .container {
                            text-align: center;
                            padding: 2rem;
                        }
                        h1 { color: #dc2626; margin-bottom: 1rem; }
                        p { color: #6b7280; margin-bottom: 1.5rem; }
                        .username { 
                            font-weight: bold; 
                            background: #fee2e2; 
                            padding: 0.25rem 0.5rem; 
                            border-radius: 0.25rem;
                        }
                        a {
                            color: #D48C70;
                            text-decoration: none;
                        }
                        a:hover { text-decoration: underline; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>🚫 Access Denied</h1>
                        <p>The GitHub account <span class="username">@${username}</span> is not authorized to access this CMS.</p>
                        <p>Please contact the site administrator if you believe this is an error.</p>
                        <p><a href="/">← Return to homepage</a></p>
                    </div>
                    <script>
                        // Close the popup after a delay
                        setTimeout(() => {
                            if (window.opener) {
                                window.opener.postMessage('authorization:github:error:Access denied', '*');
                                window.close();
                            }
                        }, 5000);
                    </script>
                </body>
                </html>
            `, {
                status: 403,
                headers: { "Content-Type": "text/html" },
            });
        }
        
        console.log(`Access granted for user: ${username}`);
        
        // Return the token to Decap CMS using proper handshake
        const script = `
            <script>
                (function() {
                    function receiveMessage(e) {
                        console.log("receiveMessage %o", e);
                        window.opener.postMessage(
                            'authorization:github:success:${JSON.stringify({
                                token: accessToken,
                                provider: "github",
                            })}',
                            e.origin
                        );
                        window.close();
                    }
                    window.addEventListener("message", receiveMessage, false);
                    window.opener.postMessage("authorizing:github", "*");
                })();
            </script>
        `;
        
        return new Response(script, {
            headers: {
                "Content-Type": "text/html",
            },
        });
    } catch (error) {
        return new Response(`Authentication failed: ${error.message}`, { status: 500 });
    }
}
