import { ApiError } from "./authService";
import type { Recipe } from "./recipeService";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/api";

export type Cookbook = {
    id: string;
    name: string;
    description: string | null;
    createdBy: string;
    role: "OWNER" | "EDITOR" | "READER" | "COMMENTATOR";
    recipeCount: number;
    createdAt: string;
    updatedAt: string;
};

export type CookbookRecipeFilters = {
    q?: string;
    tag?: string;
    ingredient?: string;
    maxTotalTime?: number;
};

export type CookbookMember = {
    id: string;
    email: string;
    displayName: string;
    role: "OWNER" | "EDITOR" | "READER" | "COMMENTATOR";
    createdAt: string;
};

export type CookbookRecipe = Recipe & {
    owner?: {
        id: string;
        displayName: string;
    };
};

type CookbooksResponse = {
    cookbooks: Cookbook[];
};

type CookbookResponse = {
    cookbook: Cookbook;
    members?: CookbookMember[];
};

type CookbookRecipesResponse = {
    recipes: CookbookRecipe[];
};

type CookbookMemberResponse = {
    member: CookbookMember;
};

type MessageResponse = {
    message: string;
};

function buildCookbookRecipesQuery(filters: CookbookRecipeFilters) {
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

    const query = params.toString();

    return query ? `?${query}` : "";
}

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

export function getCookbooks(token: string) {
    return request<CookbooksResponse>("/cookbooks", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function createCookbook(token: string, name: string, description: string) {
    return request<CookbookResponse>("/cookbooks", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            name,
            description
        })
    });
}

export function getCookbook(token: string, cookbookId: string) {
    return request<CookbookResponse>(`/cookbooks/${cookbookId}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function getCookbookRecipes(token: string, cookbookId: string, filters: CookbookRecipeFilters = {}) {
    return request<CookbookRecipesResponse>(`/cookbooks/${cookbookId}/recipes${buildCookbookRecipesQuery(filters)}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function addCookbookMember(token: string, cookbookId: string, email: string, role: string) {
    return request<CookbookMemberResponse>(`/cookbooks/${cookbookId}/members`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            email,
            role
        })
    });
}

export function removeCookbookMember(token: string, cookbookId: string, userId: string) {
    return request<MessageResponse>(`/cookbooks/${cookbookId}/members/${userId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function addRecipeToCookbook(token: string, cookbookId: string, recipeId: string) {
    return request<MessageResponse>(`/cookbooks/${cookbookId}/recipes/${recipeId}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function removeRecipeFromCookbook(token: string, cookbookId: string, recipeId: string) {
    return request<MessageResponse>(`/cookbooks/${cookbookId}/recipes/${recipeId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function deleteCookbook(token: string, cookbookId: string) {
    return request<MessageResponse>(`/cookbooks/${cookbookId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}