import type { RecipeIngredientInput } from "./recipeService";
import { apiRequest } from "./apiClient";

export type FullExportedRecipe = {
    title: string;
    description: string;
    preparationTime: number;
    cookingTime: number;
    portions: number;
    imageUrl: string;
    source: string;
    ingredients: RecipeIngredientInput[];
    steps: string[];
    tags: string[];
};

export type FullExportedCookbook = {
    name: string;
    description: string;
    recipes: FullExportedRecipe[];
};

export type FullDataExport = {
    type: "SUPMEAL_FULL_EXPORT";
    version: number;
    exportedAt: string;
    warning: string;
    data: {
        personalRecipes: FullExportedRecipe[];
        cookbooks: FullExportedCookbook[];
    };
};

export type FullImportResponse = {
    message: string;
    summary: {
        importedRecipes: number;
        importedCookbooks: number;
    };
};

export function exportAllData(token: string) {
    return apiRequest<FullDataExport>("/data/export", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function importAllData(token: string, payload: FullDataExport) {
    return apiRequest<FullImportResponse>("/data/import", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });
}