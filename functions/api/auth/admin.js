/**
 * GitHub OAuth for Comments Admin
 * Uses the same allowlist as the CMS
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
        authUrl.searchParams.set("redirect_uri", `${url.origin}/api/auth/admin`);
        authUrl.searchParams.set("scope", "read:user");
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
            const errorMsg = encodeURIComponent(tokenData.error_description || 'OAuth failed');
            return Response.redirect(`${url.origin}/admin/comments/?error=${errorMsg}`, 302);
        }
        
        const accessToken = tokenData.access_token;
        
        // Get user info
        const userResponse = await fetch(GITHUB_USER_URL, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Accept": "application/json",
                "User-Agent": "YoungChai-Admin",
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
            console.log(`Admin access denied for user: ${username}`);
            const errorMsg = encodeURIComponent(`Access denied for @${username}. You are not authorized.`);
            return Response.redirect(`${url.origin}/admin/comments/?error=${errorMsg}`, 302);
        }
        
        console.log(`Admin access granted for user: ${username}`);
        
        // Redirect back to admin with token and user info
        const userInfo = encodeURIComponent(JSON.stringify({
            login: userData.login,
            avatar_url: userData.avatar_url,
            name: userData.name
        }));
        
        return Response.redirect(
            `${url.origin}/admin/comments/?token=${accessToken}&user=${userInfo}`,
            302
        );
        
    } catch (error) {
        console.error('Admin auth error:', error);
        const errorMsg = encodeURIComponent('Authentication failed: ' + error.message);
        return Response.redirect(`${url.origin}/admin/comments/?error=${errorMsg}`, 302);
    }
}

