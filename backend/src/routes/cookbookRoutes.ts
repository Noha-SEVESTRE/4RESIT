import { Router } from "express";
import { z } from "zod";
import { pool } from "../database/pool";
import { requireAuth, type AuthenticatedRequest } from "../middleware/authMiddleware";

export const cookbookRouter = Router();

const roleSchema = z.enum(["OWNER", "EDITOR", "READER", "COMMENTATOR"]);
const editableRoleSchema = z.enum(["EDITOR", "READER", "COMMENTATOR"]);

const createCookbookSchema = z.object({
    name: z.string().trim().min(1, "Le nom du cookbook est obligatoire").max(120),
    description: z.string().trim().max(1000).optional()
});

const cookbookParamsSchema = z.object({
    id: z.string().uuid("L'identifiant du cookbook est invalide")
});

const cookbookRecipeParamsSchema = z.object({
    id: z.string().uuid("L'identifiant du cookbook est invalide"),
    recipeId: z.string().uuid("L'identifiant de la recette est invalide")
});

const addMemberSchema = z.object({
    email: z.string().trim().email("L'adresse email est invalide"),
    role: editableRoleSchema.default("READER")
});

const memberParamsSchema = z.object({
    id: z.string().uuid("L'identifiant du cookbook est invalide"),
    userId: z.string().uuid("L'identifiant de l'utilisateur est invalide")
});

const cookbookRecipesQuerySchema = z.object({
    q: z.string().trim().optional(),
    tag: z.string().trim().optional(),
    ingredient: z.string().trim().optional(),
    maxTotalTime: z.coerce.number().int().min(0).max(2880).optional()
});

type CookbookRole = z.infer<typeof roleSchema>;

function canEditCookbook(role: CookbookRole) {
    return role === "OWNER" || role === "EDITOR";
}

function canManageMembers(role: CookbookRole) {
    return role === "OWNER";
}

function formatCookbook(row: any) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        createdBy: row.created_by,
        role: row.role,
        recipeCount: Number(row.recipe_count ?? 0),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function formatMember(row: any) {
    return {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        role: row.role,
        createdAt: row.created_at
    };
}

function formatCookbookRecipe(row: any) {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        preparationTime: row.preparation_time,
        cookingTime: row.cooking_time,
        portions: row.portions,
        imageUrl: row.image_url,
        source: row.source,
        tags: row.tags ?? [],
        owner: {
            id: row.owner_id,
            displayName: row.owner_display_name
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function getCookbookAccess(cookbookId: string, userId: string) {
    const result = await pool.query(
        `SELECT role
     FROM cookbook_members
     WHERE cookbook_id = $1 AND user_id = $2`,
        [cookbookId, userId]
    );

    const role = result.rows[0]?.role;

    if (!role) {
        return null;
    }

    return roleSchema.parse(role);
}

cookbookRouter.get("/", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const result = await pool.query(
            `SELECT c.id,
              c.name,
              c.description,
              c.created_by,
              c.created_at,
              c.updated_at,
              cm.role,
              COUNT(DISTINCT r.id) AS recipe_count
       FROM cookbooks c
       JOIN cookbook_members cm ON cm.cookbook_id = c.id
       LEFT JOIN recipes r ON r.cookbook_id = c.id
       WHERE cm.user_id = $1
       GROUP BY c.id, cm.role
       ORDER BY c.created_at DESC`,
            [authenticatedRequest.user.userId]
        );

        return res.status(200).json({
            cookbooks: result.rows.map(formatCookbook)
        });
    } catch (error) {
        return next(error);
    }
});

cookbookRouter.post("/", requireAuth, async (req, res, next) => {
    const client = await pool.connect();

    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const data = createCookbookSchema.parse(req.body);

        await client.query("BEGIN");

        const cookbookResult = await client.query(
            `INSERT INTO cookbooks (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, created_by, created_at, updated_at`,
            [
                data.name,
                data.description ?? null,
                authenticatedRequest.user.userId
            ]
        );

        const cookbook = cookbookResult.rows[0];

        await client.query(
            `INSERT INTO cookbook_members (cookbook_id, user_id, role)
       VALUES ($1, $2, 'OWNER')`,
            [cookbook.id, authenticatedRequest.user.userId]
        );

        await client.query("COMMIT");

        return res.status(201).json({
            cookbook: {
                ...formatCookbook({
                    ...cookbook,
                    role: "OWNER",
                    recipe_count: 0
                })
            }
        });
    } catch (error) {
        await client.query("ROLLBACK");

        if (error instanceof z.ZodError) {
            return res.status(400).json({
                message: "Certains champs sont invalides",
                fieldErrors: error.flatten().fieldErrors
            });
        }

        return next(error);
    } finally {
        client.release();
    }
});

cookbookRouter.get("/:id", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const params = cookbookParamsSchema.parse(req.params);
        const accessRole = await getCookbookAccess(params.id, authenticatedRequest.user.userId);

        if (!accessRole) {
            return res.status(404).json({
                message: "Cookbook introuvable"
            });
        }

        const cookbookResult = await pool.query(
            `SELECT c.id,
              c.name,
              c.description,
              c.created_by,
              c.created_at,
              c.updated_at,
              $2 AS role,
              COUNT(DISTINCT r.id) AS recipe_count
       FROM cookbooks c
       LEFT JOIN recipes r ON r.cookbook_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
            [params.id, accessRole]
        );

        const membersResult = await pool.query(
            `SELECT u.id,
              u.email,
              u.display_name,
              cm.role,
              cm.created_at
       FROM cookbook_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.cookbook_id = $1
       ORDER BY cm.created_at ASC`,
            [params.id]
        );

        return res.status(200).json({
            cookbook: formatCookbook(cookbookResult.rows[0]),
            members: membersResult.rows.map(formatMember)
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

cookbookRouter.post("/:id/members", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const params = cookbookParamsSchema.parse(req.params);
        const data = addMemberSchema.parse(req.body);
        const accessRole = await getCookbookAccess(params.id, authenticatedRequest.user.userId);

        if (!accessRole) {
            return res.status(404).json({
                message: "Cookbook introuvable"
            });
        }

        if (!canManageMembers(accessRole)) {
            return res.status(403).json({
                message: "Seul le propriétaire peut gérer les membres"
            });
        }

        const userResult = await pool.query(
            `SELECT id, email, display_name
       FROM users
       WHERE email = $1`,
            [data.email]
        );

        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({
                message: "Utilisateur introuvable"
            });
        }

        if (user.id === authenticatedRequest.user.userId) {
            return res.status(400).json({
                message: "Vous êtes déjà propriétaire de ce cookbook"
            });
        }

        const memberResult = await pool.query(
            `INSERT INTO cookbook_members (cookbook_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (cookbook_id, user_id)
       DO UPDATE SET role = EXCLUDED.role
       RETURNING role, created_at`,
            [params.id, user.id, data.role]
        );

        return res.status(200).json({
            member: formatMember({
                ...user,
                role: memberResult.rows[0].role,
                created_at: memberResult.rows[0].created_at
            })
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

cookbookRouter.delete("/:id/members/:userId", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const params = memberParamsSchema.parse(req.params);
        const accessRole = await getCookbookAccess(params.id, authenticatedRequest.user.userId);

        if (!accessRole) {
            return res.status(404).json({
                message: "Cookbook introuvable"
            });
        }

        if (!canManageMembers(accessRole)) {
            return res.status(403).json({
                message: "Seul le propriétaire peut gérer les membres"
            });
        }

        if (params.userId === authenticatedRequest.user.userId) {
            return res.status(400).json({
                message: "Le propriétaire ne peut pas se retirer lui-même"
            });
        }

        const result = await pool.query(
            `DELETE FROM cookbook_members
       WHERE cookbook_id = $1 AND user_id = $2
       RETURNING user_id`,
            [params.id, params.userId]
        );

        if (!result.rows[0]) {
            return res.status(404).json({
                message: "Membre introuvable"
            });
        }

        return res.status(200).json({
            message: "Membre retiré du cookbook"
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

cookbookRouter.get("/:id/recipes", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const params = cookbookParamsSchema.parse(req.params);
        const query = cookbookRecipesQuerySchema.parse(req.query);
        const accessRole = await getCookbookAccess(params.id, authenticatedRequest.user.userId);

        if (!accessRole) {
            return res.status(404).json({
                message: "Cookbook introuvable"
            });
        }

        const values: unknown[] = [params.id];
        const conditions = ["r.cookbook_id = $1"];
        let index = 2;

        if (query.q) {
            values.push(`%${query.q}%`);
            conditions.push(
                `(r.title ILIKE $${index}
                OR r.description ILIKE $${index}
                OR EXISTS (
                SELECT 1
                FROM recipe_tags search_tags
                WHERE search_tags.recipe_id = r.id AND search_tags.name ILIKE $${index}
                )
                OR EXISTS (
                SELECT 1
                FROM recipe_ingredients search_ingredients
                WHERE search_ingredients.recipe_id = r.id AND search_ingredients.name ILIKE $${index}
                )
                OR EXISTS (
                SELECT 1
                FROM recipe_steps search_steps
                WHERE search_steps.recipe_id = r.id AND search_steps.instruction ILIKE $${index}
                ))`
            );
            index++;
        }

        if (query.tag) {
            values.push(`%${query.tag}%`);
            conditions.push(
                `EXISTS (
                SELECT 1
                FROM recipe_tags filter_tags
                WHERE filter_tags.recipe_id = r.id AND filter_tags.name ILIKE $${index}
                )`
            );
            index++;
        }

        if (query.ingredient) {
            values.push(`%${query.ingredient}%`);
            conditions.push(
                `EXISTS (
                SELECT 1
                FROM recipe_ingredients filter_ingredients
                WHERE filter_ingredients.recipe_id = r.id AND filter_ingredients.name ILIKE $${index}
                )`
            );
            index++;
        }

        if (query.maxTotalTime !== undefined) {
            values.push(query.maxTotalTime);
            conditions.push(`(r.preparation_time + r.cooking_time) <= $${index}`);
            index++;
        }

        const result = await pool.query(
            `SELECT r.id,
              r.owner_id,
              u.display_name AS owner_display_name,
              r.title,
              r.description,
              r.preparation_time,
              r.cooking_time,
              r.portions,
              r.image_url,
              r.source,
              r.created_at,
              r.updated_at,
              COALESCE(array_agg(DISTINCT rt.name) FILTER (WHERE rt.name IS NOT NULL), '{}') AS tags
       FROM recipes r
       JOIN users u ON u.id = r.owner_id
       LEFT JOIN recipe_tags rt ON rt.recipe_id = r.id
       WHERE ${conditions.join(" AND ")}
       GROUP BY r.id, u.display_name
       ORDER BY r.created_at DESC`,
            values
        );

        return res.status(200).json({
            recipes: result.rows.map(formatCookbookRecipe)
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                message: "Filtres de recherche invalides",
                fieldErrors: error.flatten().fieldErrors
            });
        }

        return next(error);
    }
});

cookbookRouter.post("/:id/recipes/:recipeId", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const params = cookbookRecipeParamsSchema.parse(req.params);
        const accessRole = await getCookbookAccess(params.id, authenticatedRequest.user.userId);

        if (!accessRole) {
            return res.status(404).json({
                message: "Cookbook introuvable"
            });
        }

        if (!canEditCookbook(accessRole)) {
            return res.status(403).json({
                message: "Vous ne pouvez pas modifier ce cookbook"
            });
        }

        const result = await pool.query(
            `UPDATE recipes
       SET cookbook_id = $1,
           updated_at = now()
       WHERE id = $2 AND owner_id = $3
       RETURNING id`,
            [params.id, params.recipeId, authenticatedRequest.user.userId]
        );

        if (!result.rows[0]) {
            return res.status(404).json({
                message: "Recette introuvable"
            });
        }

        return res.status(200).json({
            message: "Recette ajoutée au cookbook"
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

cookbookRouter.delete("/:id/recipes/:recipeId", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const params = cookbookRecipeParamsSchema.parse(req.params);
        const accessRole = await getCookbookAccess(params.id, authenticatedRequest.user.userId);

        if (!accessRole) {
            return res.status(404).json({
                message: "Cookbook introuvable"
            });
        }

        if (!canEditCookbook(accessRole)) {
            return res.status(403).json({
                message: "Vous ne pouvez pas modifier ce cookbook"
            });
        }

        const result = await pool.query(
            `UPDATE recipes
       SET cookbook_id = NULL,
           updated_at = now()
       WHERE id = $1 AND cookbook_id = $2
       RETURNING id`,
            [params.recipeId, params.id]
        );

        if (!result.rows[0]) {
            return res.status(404).json({
                message: "Recette introuvable dans ce cookbook"
            });
        }

        return res.status(200).json({
            message: "Recette retirée du cookbook"
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