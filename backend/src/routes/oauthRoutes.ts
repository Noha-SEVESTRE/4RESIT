import { Router } from "express";
import { randomBytes } from "crypto";
import { pool } from "../database/pool";
import { createToken } from "../utils/token";

export const oauthRouter = Router();

type GitHubUser = {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
};

type GitHubEmail = {
    email: string;
    primary: boolean;
    verified: boolean;
};

type GoogleTokenResponse = {
    access_token?: string;
    error?: string;
    error_description?: string;
};

type GoogleUser = {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    picture?: string;
};

function getRequiredEnv(name: string) {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Variable d'environnement manquante : ${name}`);
    }

    return value;
}

function buildFrontendRedirect(path: string) {
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:8081";

    return `${frontendUrl}${path}`;
}

async function getGitHubAccessToken(code: string) {
    const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            client_id: getRequiredEnv("GITHUB_CLIENT_ID"),
            client_secret: getRequiredEnv("GITHUB_CLIENT_SECRET"),
            code
        })
    });

    const data = await response.json() as {
        access_token?: string;
        error?: string;
        error_description?: string;
    };

    if (!response.ok || !data.access_token) {
        throw new Error(data.error_description ?? data.error ?? "Connexion GitHub impossible");
    }

    return data.access_token;
}

async function getGitHubUser(accessToken: string) {
    const response = await fetch("https://api.github.com/user", {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json"
        }
    });

    if (!response.ok) {
        throw new Error("Impossible de récupérer le profil GitHub");
    }

    return response.json() as Promise<GitHubUser>;
}

async function getGitHubPrimaryEmail(accessToken: string) {
    const response = await fetch("https://api.github.com/user/emails", {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json"
        }
    });

    if (!response.ok) {
        throw new Error("Impossible de récupérer l'adresse email GitHub");
    }

    const emails = await response.json() as GitHubEmail[];
    const primaryEmail = emails.find((email) => email.primary && email.verified);
    const verifiedEmail = emails.find((email) => email.verified);

    return primaryEmail?.email ?? verifiedEmail?.email ?? null;
}

async function getGoogleAccessToken(code: string) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            client_id: getRequiredEnv("GOOGLE_CLIENT_ID"),
            client_secret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
            code,
            grant_type: "authorization_code",
            redirect_uri: getRequiredEnv("GOOGLE_CALLBACK_URL")
        })
    });

    const data = await response.json() as GoogleTokenResponse;

    if (!response.ok || !data.access_token) {
        throw new Error(data.error_description ?? data.error ?? "Connexion Google impossible");
    }

    return data.access_token;
}

async function getGoogleUser(accessToken: string) {
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error("Impossible de récupérer le profil Google");
    }

    return response.json() as Promise<GoogleUser>;
}

oauthRouter.get("/github", (_req, res, next) => {
    try {
        const state = randomBytes(16).toString("hex");
        const clientId = getRequiredEnv("GITHUB_CLIENT_ID");
        const callbackUrl = getRequiredEnv("GITHUB_CALLBACK_URL");

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: callbackUrl,
            scope: "read:user user:email",
            state
        });

        return res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
    } catch (error) {
        return next(error);
    }
});

oauthRouter.get("/github/callback", async (req, res, next) => {
    const client = await pool.connect();

    try {
        const code = String(req.query.code ?? "");

        if (!code) {
            return res.redirect(buildFrontendRedirect("/?oauth=missing_code"));
        }

        const accessToken = await getGitHubAccessToken(code);
        const githubUser = await getGitHubUser(accessToken);
        const githubEmail = githubUser.email ?? await getGitHubPrimaryEmail(accessToken);

        if (!githubEmail) {
            return res.redirect(buildFrontendRedirect("/?oauth=missing_email"));
        }

        await client.query("BEGIN");

        const accountResult = await client.query(
            `SELECT u.id,
              u.email,
              u.display_name,
              u.dietary_preferences,
              u.default_portions,
              u.created_at
       FROM oauth_accounts oa
       JOIN users u ON u.id = oa.user_id
       WHERE oa.provider = $1 AND oa.provider_user_id = $2`,
            ["github", String(githubUser.id)]
        );

        let user = accountResult.rows[0];

        if (!user) {
            const existingUserResult = await client.query(
                `SELECT id,
                email,
                display_name,
                dietary_preferences,
                default_portions,
                created_at
         FROM users
         WHERE email = $1`,
                [githubEmail.toLowerCase()]
            );

            user = existingUserResult.rows[0];

            if (!user) {
                const displayName = githubUser.name ?? githubUser.login;

                const newUserResult = await client.query(
                    `INSERT INTO users (email, display_name, password_hash)
           VALUES ($1, $2, NULL)
           RETURNING id, email, display_name, dietary_preferences, default_portions, created_at`,
                    [
                        githubEmail.toLowerCase(),
                        displayName
                    ]
                );

                user = newUserResult.rows[0];
            }

            await client.query(
                `INSERT INTO oauth_accounts (user_id, provider, provider_user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (provider, provider_user_id) DO NOTHING`,
                [
                    user.id,
                    "github",
                    String(githubUser.id)
                ]
            );
        }

        await client.query("COMMIT");

        const token = createToken({
            userId: user.id,
            email: user.email
        });

        const params = new URLSearchParams({
            token
        });

        return res.redirect(buildFrontendRedirect(`/?oauth=success&${params.toString()}`));
    } catch (error) {
        await client.query("ROLLBACK");
        return next(error);
    } finally {
        client.release();
    }
});

oauthRouter.get("/google", (_req, res, next) => {
    try {
        const state = randomBytes(16).toString("hex");
        const clientId = getRequiredEnv("GOOGLE_CLIENT_ID");
        const callbackUrl = getRequiredEnv("GOOGLE_CALLBACK_URL");

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: callbackUrl,
            response_type: "code",
            scope: "openid email profile",
            state,
            prompt: "select_account"
        });

        return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    } catch (error) {
        return next(error);
    }
});

oauthRouter.get("/google/callback", async (req, res, next) => {
    const client = await pool.connect();

    try {
        const code = String(req.query.code ?? "");

        if (!code) {
            return res.redirect(buildFrontendRedirect("/?oauth=missing_code"));
        }

        const accessToken = await getGoogleAccessToken(code);
        const googleUser = await getGoogleUser(accessToken);

        if (!googleUser.email || !googleUser.verified_email) {
            return res.redirect(buildFrontendRedirect("/?oauth=missing_email"));
        }

        await client.query("BEGIN");

        const accountResult = await client.query(
            `SELECT u.id,
              u.email,
              u.display_name,
              u.dietary_preferences,
              u.default_portions,
              u.created_at
       FROM oauth_accounts oa
       JOIN users u ON u.id = oa.user_id
       WHERE oa.provider = $1 AND oa.provider_user_id = $2`,
            ["google", googleUser.id]
        );

        let user = accountResult.rows[0];

        if (!user) {
            const existingUserResult = await client.query(
                `SELECT id,
                email,
                display_name,
                dietary_preferences,
                default_portions,
                created_at
         FROM users
         WHERE email = $1`,
                [googleUser.email.toLowerCase()]
            );

            user = existingUserResult.rows[0];

            if (!user) {
                const newUserResult = await client.query(
                    `INSERT INTO users (email, display_name, password_hash)
           VALUES ($1, $2, NULL)
           RETURNING id, email, display_name, dietary_preferences, default_portions, created_at`,
                    [
                        googleUser.email.toLowerCase(),
                        googleUser.name
                    ]
                );

                user = newUserResult.rows[0];
            }

            await client.query(
                `INSERT INTO oauth_accounts (user_id, provider, provider_user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (provider, provider_user_id) DO NOTHING`,
                [
                    user.id,
                    "google",
                    googleUser.id
                ]
            );
        }

        await client.query("COMMIT");

        const token = createToken({
            userId: user.id,
            email: user.email
        });

        const params = new URLSearchParams({
            token
        });

        return res.redirect(buildFrontendRedirect(`/?oauth=success&${params.toString()}`));
    } catch (error) {
        await client.query("ROLLBACK");
        return next(error);
    } finally {
        client.release();
    }
});