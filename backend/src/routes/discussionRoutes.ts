import { Router } from "express";
import { z } from "zod";
import { pool } from "../database/pool";
import { requireAuth, type AuthenticatedRequest } from "../middleware/authMiddleware";
import { emitCookbookMessageCreated, emitCookbookMessageDeleted } from "../realtime/socket";

export const discussionRouter = Router();

type CookbookRole = "OWNER" | "EDITOR" | "READER" | "COMMENTATOR";

const recipeCommentParamsSchema = z.object({
    recipeId: z.string().uuid("L'identifiant de la recette est invalide")
});

const recipeCommentDeleteParamsSchema = z.object({
    recipeId: z.string().uuid("L'identifiant de la recette est invalide"),
    commentId: z.string().uuid("L'identifiant du commentaire est invalide")
});

const cookbookMessageParamsSchema = z.object({
    cookbookId: z.string().uuid("L'identifiant du cookbook est invalide")
});

const cookbookMessageDeleteParamsSchema = z.object({
    cookbookId: z.string().uuid("L'identifiant du cookbook est invalide"),
    messageId: z.string().uuid("L'identifiant du message est invalide")
});

const contentSchema = z.object({
    content: z.string().trim().min(1, "Le message ne peut pas être vide").max(2000)
});

function formatComment(row: any) {
    return {
        id: row.id,
        content: row.content,
        createdAt: row.created_at,
        author: {
            id: row.user_id,
            email: row.email,
            displayName: row.display_name
        }
    };
}

function formatMessage(row: any) {
    return {
        id: row.id,
        content: row.content,
        createdAt: row.created_at,
        author: {
            id: row.user_id,
            email: row.email,
            displayName: row.display_name
        }
    };
}

function canComment(role: CookbookRole | null) {
    return role === "OWNER" || role === "EDITOR" || role === "COMMENTATOR";
}

function canDeleteDiscussionItem(role: CookbookRole | null, isAuthor: boolean) {
    return role === "OWNER" || ((role === "EDITOR" || role === "COMMENTATOR") && isAuthor);
}

async function getRecipeAccess(recipeId: string, userId: string) {
    const result = await pool.query(
        `SELECT r.id,
                r.cookbook_id,
                cm.role AS cookbook_role
         FROM recipes r
         JOIN cookbook_members cm ON cm.cookbook_id = r.cookbook_id AND cm.user_id = $2
         WHERE r.id = $1
           AND r.cookbook_id IS NOT NULL`,
        [recipeId, userId]
    );

    const recipe = result.rows[0];

    if (!recipe) {
        return null;
    }

    return {
        cookbookId: recipe.cookbook_id as string,
        cookbookRole: recipe.cookbook_role as CookbookRole
    };
}

async function getCookbookAccess(cookbookId: string, userId: string) {
    const result = await pool.query(
        `SELECT role
         FROM cookbook_members
         WHERE cookbook_id = $1 AND user_id = $2`,
        [cookbookId, userId]
    );

    return (result.rows[0]?.role ?? null) as CookbookRole | null;
}

discussionRouter.get("/recipes/:recipeId/comments", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const params = recipeCommentParamsSchema.parse(req.params);
        const access = await getRecipeAccess(params.recipeId, authenticatedRequest.user.userId);

        if (!access) {
            return res.status(404).json({
                message: "Recette introuvable dans un cookbook accessible"
            });
        }

        const result = await pool.query(
            `SELECT rc.id,
                    rc.content,
                    rc.created_at,
                    u.id AS user_id,
                    u.email,
                    u.display_name
             FROM recipe_comments rc
                      JOIN users u ON u.id = rc.user_id
             WHERE rc.recipe_id = $1
             ORDER BY rc.created_at ASC`,
            [params.recipeId]
        );

        return res.status(200).json({
            comments: result.rows.map(formatComment)
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                message: "Identifiant de recette invalide",
                fieldErrors: error.flatten().fieldErrors
            });
        }

        return next(error);
    }
});

discussionRouter.post("/recipes/:recipeId/comments", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const params = recipeCommentParamsSchema.parse(req.params);
        const data = contentSchema.parse(req.body);
        const access = await getRecipeAccess(params.recipeId, authenticatedRequest.user.userId);

        if (!access) {
            return res.status(404).json({
                message: "Recette introuvable dans un cookbook accessible"
            });
        }

        if (!canComment(access.cookbookRole)) {
            return res.status(403).json({
                message: "Votre rôle ne permet pas de commenter cette recette"
            });
        }

        const result = await pool.query(
            `INSERT INTO recipe_comments (recipe_id, user_id, content)
             VALUES ($1, $2, $3)
                 RETURNING id`,
            [params.recipeId, authenticatedRequest.user.userId, data.content]
        );

        const commentResult = await pool.query(
            `SELECT rc.id,
                    rc.content,
                    rc.created_at,
                    u.id AS user_id,
                    u.email,
                    u.display_name
             FROM recipe_comments rc
                      JOIN users u ON u.id = rc.user_id
             WHERE rc.id = $1`,
            [result.rows[0].id]
        );

        return res.status(201).json({
            comment: formatComment(commentResult.rows[0])
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                message: "Certains champs sont invalides",
                fieldErrors: error.flatten().fieldErrors
            });
        }

        return next(error);
    }
});

discussionRouter.delete("/recipes/:recipeId/comments/:commentId", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const params = recipeCommentDeleteParamsSchema.parse(req.params);
        const access = await getRecipeAccess(params.recipeId, authenticatedRequest.user.userId);

        if (!access) {
            return res.status(404).json({
                message: "Recette introuvable dans un cookbook accessible"
            });
        }

        const commentResult = await pool.query(
            `SELECT id, user_id
             FROM recipe_comments
             WHERE id = $1 AND recipe_id = $2`,
            [params.commentId, params.recipeId]
        );

        const comment = commentResult.rows[0];

        if (!comment) {
            return res.status(404).json({
                message: "Commentaire introuvable"
            });
        }

        const isAuthor = comment.user_id === authenticatedRequest.user.userId;

        if (!canDeleteDiscussionItem(access.cookbookRole, isAuthor)) {
            return res.status(403).json({
                message: "Vous ne pouvez pas supprimer ce commentaire"
            });
        }

        await pool.query(
            `DELETE FROM recipe_comments
             WHERE id = $1`,
            [params.commentId]
        );

        return res.status(200).json({
            message: "Commentaire supprimé"
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                message: "Identifiant invalide",
                fieldErrors: error.flatten().fieldErrors
            });
        }

        return next(error);
    }
});

discussionRouter.get("/cookbooks/:cookbookId/messages", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const params = cookbookMessageParamsSchema.parse(req.params);
        const accessRole = await getCookbookAccess(params.cookbookId, authenticatedRequest.user.userId);

        if (!accessRole) {
            return res.status(404).json({
                message: "Cookbook introuvable"
            });
        }

        const result = await pool.query(
            `SELECT cm.id,
                    cm.content,
                    cm.created_at,
                    u.id AS user_id,
                    u.email,
                    u.display_name
             FROM cookbook_messages cm
                      JOIN users u ON u.id = cm.user_id
             WHERE cm.cookbook_id = $1
             ORDER BY cm.created_at ASC`,
            [params.cookbookId]
        );

        return res.status(200).json({
            messages: result.rows.map(formatMessage)
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                message: "Identifiant de cookbook invalide",
                fieldErrors: error.flatten().fieldErrors
            });
        }

        return next(error);
    }
});

discussionRouter.post("/cookbooks/:cookbookId/messages", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const params = cookbookMessageParamsSchema.parse(req.params);
        const data = contentSchema.parse(req.body);
        const accessRole = await getCookbookAccess(params.cookbookId, authenticatedRequest.user.userId);

        if (!accessRole) {
            return res.status(404).json({
                message: "Cookbook introuvable"
            });
        }

        if (!canComment(accessRole)) {
            return res.status(403).json({
                message: "Votre rôle ne permet pas d'envoyer un message dans ce cookbook"
            });
        }

        const result = await pool.query(
            `INSERT INTO cookbook_messages (cookbook_id, user_id, content)
             VALUES ($1, $2, $3)
                 RETURNING id`,
            [params.cookbookId, authenticatedRequest.user.userId, data.content]
        );

        const messageResult = await pool.query(
            `SELECT cm.id,
                    cm.content,
                    cm.created_at,
                    u.id AS user_id,
                    u.email,
                    u.display_name
             FROM cookbook_messages cm
                      JOIN users u ON u.id = cm.user_id
             WHERE cm.id = $1`,
            [result.rows[0].id]
        );

        const message = formatMessage(messageResult.rows[0]);

        emitCookbookMessageCreated(params.cookbookId, message);

        return res.status(201).json({
            message
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                message: "Certains champs sont invalides",
                fieldErrors: error.flatten().fieldErrors
            });
        }

        return next(error);
    }
});

discussionRouter.delete("/cookbooks/:cookbookId/messages/:messageId", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const params = cookbookMessageDeleteParamsSchema.parse(req.params);
        const accessRole = await getCookbookAccess(params.cookbookId, authenticatedRequest.user.userId);

        if (!accessRole) {
            return res.status(404).json({
                message: "Cookbook introuvable"
            });
        }

        const messageResult = await pool.query(
            `SELECT id, user_id
             FROM cookbook_messages
             WHERE id = $1 AND cookbook_id = $2`,
            [params.messageId, params.cookbookId]
        );

        const message = messageResult.rows[0];

        if (!message) {
            return res.status(404).json({
                message: "Message introuvable"
            });
        }

        const isAuthor = message.user_id === authenticatedRequest.user.userId;

        if (!canDeleteDiscussionItem(accessRole, isAuthor)) {
            return res.status(403).json({
                message: "Vous ne pouvez pas supprimer ce message"
            });
        }

        await pool.query(
            `DELETE FROM cookbook_messages
             WHERE id = $1`,
            [params.messageId]
        );

        emitCookbookMessageDeleted(params.cookbookId, params.messageId);

        return res.status(200).json({
            message: "Message supprimé"
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                message: "Identifiant invalide",
                fieldErrors: error.flatten().fieldErrors
            });
        }

        return next(error);
    }
});