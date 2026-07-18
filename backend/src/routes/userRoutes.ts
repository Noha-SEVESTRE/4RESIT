import { Router } from "express";
import { z } from "zod";
import { pool } from "../database/pool";
import { requireAuth, type AuthenticatedRequest } from "../middleware/authMiddleware";
import { hashPassword, verifyPassword } from "../utils/password";

export const userRouter = Router();

const preferencesSchema = z.object({
    displayName: z.string().min(2).max(120).optional(),
    defaultPortions: z.number().int().min(1).max(20).optional(),
    dietaryPreferences: z.object({
        diet: z.string().max(80).optional(),
        allergies: z.array(z.string().max(80)).max(20).optional(),
        favoriteCuisine: z.string().max(80).optional()
    }).optional()
});

const passwordSchema = z.object({
    currentPassword: z.string()
        .min(1, "Le mot de passe actuel est obligatoire")
        .max(120, "Le mot de passe actuel est trop long"),
    newPassword: z.string()
        .min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères")
        .max(120, "Le nouveau mot de passe est trop long"),
    newPasswordConfirmation: z.string()
        .min(1, "La confirmation du mot de passe est obligatoire")
        .max(120, "La confirmation du mot de passe est trop longue")
}).refine((data) => data.newPassword === data.newPasswordConfirmation, {
    path: ["newPasswordConfirmation"],
    message: "Les mots de passe ne correspondent pas"
});

function formatUser(row: any) {
    return {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        dietaryPreferences: row.dietary_preferences,
        defaultPortions: row.default_portions,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function formatValidationError(error: z.ZodError) {
    return {
        message: "Certains champs sont invalides",
        fieldErrors: error.flatten().fieldErrors
    };
}

function getAuthenticatedUserId(req: AuthenticatedRequest) {
    return req.user?.userId ?? null;
}

userRouter.get("/me/preferences", requireAuth, async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req as AuthenticatedRequest);

        if (!userId) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const result = await pool.query(
            `SELECT id, email, display_name, dietary_preferences, default_portions, created_at, updated_at
             FROM users
             WHERE id = $1`,
            [userId]
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({
                message: "Utilisateur introuvable"
            });
        }

        return res.status(200).json({
            user: formatUser(user)
        });
    } catch (error) {
        return next(error);
    }
});

userRouter.patch("/me/preferences", requireAuth, async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req as AuthenticatedRequest);

        if (!userId) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const data = preferencesSchema.parse(req.body);

        const currentResult = await pool.query(
            `SELECT dietary_preferences
             FROM users
             WHERE id = $1`,
            [userId]
        );

        const currentUser = currentResult.rows[0];

        if (!currentUser) {
            return res.status(404).json({
                message: "Utilisateur introuvable"
            });
        }

        const currentPreferences = currentUser.dietary_preferences ?? {};
        const nextPreferences = {
            ...currentPreferences,
            ...(data.dietaryPreferences ?? {})
        };

        const result = await pool.query(
            `UPDATE users
             SET display_name = COALESCE($1, display_name),
                 default_portions = COALESCE($2, default_portions),
                 dietary_preferences = $3,
                 updated_at = now()
             WHERE id = $4
             RETURNING id, email, display_name, dietary_preferences, default_portions, created_at, updated_at`,
            [
                data.displayName ?? null,
                data.defaultPortions ?? null,
                nextPreferences,
                userId
            ]
        );

        return res.status(200).json({
            user: formatUser(result.rows[0])
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json(formatValidationError(error));
        }

        return next(error);
    }
});

userRouter.get("/me/security", requireAuth, async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req as AuthenticatedRequest);

        if (!userId) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const result = await pool.query(
            `SELECT u.email,
                    u.password_hash,
                    COALESCE(array_agg(oa.provider) FILTER (WHERE oa.provider IS NOT NULL), '{}') AS oauth_providers
             FROM users u
                      LEFT JOIN oauth_accounts oa ON oa.user_id = u.id
             WHERE u.id = $1
             GROUP BY u.id`,
            [userId]
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({
                message: "Utilisateur introuvable"
            });
        }

        const hasPassword = Boolean(user.password_hash);
        const oauthProviders = user.oauth_providers ?? [];

        return res.status(200).json({
            security: {
                email: user.email,
                hasPassword,
                oauthProviders,
                canChangePassword: hasPassword
            }
        });
    } catch (error) {
        return next(error);
    }
});

userRouter.patch("/me/password", requireAuth, async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req as AuthenticatedRequest);

        if (!userId) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const data = passwordSchema.parse(req.body);

        const result = await pool.query(
            `SELECT password_hash
             FROM users
             WHERE id = $1`,
            [userId]
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({
                message: "Utilisateur introuvable"
            });
        }

        if (!user.password_hash) {
            return res.status(403).json({
                message: "Ce compte utilise une connexion OAuth2, le mot de passe est géré par le fournisseur externe",
                fieldErrors: {
                    currentPassword: ["Ce compte ne possède pas de mot de passe local"]
                }
            });
        }

        const currentPasswordIsValid = await verifyPassword(data.currentPassword, user.password_hash);

        if (!currentPasswordIsValid) {
            return res.status(400).json({
                message: "Mot de passe actuel incorrect",
                fieldErrors: {
                    currentPassword: ["Mot de passe actuel incorrect"]
                }
            });
        }

        const nextPasswordHash = await hashPassword(data.newPassword);

        await pool.query(
            `UPDATE users
             SET password_hash = $1,
                 updated_at = now()
             WHERE id = $2`,
            [nextPasswordHash, userId]
        );

        return res.status(200).json({
            message: "Mot de passe modifié"
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json(formatValidationError(error));
        }

        return next(error);
    }
});