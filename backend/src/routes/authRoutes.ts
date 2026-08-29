import { Router } from "express";
import { z } from "zod";
import { pool } from "../database/pool";
import { requireAuth, type AuthenticatedRequest } from "../middleware/authMiddleware";
import { hashPassword, verifyPassword } from "../utils/password";
import { createToken } from "../utils/token";
import { createStrongPasswordSchema } from "../utils/passwordValidation";
import { formatUser } from "../utils/userFormatter";
import { createHash, randomBytes } from "crypto";

export const authRouter = Router();

const registerSchema = z.object({
    email: z.string()
        .trim()
        .min(1, "L'adresse email est obligatoire")
        .email("L'adresse email n'est pas valide")
        .max(255, "L'adresse email est trop longue")
        .transform((value) => value.toLowerCase()),
    password: createStrongPasswordSchema(),
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

const forgotPasswordSchema = z.object({
    email: z.string()
        .trim()
        .min(1, "L'adresse email est obligatoire")
        .email("L'adresse email n'est pas valide")
        .max(255, "L'adresse email est trop longue")
        .transform((value) => value.toLowerCase())
});

const resetPasswordSchema = z.object({
    token: z.string()
        .trim()
        .min(1, "Le jeton de réinitialisation est obligatoire"),

    newPassword: createStrongPasswordSchema(
        "Le nouveau mot de passe"
    ),

    newPasswordConfirmation: z.string()
        .min(1, "La confirmation du mot de passe est obligatoire")
}).refine(
    (data) =>
        data.newPassword === data.newPasswordConfirmation,
    {
        message: "Les mots de passe ne correspondent pas",
        path: ["newPasswordConfirmation"]
    }
);

function formatValidationError(error: z.ZodError) {
    return {
        message: "Certains champs sont invalides",
        fieldErrors: error.flatten().fieldErrors
    };
}

const maxLoginAttempts = 5;

function isAccountLocked(lockedUntil: string | Date | null) {
    if (!lockedUntil) {
        return false;
    }

    return new Date(lockedUntil).getTime() > Date.now();
}

function getRemainingLockMinutes(lockedUntil: string | Date | null) {
    if (!lockedUntil) {
        return 0;
    }

    const remainingMilliseconds = new Date(lockedUntil).getTime() - Date.now();

    return Math.max(1, Math.ceil(remainingMilliseconds / 60000));
}

const PASSWORD_RESET_TTL_MINUTES = 30;

function hashResetToken(token: string) {
    return createHash("sha256")
        .update(token)
        .digest("hex");
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
            `SELECT id,
                    email,
                    password_hash,
                    display_name,
                    dietary_preferences,
                    default_portions,
                    failed_login_attempts,
                    locked_until,
                    created_at
             FROM users
             WHERE email = $1`,
            [data.email]
        );

        const userRow = result.rows[0];

        if (!userRow) {
            return res.status(401).json({
                message: "Email ou mot de passe incorrect",
                fieldErrors: {
                    email: ["Email ou mot de passe incorrect"]
                }
            });
        }

        if (isAccountLocked(userRow.locked_until)) {
            const remainingMinutes = getRemainingLockMinutes(userRow.locked_until);

            return res.status(423).json({
                message: `Compte temporairement verrouillé. Réessaie dans ${remainingMinutes} minute${remainingMinutes > 1 ? "s" : ""}`,
                fieldErrors: {
                    password: [`Trop de tentatives. Réessaie dans ${remainingMinutes} minute${remainingMinutes > 1 ? "s" : ""}`]
                }
            });
        }

        if (!userRow.password_hash) {
            return res.status(401).json({
                message: "Email ou mot de passe incorrect",
                fieldErrors: {
                    password: ["Email ou mot de passe incorrect"]
                }
            });
        }

        const passwordIsValid = await verifyPassword(data.password, userRow.password_hash);

        if (!passwordIsValid) {
            const nextAttempts = Number(userRow.failed_login_attempts ?? 0) + 1;

            if (nextAttempts >= maxLoginAttempts) {
                await pool.query(
                    `UPDATE users
             SET failed_login_attempts = $1,
                 locked_until = now() + interval '5 minutes',
                 updated_at = now()
             WHERE id = $2`,
                    [maxLoginAttempts, userRow.id]
                );

                return res.status(423).json({
                    message: "Compte temporairement verrouillé. Réessaie dans 5 minutes",
                    fieldErrors: {
                        password: ["Trop de tentatives. Réessaie dans 5 minutes"]
                    }
                });
            }

            await pool.query(
                `UPDATE users
         SET failed_login_attempts = $1,
             updated_at = now()
         WHERE id = $2`,
                [nextAttempts, userRow.id]
            );

            return res.status(401).json({
                message: "Mot de passe incorrect",
                fieldErrors: {
                    password: [`Mot de passe incorrect. Tentative ${nextAttempts}/${maxLoginAttempts}`]
                }
            });
        }

        const user = formatUser(userRow);
        const token = createToken({
            userId: user.id,
            email: user.email
        });

        await pool.query(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = now() WHERE id = $1`, [userRow.id]);

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

authRouter.post("/forgot-password", async (req, res, next) => {
    try {
        const data = forgotPasswordSchema.parse(req.body);

        const userResult = await pool.query(
            `SELECT id, password_hash
             FROM users
             WHERE email = $1`,
            [data.email]
        );

        const user = userResult.rows[0];

        let resetUrl: string | undefined;

        /*
         * On ne génère un token que pour les comptes locaux.
         * Un compte uniquement OAuth possède password_hash = NULL.
         */
        if (user?.password_hash) {
            const rawToken = randomBytes(32).toString("hex");

            const tokenHash = hashResetToken(rawToken);

            /*
             * On supprime les anciens tokens de cet utilisateur
             * ainsi que les tokens déjà expirés.
             */
            await pool.query(
                `DELETE FROM password_reset_tokens
                 WHERE user_id = $1
                    OR expires_at < now()`,
                [user.id]
            );

            await pool.query(
                `INSERT INTO password_reset_tokens (
                    user_id,
                    token_hash,
                    expires_at
                 )
                 VALUES (
                    $1,
                    $2,
                    now() + ($3::int * interval '1 minute')
                 )`,
                [
                    user.id,
                    tokenHash,
                    PASSWORD_RESET_TTL_MINUTES
                ]
            );

            const frontendUrl =
                process.env.FRONTEND_URL ??
                "http://localhost:8081";

            resetUrl =
                `${frontendUrl}/?resetToken=${encodeURIComponent(rawToken)}`;

            /*
             * Pour les tests locaux uniquement.
             * Le token n'est pas retourné en production.
             */
            if (process.env.NODE_ENV !== "production") {
                console.log(
                    `[SUPMEAL] Lien de réinitialisation : ${resetUrl}`
                );
            }
        }

        /*
         * Même réponse si l'adresse n'existe pas afin
         * de ne pas permettre de savoir quels emails
         * possèdent un compte SUPMEAL.
         */
        return res.status(200).json({
            message:
                "Si un compte local correspond à cette adresse, un lien de réinitialisation a été généré.",

            ...(process.env.NODE_ENV !== "production" &&
            resetUrl
                ? { resetUrl }
                : {})
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json(
                formatValidationError(error)
            );
        }

        return next(error);
    }
});

authRouter.post("/reset-password", async (req, res, next) => {
    const client = await pool.connect();

    try {
        const data = resetPasswordSchema.parse(req.body);

        const tokenHash = hashResetToken(data.token);

        await client.query("BEGIN");

        const tokenResult = await client.query(
            `SELECT
                prt.id,
                prt.user_id
             FROM password_reset_tokens prt
             JOIN users u
               ON u.id = prt.user_id
             WHERE prt.token_hash = $1
               AND prt.used_at IS NULL
               AND prt.expires_at > now()
               AND u.password_hash IS NOT NULL
             FOR UPDATE`,
            [tokenHash]
        );

        const resetToken = tokenResult.rows[0];

        if (!resetToken) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message:
                    "Ce lien de réinitialisation est invalide ou a expiré"
            });
        }

        const passwordHash =
            await hashPassword(data.newPassword);

        await client.query(
            `UPDATE users
             SET password_hash = $1,
                 failed_login_attempts = 0,
                 locked_until = NULL,
                 updated_at = now()
             WHERE id = $2`,
            [
                passwordHash,
                resetToken.user_id
            ]
        );

        /*
         * Le token devient inutilisable après usage.
         */
        await client.query(
            `UPDATE password_reset_tokens
             SET used_at = now()
             WHERE id = $1`,
            [resetToken.id]
        );

        /*
         * Suppression des éventuels autres tokens
         * de l'utilisateur.
         */
        await client.query(
            `DELETE FROM password_reset_tokens
             WHERE user_id = $1
               AND id <> $2`,
            [
                resetToken.user_id,
                resetToken.id
            ]
        );

        await client.query("COMMIT");

        return res.status(200).json({
            message:
                "Votre mot de passe a été réinitialisé. Vous pouvez maintenant vous connecter."
        });
    } catch (error) {
        await client.query("ROLLBACK");

        if (error instanceof z.ZodError) {
            return res.status(400).json(
                formatValidationError(error)
            );
        }

        return next(error);
    } finally {
        client.release();
    }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

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