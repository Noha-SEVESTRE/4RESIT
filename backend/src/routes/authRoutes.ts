import { Router } from "express";
import { z } from "zod";
import { pool } from "../database/pool";
import { hashPassword, verifyPassword } from "../utils/password";
import { createToken, verifyToken } from "../utils/token";

export const authRouter = Router();

const registerSchema = z.object({
    email: z.string().email().max(255).transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(120),
    displayName: z.string().min(2).max(120)
});

const loginSchema = z.object({
    email: z.string().email().max(255).transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(120)
});

function getBearerToken(authorizationHeader: string | undefined) {
    if (!authorizationHeader) {
        return null;
    }

    if (!authorizationHeader.startsWith("Bearer ")) {
        return null;
    }

    return authorizationHeader.slice(7);
}

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

authRouter.post("/register", async (req, res, next) => {
    try {
        const data = registerSchema.parse(req.body);

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [data.email]
        );

        if (existingUser.rowCount) {
            return res.status(409).json({
                message: "Cette adresse email est déjà utilisée"
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
            return res.status(400).json({
                message: "Données invalides",
                errors: error.flatten()
            });
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

        if (!userRow || !userRow.password_hash) {
            return res.status(401).json({
                message: "Identifiants incorrects"
            });
        }

        const passwordIsValid = await verifyPassword(data.password, userRow.password_hash);

        if (!passwordIsValid) {
            return res.status(401).json({
                message: "Identifiants incorrects"
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
            return res.status(400).json({
                message: "Données invalides",
                errors: error.flatten()
            });
        }

        return next(error);
    }
});

authRouter.get("/me", async (req, res, next) => {
    try {
        const token = getBearerToken(req.headers.authorization);

        if (!token) {
            return res.status(401).json({
                message: "Token manquant"
            });
        }

        const payload = verifyToken(token);

        const result = await pool.query(
            `SELECT id, email, display_name, dietary_preferences, default_portions, created_at
       FROM users
       WHERE id = $1`,
            [payload.userId]
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