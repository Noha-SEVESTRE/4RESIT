import { ApiError } from "./authService";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/api";

export type Recipe = {
    id: string;
    title: string;
    description: string | null;
    preparationTime: number;
    cookingTime: number;
    portions: number;
    imageUrl: string | null;
    source: string | null;
    createdAt: string;
    updatedAt: string;
    tags?: string[];
    isFavorite?: boolean;
    ingredients?: RecipeIngredient[];
    steps?: RecipeStep[];
};

export type RecipeFilters = {
    q?: string;
    tag?: string;
    ingredient?: string;
    maxTotalTime?: number;
    maxPreparationTime?: number;
    maxCookingTime?: number;
    minPortions?: number;
    favorite?: "true" | "false";
};

export type RecipeIngredientInput = {
    name: string;
    quantity?: string;
    unit?: string;
};

export type CreateRecipePayload = {
    title: string;
    description?: string;
    preparationTime: number;
    cookingTime: number;
    portions: number;
    imageUrl?: string;
    source?: string;
    ingredients: RecipeIngredientInput[];
    steps: string[];
    tags?: string[];
};

export type RecipeIngredient = {
    id: string;
    name: string;
    quantity: string | null;
    unit: string | null;
    position: number;
};

export type RecipeStep = {
    id: string;
    instruction: string;
    position: number;
};

export type ExportedRecipe = {
    type: "SUPMEAL_RECIPE_EXPORT";
    version: number;
    exportedAt: string;
    recipe: {
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
};

type RecipeResponse = {
    recipe: Recipe;
};

type RecipesResponse = {
    recipes: Recipe[];
};

type MessageResponse = {
    message: string;
};

type ImportRecipeResponse = {
    message: string;
    recipe: {
        id: string;
        title: string;
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

function buildQuery(filters: RecipeFilters) {
    const params = new URLSearchParams();

    if (filters.q) {
        params.set("q", filters.q);
    }

    if (filters.tag) {
        params.set("tag", filters.tag);
    }

    if (filters.ingredient) {
        params.set("ingredient", filters.ingredient);
    }

    if (filters.maxTotalTime !== undefined) {
        params.set("maxTotalTime", String(filters.maxTotalTime));
    }

    if (filters.maxPreparationTime !== undefined) {
        params.set("maxPreparationTime", String(filters.maxPreparationTime));
    }

    if (filters.maxCookingTime !== undefined) {
        params.set("maxCookingTime", String(filters.maxCookingTime));
    }

    if (filters.minPortions !== undefined) {
        params.set("minPortions", String(filters.minPortions));
    }

    if (filters.favorite) {
        params.set("favorite", filters.favorite);
    }

    const query = params.toString();

    return query ? `?${query}` : "";
}

export function getRecipes(token: string, filters: RecipeFilters = {}) {
    return request<RecipesResponse>(`/recipes${buildQuery(filters)}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function addRecipeToFavorites(token: string, recipeId: string) {
    return request<MessageResponse>(`/recipes/${recipeId}/favorite`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function removeRecipeFromFavorites(token: string, recipeId: string) {
    return request<MessageResponse>(`/recipes/${recipeId}/favorite`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function createRecipe(token: string, payload: CreateRecipePayload) {
    return request<RecipeResponse>("/recipes", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });
}

export function getRecipe(token: string, recipeId: string) {
    return request<RecipeResponse>(`/recipes/${recipeId}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function updateRecipe(token: string, recipeId: string, payload: CreateRecipePayload) {
    return request<RecipeResponse>(`/recipes/${recipeId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });
}

export function deleteRecipe(token: string, recipeId: string) {
    return request<MessageResponse>(`/recipes/${recipeId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function exportRecipe(token: string, recipeId: string) {
    return request<ExportedRecipe>(`/recipes/${recipeId}/export`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function importRecipe(token: string, payload: ExportedRecipe) {
    return request<ImportRecipeResponse>("/recipes/import", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });
}