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
        
        // Get user info (optional, but good for logging)
        const userResponse = await fetch(GITHUB_USER_URL, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Accept": "application/json",
                "User-Agent": "YoungChai-CMS",
            },
        });
        
        const userData = await userResponse.json();
        
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

