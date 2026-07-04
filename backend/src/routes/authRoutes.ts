import { Router } from "express";
import { z } from "zod";
import { pool } from "../database/pool";
import { requireAuth, type AuthenticatedRequest } from "../middleware/authMiddleware";
import { hashPassword, verifyPassword } from "../utils/password";
import { createToken } from "../utils/token";

export const authRouter = Router();

const registerSchema = z.object({
    email: z.string()
        .trim()
        .min(1, "L'adresse email est obligatoire")
        .email("L'adresse email n'est pas valide")
        .max(255, "L'adresse email est trop longue")
        .transform((value) => value.toLowerCase()),
    password: z.string()
        .min(1, "Le mot de passe est obligatoire")
        .min(8, "Le mot de passe doit contenir au moins 8 caractères")
        .max(120, "Le mot de passe est trop long"),
    displayName: z.string()
        .trim()
        .min(1, "Le pseudonyme est obligatoire")
        .min(2, "Le pseudonyme doit contenir au moins 2 caractères")
        .max(120, "Le pseudonyme est trop long")
});

const loginSchema = z.object({
    email: z.string()
        .trim()
        .min(1, "L'adresse email est obligatoire")
        .email("L'adresse email n'est pas valide")
        .max(255, "L'adresse email est trop longue")
        .transform((value) => value.toLowerCase()),
    password: z.string()
        .min(1, "Le mot de passe est obligatoire")
        .max(120, "Le mot de passe est trop long")
});

function formatUser(row: any) {
    return {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        dietaryPreferences: row.dietary_preferences,
        defaultPortions: row.default_portions,
        createdAt: row.created_at
    };
}

function formatValidationError(error: z.ZodError) {
    return {
        message: "Certains champs sont invalides",
        fieldErrors: error.flatten().fieldErrors
    };
}

authRouter.post("/register", async (req, res, next) => {
    try {
        const data = registerSchema.parse(req.body);

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [data.email]
        );

        if (existingUser.rowCount) {
            return res.status(409).json({
                message: "Cette adresse email est déjà utilisée",
                fieldErrors: {
                    email: ["Cette adresse email est déjà utilisée"]
                }
            });
        }

        const passwordHash = await hashPassword(data.password);

        const result = await pool.query(
            `INSERT INTO users (email, password_hash, display_name)
             VALUES ($1, $2, $3)
                 RETURNING id, email, display_name, dietary_preferences, default_portions, created_at`,
            [data.email, passwordHash, data.displayName]
        );

        const user = formatUser(result.rows[0]);
        const token = createToken({
            userId: user.id,
            email: user.email
        });

        return res.status(201).json({
            token,
            user
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json(formatValidationError(error));
        }

        return next(error);
    }
});

authRouter.post("/login", async (req, res, next) => {
    try {
        const data = loginSchema.parse(req.body);

        const result = await pool.query(
            `SELECT id, email, password_hash, display_name, dietary_preferences, default_portions, created_at
             FROM users
             WHERE email = $1`,
            [data.email]
        );

        const userRow = result.rows[0];

        if (!userRow) {
            return res.status(404).json({
                message: "Aucun compte ne correspond à cette adresse email",
                fieldErrors: {
                    email: ["Aucun compte ne correspond à cette adresse email"]
                }
            });
        }

        if (!userRow.password_hash) {
            return res.status(401).json({
                message: "Ce compte utilise une connexion OAuth2",
                fieldErrors: {
                    password: ["Utilisez Google ou GitHub pour vous connecter à ce compte"]
                }
            });
        }

        const passwordIsValid = await verifyPassword(data.password, userRow.password_hash);

        if (!passwordIsValid) {
            return res.status(401).json({
                message: "Mot de passe incorrect",
                fieldErrors: {
                    password: ["Mot de passe incorrect"]
                }
            });
        }

        const user = formatUser(userRow);
        const token = createToken({
            userId: user.id,
            email: user.email
        });

        return res.status(200).json({
            token,
            user
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json(formatValidationError(error));
        }

        return next(error);
    }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const result = await pool.query(
            `SELECT id, email, display_name, dietary_preferences, default_portions, created_at
             FROM users
             WHERE id = $1`,
            [authenticatedRequest.user.userId]
        );

        const userRow = result.rows[0];

        if (!userRow) {
            return res.status(401).json({
                message: "Utilisateur introuvable"
            });
        }

        return res.status(200).json({
            user: formatUser(userRow)
        });
    } catch (error) {
        return next(error);
    }
});