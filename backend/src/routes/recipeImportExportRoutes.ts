import { Router } from "express";
import { z } from "zod";
import { pool } from "../database/pool";
import { requireAuth, type AuthenticatedRequest } from "../middleware/authMiddleware";

export const recipeImportExportRouter = Router();

const recipeParamsSchema = z.object({
    id: z.string().uuid("L'identifiant de la recette est invalide")
});

const ingredientSchema = z.object({
    name: z.string().trim().min(1, "Le nom de l'ingrédient est obligatoire").max(160),
    quantity: z.string().trim().max(80).optional().default(""),
    unit: z.string().trim().max(60).optional().default("")
});

const importedRecipeSchema = z.object({
    title: z.string().trim().min(1, "Le titre est obligatoire").max(180),
    description: z.string().trim().max(2000).optional().default(""),
    preparationTime: z.coerce.number().int().min(0).default(0),
    cookingTime: z.coerce.number().int().min(0).default(0),
    portions: z.coerce.number().int().min(1).default(2),
    imageUrl: z.string().max(2500000).optional().default(""),
    source: z.string().trim().max(500).optional().default("Import SUPMEAL"),
    ingredients: z.array(ingredientSchema).min(1, "La recette doit contenir au moins un ingrédient"),
    steps: z.array(z.string().trim().min(1).max(2000)).min(1, "La recette doit contenir au moins une étape"),
    tags: z.array(z.string().trim().min(1).max(80)).optional().default([])
});

const importRecipeSchema = z.object({
    recipe: importedRecipeSchema
});

function formatExportedRecipe(recipe: any, ingredients: any[], steps: any[], tags: any[]) {
    return {
        type: "SUPMEAL_RECIPE_EXPORT",
        version: 1,
        exportedAt: new Date().toISOString(),
        recipe: {
            title: recipe.title,
            description: recipe.description ?? "",
            preparationTime: recipe.preparation_time,
            cookingTime: recipe.cooking_time,
            portions: recipe.portions,
            imageUrl: recipe.image_url ?? "",
            source: recipe.source ?? "",
            ingredients: ingredients.map((ingredient) => ({
                name: ingredient.name,
                quantity: ingredient.quantity ?? "",
                unit: ingredient.unit ?? ""
            })),
            steps: steps.map((step) => step.instruction),
            tags: tags.map((tag) => tag.name)
        }
    };
}

recipeImportExportRouter.get("/:id/export", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const params = recipeParamsSchema.parse(req.params);

        const recipeResult = await pool.query(
            `SELECT id,
              owner_id,
              title,
              description,
              preparation_time,
              cooking_time,
              portions,
              image_url,
              source
       FROM recipes
       WHERE id = $1 AND owner_id = $2`,
            [params.id, authenticatedRequest.user.userId]
        );

        const recipe = recipeResult.rows[0];

        if (!recipe) {
            return res.status(404).json({
                message: "Recette introuvable"
            });
        }

        const ingredientsResult = await pool.query(
            `SELECT name, quantity, unit
       FROM recipe_ingredients
       WHERE recipe_id = $1
       ORDER BY position ASC`,
            [params.id]
        );

        const stepsResult = await pool.query(
            `SELECT instruction
       FROM recipe_steps
       WHERE recipe_id = $1
       ORDER BY position ASC`,
            [params.id]
        );

        const tagsResult = await pool.query(
            `SELECT name
       FROM recipe_tags
       WHERE recipe_id = $1
       ORDER BY name ASC`,
            [params.id]
        );

        return res.status(200).json(
            formatExportedRecipe(
                recipe,
                ingredientsResult.rows,
                stepsResult.rows,
                tagsResult.rows
            )
        );
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

recipeImportExportRouter.post("/import", requireAuth, async (req, res, next) => {
    const client = await pool.connect();

    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        if (!authenticatedRequest.user) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const data = importRecipeSchema.parse(req.body);

        await client.query("BEGIN");

        const recipeResult = await client.query(
            `INSERT INTO recipes (
         owner_id,
         title,
         description,
         preparation_time,
         cooking_time,
         portions,
         image_url,
         source
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, title`,
            [
                authenticatedRequest.user.userId,
                data.recipe.title,
                data.recipe.description,
                data.recipe.preparationTime,
                data.recipe.cookingTime,
                data.recipe.portions,
                data.recipe.imageUrl || null,
                data.recipe.source || "Import SUPMEAL"
            ]
        );

        const recipe = recipeResult.rows[0];

        for (const [index, ingredient] of data.recipe.ingredients.entries()) {
            await client.query(
                `INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit, position)
         VALUES ($1, $2, $3, $4, $5)`,
                [
                    recipe.id,
                    ingredient.name,
                    ingredient.quantity || null,
                    ingredient.unit || null,
                    index
                ]
            );
        }

        for (const [index, step] of data.recipe.steps.entries()) {
            await client.query(
                `INSERT INTO recipe_steps (recipe_id, instruction, position)
         VALUES ($1, $2, $3)`,
                [
                    recipe.id,
                    step,
                    index
                ]
            );
        }

        for (const tag of data.recipe.tags) {
            await client.query(
                `INSERT INTO recipe_tags (recipe_id, name)
         VALUES ($1, $2)`,
                [
                    recipe.id,
                    tag
                ]
            );
        }

        await client.query("COMMIT");

        return res.status(201).json({
            message: "Recette importée avec succès",
            recipe: {
                id: recipe.id,
                title: recipe.title
            }
        });
    } catch (error) {
        await client.query("ROLLBACK");

        if (error instanceof z.ZodError) {
            return res.status(400).json({
                message: "Le fichier importé n'est pas valide",
                fieldErrors: error.flatten().fieldErrors
            });
        }

        return next(error);
    } finally {
        client.release();
    }
});