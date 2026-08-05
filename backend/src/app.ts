import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { pool } from "./database/pool";
import { authRouter } from "./routes/authRoutes";
import { userRouter } from "./routes/userRoutes";
import { recipeRouter } from "./routes/recipeRoutes";
import { mealPlanRouter } from "./routes/mealPlanRoutes";
import { cookbookRouter } from "./routes/cookbookRoutes";
import { discussionRouter } from "./routes/discussionRoutes";
import { recipeImportExportRouter } from "./routes/recipeImportExportRoutes";
import { oauthRouter } from "./routes/oauthRoutes";
import { dataImportExportRouter } from "./routes/dataImportExportRoutes";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(morgan("dev"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/api/health", (_req, res) => {
    res.status(200).json({
        status: "ok",
        service: "supmeal-api"
    });
});

app.get("/api/db-health", async (_req, res, next) => {
    try {
        const result = await pool.query(
            "select current_database() as database, current_user as user, now() as checked_at"
        );

        res.status(200).json({
            status: "ok",
            database: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/recipes", recipeRouter);
app.use("/api/meal-plans", mealPlanRouter);
app.use("/api/cookbooks", cookbookRouter);
app.use("/api", discussionRouter);
app.use("/api/recipes", recipeImportExportRouter);
app.use("/api/auth", oauthRouter);
app.use("/api/data", dataImportExportRouter);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : "Unexpected error";

    res.status(500).json({
        status: "error",
        message
    });
});