import { Router } from "express";
import { z } from "zod";
import { pool } from "../database/pool";
import { requireAuth, type AuthenticatedRequest } from "../middleware/authMiddleware";

export const dataImportExportRouter = Router();

const ingredientSchema = z.object({
    name: z.string().trim().min(1).max(160),
    quantity: z.string().trim().max(80).optional().default(""),
    unit: z.string().trim().max(60).optional().default("")
});

const exportedRecipeSchema = z.object({
    title: z.string().trim().min(1).max(180),
    description: z.string().trim().max(2000).optional().default(""),
    preparationTime: z.coerce.number().int().min(0).default(0),
    cookingTime: z.coerce.number().int().min(0).default(0),
    portions: z.coerce.number().int().min(1).default(2),
    imageUrl: z.string().max(2500000).optional().default(""),
    source: z.string().trim().max(1000).optional().default("Import SUPMEAL"),
    ingredients: z.array(ingredientSchema).min(1),
    steps: z.array(z.string().trim().min(1).max(2000)).min(1),
    tags: z.array(z.string().trim().min(1).max(80)).optional().default([])
});

const exportedCookbookSchema = z.object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).optional().default(""),
    recipes: z.array(exportedRecipeSchema).optional().default([])
});

const fullImportSchema = z.object({
    type: z.literal("SUPMEAL_FULL_EXPORT"),
    version: z.number().int().min(1),
    data: z.object({
        personalRecipes: z.array(exportedRecipeSchema).optional().default([]),
        cookbooks: z.array(exportedCookbookSchema).optional().default([])
    })
});

function getAuthenticatedUserId(req: AuthenticatedRequest) {
    return req.user?.userId ?? null;
}

async function getRecipeIngredients(client: any, recipeId: string) {
    const result = await client.query(
        `SELECT name, quantity, unit
         FROM recipe_ingredients
         WHERE recipe_id = $1
         ORDER BY position ASC`,
        [recipeId]
    );

    return result.rows.map((ingredient: any) => ({
        name: ingredient.name,
        quantity: ingredient.quantity ?? "",
        unit: ingredient.unit ?? ""
    }));
}

async function getRecipeSteps(client: any, recipeId: string) {
    const result = await client.query(
        `SELECT instruction
         FROM recipe_steps
         WHERE recipe_id = $1
         ORDER BY position ASC`,
        [recipeId]
    );

    return result.rows.map((step: any) => step.instruction);
}

async function getRecipeTags(client: any, recipeId: string) {
    const result = await client.query(
        `SELECT name
         FROM recipe_tags
         WHERE recipe_id = $1
         ORDER BY name ASC`,
        [recipeId]
    );

    return result.rows.map((tag: any) => tag.name);
}

async function formatRecipeForExport(client: any, recipe: any) {
    const [ingredients, steps, tags] = await Promise.all([
        getRecipeIngredients(client, recipe.id),
        getRecipeSteps(client, recipe.id),
        getRecipeTags(client, recipe.id)
    ]);

    return {
        title: recipe.title,
        description: recipe.description ?? "",
        preparationTime: recipe.preparation_time,
        cookingTime: recipe.cooking_time,
        portions: recipe.portions,
        imageUrl: recipe.image_url ?? "",
        source: recipe.source ?? "",
        ingredients,
        steps,
        tags
    };
}

async function insertImportedRecipe(client: any, userId: string, recipe: z.infer<typeof exportedRecipeSchema>, cookbookId: string | null) {
    const recipeResult = await client.query(
        `INSERT INTO recipes (
             owner_id,
             cookbook_id,
             title,
             description,
             preparation_time,
             cooking_time,
             portions,
             image_url,
             source
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
            userId,
            cookbookId,
            recipe.title,
            recipe.description || null,
            recipe.preparationTime,
            recipe.cookingTime,
            recipe.portions,
            recipe.imageUrl || null,
            recipe.source || "Import SUPMEAL"
        ]
    );

    const recipeId = recipeResult.rows[0].id;

    for (const [index, ingredient] of recipe.ingredients.entries()) {
        await client.query(
            `INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit, position)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                recipeId,
                ingredient.name,
                ingredient.quantity || null,
                ingredient.unit || null,
                index + 1
            ]
        );
    }

    for (const [index, step] of recipe.steps.entries()) {
        await client.query(
            `INSERT INTO recipe_steps (recipe_id, instruction, position)
             VALUES ($1, $2, $3)`,
            [recipeId, step, index + 1]
        );
    }

    for (const tag of recipe.tags) {
        await client.query(
            `INSERT INTO recipe_tags (recipe_id, name)
             VALUES ($1, $2)`,
            [recipeId, tag]
        );
    }

    return recipeId;
}

dataImportExportRouter.get("/export", requireAuth, async (req, res, next) => {
    const client = await pool.connect();

    try {
        const userId = getAuthenticatedUserId(req as AuthenticatedRequest);

        if (!userId) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const personalRecipesResult = await client.query(
            `SELECT id,
                    title,
                    description,
                    preparation_time,
                    cooking_time,
                    portions,
                    image_url,
                    source
             FROM recipes
             WHERE owner_id = $1 AND cookbook_id IS NULL
             ORDER BY created_at ASC`,
            [userId]
        );

        const cookbooksResult = await client.query(
            `SELECT c.id,
                    c.name,
                    c.description
             FROM cookbooks c
             JOIN cookbook_members cm ON cm.cookbook_id = c.id
             WHERE cm.user_id = $1
             ORDER BY c.created_at ASC`,
            [userId]
        );

        const personalRecipes = [];

        for (const recipe of personalRecipesResult.rows) {
            personalRecipes.push(await formatRecipeForExport(client, recipe));
        }

        const cookbooks = [];

        for (const cookbook of cookbooksResult.rows) {
            const recipesResult = await client.query(
                `SELECT id,
                        title,
                        description,
                        preparation_time,
                        cooking_time,
                        portions,
                        image_url,
                        source
                 FROM recipes
                 WHERE cookbook_id = $1
                 ORDER BY created_at ASC`,
                [cookbook.id]
            );

            const recipes = [];

            for (const recipe of recipesResult.rows) {
                recipes.push(await formatRecipeForExport(client, recipe));
            }

            cookbooks.push({
                name: cookbook.name,
                description: cookbook.description ?? "",
                recipes
            });
        }

        return res.status(200).json({
            type: "SUPMEAL_FULL_EXPORT",
            version: 1,
            exportedAt: new Date().toISOString(),
            warning: "Ce fichier contient des données lisibles en clair.",
            data: {
                personalRecipes,
                cookbooks
            }
        });
    } catch (error) {
        return next(error);
    } finally {
        client.release();
    }
});

dataImportExportRouter.post("/import", requireAuth, async (req, res, next) => {
    const client = await pool.connect();

    try {
        const userId = getAuthenticatedUserId(req as AuthenticatedRequest);

        if (!userId) {
            return res.status(401).json({
                message: "Utilisateur non authentifié"
            });
        }

        const data = fullImportSchema.parse(req.body);
        let importedRecipes = 0;
        let importedCookbooks = 0;

        await client.query("BEGIN");

        for (const recipe of data.data.personalRecipes) {
            await insertImportedRecipe(client, userId, recipe, null);
            importedRecipes++;
        }

        for (const cookbook of data.data.cookbooks) {
            const cookbookResult = await client.query(
                `INSERT INTO cookbooks (name, description, created_by)
                 VALUES ($1, $2, $3)
                 RETURNING id`,
                [
                    cookbook.name,
                    cookbook.description || null,
                    userId
                ]
            );

            const cookbookId = cookbookResult.rows[0].id;

            await client.query(
                `INSERT INTO cookbook_members (cookbook_id, user_id, role)
                 VALUES ($1, $2, 'OWNER')`,
                [cookbookId, userId]
            );

            importedCookbooks++;

            for (const recipe of cookbook.recipes) {
                await insertImportedRecipe(client, userId, recipe, cookbookId);
                importedRecipes++;
            }
        }

        await client.query("COMMIT");

        return res.status(201).json({
            message: "Données importées avec succès",
            summary: {
                importedRecipes,
                importedCookbooks
            }
        });
    } catch (error) {
        await client.query("ROLLBACK");

        if (error instanceof z.ZodError) {
            return res.status(400).json({
                message: "Le fichier importé n'est pas un export SUPMEAL valide",
                fieldErrors: error.flatten().fieldErrors
            });
        }

        return next(error);
    } finally {
        client.release();
    }
});