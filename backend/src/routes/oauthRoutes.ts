import { Router } from "express";
import { randomBytes } from "crypto";
import { pool } from "../database/pool";
import { createToken } from "../utils/token";
import { findOrCreateOAuthUser } from "../utils/oauthUser";

export const oauthRouter = Router();

const oauthStates = new Map<string, number>();

const OAUTH_STATE_TTL = 10 * 60 * 1000;

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

function createOAuthState() {
    const state = randomBytes(16).toString("hex");

    oauthStates.set(
        state,
        Date.now() + OAUTH_STATE_TTL
    );

    return state;
}

function validateOAuthState(state: string) {
    const expiresAt = oauthStates.get(state);

    if (!expiresAt) {
        return false;
    }

    oauthStates.delete(state);

    return expiresAt > Date.now();
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
        const state = createOAuthState();
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
        const state = String(req.query.state ?? "");

        if (!validateOAuthState(state)) {
            return res.redirect(buildFrontendRedirect("/?oauth=invalid_state"));
        }

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

        const user = await findOrCreateOAuthUser(
            client,
            "github",
            String(githubUser.id),
            githubEmail,
            githubUser.name ?? githubUser.login
        );

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
        const state = createOAuthState();
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
        const state = String(req.query.state ?? "");

        if (!validateOAuthState(state)) {
            return res.redirect(buildFrontendRedirect("/?oauth=invalid_state"));
        }

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

        const user = await findOrCreateOAuthUser(
            client,
            "google",
            googleUser.id,
            googleUser.email,
            googleUser.name
        );

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