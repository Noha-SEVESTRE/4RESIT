import { ApiError } from "./authService";
import type { RecipeIngredientInput } from "./recipeService";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/api";

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

async function request<T>(path: string, options: RequestInit) {
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new ApiError(
            data?.message ?? "Une erreur est survenue",
            data?.fieldErrors ?? data?.errors?.fieldErrors ?? {}
        );
    }

    return data as T;
}

export function exportAllData(token: string) {
    return request<FullDataExport>("/data/export", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function importAllData(token: string, payload: FullDataExport) {
    return request<FullImportResponse>("/data/import", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });
}