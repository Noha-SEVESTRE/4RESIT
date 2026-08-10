import { Router } from "express";
import { z } from "zod";
import { pool } from "../database/pool";
import { requireAuth, type AuthenticatedRequest } from "../middleware/authMiddleware";

export const mealPlanRouter = Router();

const createMealPlanSchema = z.object({
    recipeId: z.string().uuid("L'identifiant de la recette est invalide"),
    plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La date doit être au format YYYY-MM-DD"),
    mealType: z.string().trim().min(1, "Le type de repas est obligatoire").max(40),
    shareWithCookbook: z.boolean().optional().default(false)
});

const mealPlanParamsSchema = z.object({
    id: z.string().uuid("L'identifiant du planning est invalide")
});

function formatMealPlan(row: any) {
    return {
        id: row.id,
        plannedDate: row.planned_date,
        mealType: row.meal_type,
        createdAt: row.created_at,
        recipe: {
            id: row.recipe_id,
            title: row.recipe_title,
            preparationTime: row.preparation_time,
            cookingTime: row.cooking_time,
            portions: row.portions,
            imageUrl: row.image_url
        }
    };
}

mealPlanRouter.get("/", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        const result = await pool.query(
            `SELECT mp.id, mp.planned_date, mp.meal_type, mp.created_at,
                    r.id AS recipe_id, r.title AS recipe_title, r.preparation_time, r.cooking_time, r.portions, r.image_url
             FROM meal_plans mp
                      JOIN recipes r ON r.id = mp.recipe_id
             WHERE mp.user_id = $1
                OR EXISTS (
                 SELECT 1
                 FROM cookbook_members cm
                 WHERE cm.cookbook_id = mp.cookbook_id
                   AND cm.user_id = $1
             )
             ORDER BY mp.planned_date ASC, mp.created_at ASC`,
            [authenticatedRequest.user.userId]
        );

        return res.status(200).json({
            mealPlans: result.rows.map(formatMealPlan)
        });
    } catch (error) {
        return next(error);
    }
});

mealPlanRouter.post("/", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        const data = createMealPlanSchema.parse(req.body);

        const recipeResult = await pool.query(
            `SELECT r.id, r.cookbook_id
             FROM recipes r
                 LEFT JOIN cookbook_members cm
                     ON cm.cookbook_id = r.cookbook_id
                            AND cm.user_id = $2
             WHERE r.id = $1
               AND (
                 r.owner_id = $2
                     OR cm.user_id IS NOT NULL
                 )`,
            [data.recipeId, authenticatedRequest.user.userId]
        );

        if (!recipeResult.rows[0]) {
            return res.status(404).json({
                message: "Recette introuvable"
            });
        }

        const cookbookId = data.shareWithCookbook
            ? recipeResult.rows[0].cookbook_id
            : null;

        if (data.shareWithCookbook && !cookbookId) {
            return res.status(400).json({
                message: "Cette recette n'appartient pas à un cookbook"
            });
        }

        const result = await pool.query(
            `INSERT INTO meal_plans (user_id, cookbook_id, recipe_id, planned_date, meal_type)
             VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
            [
                authenticatedRequest.user.userId,
                cookbookId,
                data.recipeId,
                data.plannedDate,
                data.mealType
            ]
        );

        const mealPlanResult = await pool.query(
            `SELECT mp.id, mp.planned_date, mp.meal_type, mp.created_at,
              r.id AS recipe_id, r.title AS recipe_title, r.preparation_time, r.cooking_time, r.portions, r.image_url
       FROM meal_plans mp
       JOIN recipes r ON r.id = mp.recipe_id
       WHERE mp.id = $1`,
            [result.rows[0].id]
        );

        return res.status(201).json({
            mealPlan: formatMealPlan(mealPlanResult.rows[0])
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

mealPlanRouter.delete("/:id", requireAuth, async (req, res, next) => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;

        const params = mealPlanParamsSchema.parse(req.params);

        const result = await pool.query(
            `DELETE FROM meal_plans mp
       WHERE mp.id = $1
         AND (
             mp.user_id = $2
                 OR EXISTS (
                 SELECT 1
                 FROM cookbook_members cm
                 WHERE cm.cookbook_id = mp.cookbook_id
                   AND cm.user_id = $2
                   AND cm.role IN ('OWNER', 'EDITOR')
                 )
             )
           RETURNING mp.id`,
            [params.id, authenticatedRequest.user.userId]
        );

        if (!result.rows[0]) {
            return res.status(404).json({
                message: "Repas planifié introuvable"
            });
        }

        return res.status(200).json({
            message: "Repas retiré du planning"
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                message: "Identifiant de planning invalide",
                fieldErrors: error.flatten().fieldErrors
            });
        }

        return next(error);
    }
});