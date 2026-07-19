import { Router } from "express";
import { z } from "zod";
import { pool } from "../database/pool";
import { requireAuth, type AuthenticatedRequest } from "../middleware/authMiddleware";

export const recipeRouter = Router();

const ingredientSchema = z.object({
    name: z.string().trim().min(1, "Le nom de l'ingrédient est obligatoire").max(160),
    quantity: z.string().trim().max(80).optional(),
    unit: z.string().trim().max(60).optional()
});

const createRecipeSchema = z.object({
    title: z.string().trim().min(1, "Le titre est obligatoire").max(180),
    description: z.string().trim().max(1000).optional(),
    preparationTime: z.number().int().min(0).max(1440),
    cookingTime: z.number().int().min(0).max(1440),
    portions: z.number().int().min(1).max(50),
    imageUrl: z.string().max(2500000).optional(),
    source: z.string().trim().max(1000).optional(),
    ingredients: z.array(ingredientSchema).min(1, "Au moins un ingrédient est obligatoire"),
    steps: z.array(z.string().trim().min(1).max(2000)).min(1, "Au moins une étape est obligatoire"),
    tags: z.array(z.string().trim().min(1).max(80)).max(20).optional()
});

const recipeParamsSchema = z.object({
    id: z.string().uuid("L'identifiant de la recette est invalide")
});

const listRecipesQuerySchema = z.object({
    q: z.string().trim().optional(),
    tag: z.string().trim().optional(),
    ingredient: z.string().trim().optional(),
    maxTotalTime: z.coerce.number().int().min(0).max(2880).optional(),
    maxPreparationTime: z.coerce.number().int().min(0).max(1440).optional(),
    maxCookingTime: z.coerce.number().int().min(0).max(1440).optional(),
    minPortions: z.coerce.number().int().min(1).max(50).optional(),
    favorite: z.enum(["true", "false"]).optional(),
    cookbookId: z.union([z.string().uuid("L'identifiant du cookbook est invalide"), z.literal("personal")]).optional(),
});

function formatRecipe(row: any) {
    const recipe: any = {
        id: row.id,
        title: row.title,
        description: row.description,
        preparationTime: row.preparation_time,
        cookingTime: row.cooking_time,
        portions: row.portions,
        imageUrl: row.image_url,
        source: row.source,
        cookbookId: row.cookbook_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };

    if (row.tags !== undefined) {
        recipe.tags = row.tags ?? [];
    }

    if (row.is_favorite !== undefined) {
        recipe.isFavorite = row.is_favorite;
    }

    return recipe;
}

async function getRecipeDetails(recipeId: string) {
    const recipeResult = await pool.query(
        `SELECT id, title, description, preparation_time, cooking_time, portions, image_url, source, cookbook_id, created_at, updated_at
         FROM recipes
         WHERE id = $1`,
        [recipeId]
    );

    const recipe = recipeResult.rows[0];

    if (!recipe) {
        return null;
    }

    const ingredientsResult = await pool.query(
        `SELECT id, name, quantity, unit, position
         FROM recipe_ingredients
         WHERE recipe_id = $1
         ORDER BY position ASC`,
        [recipeId]
    );

    const stepsResult = await pool.query(
        `SELECT id, instruction, position
         FROM recipe_steps
         WHERE recipe_id = $1
         ORDER BY position ASC`,
        [recipeId]
    );

    const tagsResult = await pool.query(
        `SELECT name
         FROM recipe_tags
         WHERE recipe_id = $1
         ORDER BY name ASC`,
        [recipeId]
    );

    return {
        ...formatRecipe(recipe),
        ingredients: ingredientsResult.rows.map((ingredient) => ({
            id: ingredient.id,
            name: ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            position: ingredient.position
        })),
        steps: stepsResult.rows.map((step) => ({
            id: step.id,
            instruction: step.instruction,
            position: step.position
        })),
        tags: tagsResult.rows.map((tag) => tag.name)
    };
}

recipeRouter.get("/", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const query = listRecipesQuerySchema.parse(req.query);
        const values: unknown[] = [authenticatedRequest.user.userId];
        const conditions = ["r.owner_id = $1"];
        let index = 2;

        if (query.cookbookId === "personal") {
            conditions.push("r.cookbook_id IS NULL");
        } else if (query.cookbookId) {
            values.push(query.cookbookId);
            conditions.push(`r.cookbook_id = $${index}`);
            index++;
        }

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
            conditions.push("(r.preparation_time + r.cooking_time) <= $" + index);
            index++;
        }

        if (query.maxPreparationTime !== undefined) {
            values.push(query.maxPreparationTime);
            conditions.push("r.preparation_time <= $" + index);
            index++;
        }

        if (query.maxCookingTime !== undefined) {
            values.push(query.maxCookingTime);
            conditions.push("r.cooking_time <= $" + index);
            index++;
        }

        if (query.minPortions !== undefined) {
            values.push(query.minPortions);
            conditions.push("r.portions >= $" + index);
            index++;
        }

        if (query.favorite === "true") {
            conditions.push(
                `EXISTS (
          SELECT 1
          FROM recipe_favorites favorites_filter
          WHERE favorites_filter.recipe_id = r.id AND favorites_filter.user_id = $1
        )`
            );
        }

        if (query.favorite === "false") {
            conditions.push(
                `NOT EXISTS (
          SELECT 1
          FROM recipe_favorites favorites_filter
          WHERE favorites_filter.recipe_id = r.id AND favorites_filter.user_id = $1
        )`
            );
        }

        const result = await pool.query(
            `SELECT r.id,
              r.title,
              r.description,
              r.preparation_time,
              r.cooking_time,
              r.portions,
              r.image_url,
              r.source,
              r.created_at,
              r.cookbook_id,
              r.updated_at,
              COALESCE(array_agg(DISTINCT rt.name) FILTER (WHERE rt.name IS NOT NULL), '{}') AS tags,
              EXISTS (
                SELECT 1
                FROM recipe_favorites rf
                WHERE rf.recipe_id = r.id AND rf.user_id = $1
              ) AS is_favorite
       FROM recipes r
       LEFT JOIN recipe_tags rt ON rt.recipe_id = r.id
       WHERE ${conditions.join(" AND ")}
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
            values
        );

        return res.status(200).json({
            recipes: result.rows.map(formatRecipe)
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

recipeRouter.post("/", requireAuth, async (req, res, next) => {
    const client = await pool.connect();

    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const data = createRecipeSchema.parse(req.body);

        await client.query("BEGIN");

        const recipeResult = await client.query(
            `INSERT INTO recipes (owner_id, title, description, preparation_time, cooking_time, portions, image_url, source)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id`,
            [
                authenticatedRequest.user.userId,
                data.title,
                data.description ?? null,
                data.preparationTime,
                data.cookingTime,
                data.portions,
                data.imageUrl ?? null,
                data.source ?? null
            ]
        );

        const recipeId = recipeResult.rows[0].id;

        for (const [index, ingredient] of data.ingredients.entries()) {
            await client.query(
                `INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit, position)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    recipeId,
                    ingredient.name,
                    ingredient.quantity ?? null,
                    ingredient.unit ?? null,
                    index + 1
                ]
            );
        }

        for (const [index, step] of data.steps.entries()) {
            await client.query(
                `INSERT INTO recipe_steps (recipe_id, instruction, position)
                 VALUES ($1, $2, $3)`,
                [recipeId, step, index + 1]
            );
        }

        for (const tag of data.tags ?? []) {
            await client.query(
                `INSERT INTO recipe_tags (recipe_id, name)
                 VALUES ($1, $2)`,
                [recipeId, tag]
            );
        }

        await client.query("COMMIT");

        const recipe = await getRecipeDetails(recipeId);

        return res.status(201).json({
            recipe
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

recipeRouter.put("/:id", requireAuth, async (req, res, next) => {
    const client = await pool.connect();

    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const params = recipeParamsSchema.parse(req.params);
        const data = createRecipeSchema.parse(req.body);

        await client.query("BEGIN");

        const recipeResult = await client.query(
            `UPDATE recipes
       SET title = $1,
           description = $2,
           preparation_time = $3,
           cooking_time = $4,
           portions = $5,
           image_url = $6,
           source = $7,
           updated_at = now()
       WHERE id = $8 AND owner_id = $9
       RETURNING id`,
            [
                data.title,
                data.description ?? null,
                data.preparationTime,
                data.cookingTime,
                data.portions,
                data.imageUrl ?? null,
                data.source ?? null,
                params.id,
                authenticatedRequest.user.userId
            ]
        );

        if (!recipeResult.rows[0]) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                message: "Recette introuvable"
            });
        }

        await client.query(
            "DELETE FROM recipe_ingredients WHERE recipe_id = $1",
            [params.id]
        );

        await client.query(
            "DELETE FROM recipe_steps WHERE recipe_id = $1",
            [params.id]
        );

        await client.query(
            "DELETE FROM recipe_tags WHERE recipe_id = $1",
            [params.id]
        );

        for (const [index, ingredient] of data.ingredients.entries()) {
            await client.query(
                `INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit, position)
         VALUES ($1, $2, $3, $4, $5)`,
                [
                    params.id,
                    ingredient.name,
                    ingredient.quantity ?? null,
                    ingredient.unit ?? null,
                    index + 1
                ]
            );
        }

        for (const [index, step] of data.steps.entries()) {
            await client.query(
                `INSERT INTO recipe_steps (recipe_id, instruction, position)
         VALUES ($1, $2, $3)`,
                [params.id, step, index + 1]
            );
        }

        for (const tag of data.tags ?? []) {
            await client.query(
                `INSERT INTO recipe_tags (recipe_id, name)
         VALUES ($1, $2)`,
                [params.id, tag]
            );
        }

        await client.query("COMMIT");

        const recipe = await getRecipeDetails(params.id);

        return res.status(200).json({
            recipe
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

recipeRouter.delete("/:id", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const params = recipeParamsSchema.parse(req.params);

        const result = await pool.query(
            `DELETE FROM recipes
       WHERE id = $1 AND owner_id = $2
       RETURNING id`,
            [params.id, authenticatedRequest.user.userId]
        );

        if (!result.rows[0]) {
            return res.status(404).json({
                message: "Recette introuvable"
            });
        }

        return res.status(200).json({
            message: "Recette supprimée"
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

recipeRouter.get("/favorites", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const result = await pool.query(
            `SELECT r.id, r.title, r.description, r.preparation_time, r.cooking_time, r.portions, r.image_url, r.source, r.cookbook_id, r.created_at, r.updated_at
       FROM recipe_favorites rf
       JOIN recipes r ON r.id = rf.recipe_id
       WHERE rf.user_id = $1
       ORDER BY rf.created_at DESC`,
            [authenticatedRequest.user.userId]
        );

        return res.status(200).json({
            recipes: result.rows.map(formatRecipe)
        });
    } catch (error) {
        return next(error);
    }
});

recipeRouter.post("/:id/favorite", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const params = recipeParamsSchema.parse(req.params);

        const recipeResult = await pool.query(
            `SELECT id
       FROM recipes
       WHERE id = $1 AND owner_id = $2`,
            [params.id, authenticatedRequest.user.userId]
        );

        if (!recipeResult.rows[0]) {
            return res.status(404).json({
                message: "Recette introuvable"
            });
        }

        await pool.query(
            `INSERT INTO recipe_favorites (user_id, recipe_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, recipe_id) DO NOTHING`,
            [authenticatedRequest.user.userId, params.id]
        );

        return res.status(200).json({
            message: "Recette ajoutée aux favoris"
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

recipeRouter.delete("/:id/favorite", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const params = recipeParamsSchema.parse(req.params);

        await pool.query(
            `DELETE FROM recipe_favorites
       WHERE user_id = $1 AND recipe_id = $2`,
            [authenticatedRequest.user.userId, params.id]
        );

        return res.status(200).json({
            message: "Recette retirée des favoris"
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

recipeRouter.get("/:id", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const params = recipeParamsSchema.parse(req.params);

        const accessResult = await pool.query(
            `SELECT id
       FROM recipes
       WHERE id = $1 AND owner_id = $2`,
            [params.id, authenticatedRequest.user.userId]
        );

        if (!accessResult.rows[0]) {
            return res.status(404).json({
                message: "Recette introuvable"
            });
        }

        const recipe = await getRecipeDetails(params.id);

        return res.status(200).json({
            recipe
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