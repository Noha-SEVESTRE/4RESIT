import { Router } from "express";
import { z } from "zod";
import { pool } from "../database/pool";
import { requireAuth, type AuthenticatedRequest } from "../middleware/authMiddleware";

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

userRouter.get("/me/preferences", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const result = await pool.query(
            `SELECT id, email, display_name, dietary_preferences, default_portions, created_at, updated_at
       FROM users
       WHERE id = $1`,
            [authenticatedRequest.user.userId]
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
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const data = preferencesSchema.parse(req.body);

        const currentResult = await pool.query(
            `SELECT dietary_preferences
       FROM users
       WHERE id = $1`,
            [authenticatedRequest.user.userId]
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
                authenticatedRequest.user.userId
            ]
        );

        return res.status(200).json({
            user: formatUser(result.rows[0])
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                message: "Données invalides",
                errors: error.flatten()
            });
        }

        return next(error);
    }
});