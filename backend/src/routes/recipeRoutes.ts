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
    imageUrl: z.string().trim().max(1000).optional(),
    source: z.string().trim().max(1000).optional(),
    ingredients: z.array(ingredientSchema).min(1, "Au moins un ingrédient est obligatoire"),
    steps: z.array(z.string().trim().min(1).max(2000)).min(1, "Au moins une étape est obligatoire"),
    tags: z.array(z.string().trim().min(1).max(80)).max(20).optional()
});

const recipeParamsSchema = z.object({
    id: z.string().uuid("L'identifiant de la recette est invalide")
});

function formatRecipe(row: any) {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        preparationTime: row.preparation_time,
        cookingTime: row.cooking_time,
        portions: row.portions,
        imageUrl: row.image_url,
        source: row.source,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function getRecipeDetails(recipeId: string) {
    const recipeResult = await pool.query(
        `SELECT id, title, description, preparation_time, cooking_time, portions, image_url, source, created_at, updated_at
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

        const result = await pool.query(
            `SELECT id, title, description, preparation_time, cooking_time, portions, image_url, source, created_at, updated_at
             FROM recipes
             WHERE owner_id = $1
             ORDER BY created_at DESC`,
            [authenticatedRequest.user.userId]
        );

        return res.status(200).json({
            recipes: result.rows.map(formatRecipe)
        });
    } catch (error) {
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