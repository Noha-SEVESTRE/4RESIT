import type { Recipe } from "./recipeService";
import {apiRequest, type MessageResponse} from "./apiClient";
import type { CookbookRole } from "../types/cookbook";

export type Cookbook = {
    id: string;
    name: string;
    description: string | null;
    createdBy: string;
    role: CookbookRole;
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
    role: CookbookRole;
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

export function getCookbooks(token: string) {
    return apiRequest<CookbooksResponse>("/cookbooks", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function createCookbook(token: string, name: string, description: string) {
    return apiRequest<CookbookResponse>("/cookbooks", {
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
    return apiRequest<CookbookResponse>(`/cookbooks/${cookbookId}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function getCookbookRecipes(token: string, cookbookId: string, filters: CookbookRecipeFilters = {}) {
    return apiRequest<CookbookRecipesResponse>(`/cookbooks/${cookbookId}/recipes${buildCookbookRecipesQuery(filters)}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function addCookbookMember(token: string, cookbookId: string, email: string, role: string) {
    return apiRequest<CookbookMemberResponse>(`/cookbooks/${cookbookId}/members`, {
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
    return apiRequest<MessageResponse>(`/cookbooks/${cookbookId}/members/${userId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function addRecipeToCookbook(token: string, cookbookId: string, recipeId: string) {
    return apiRequest<MessageResponse>(`/cookbooks/${cookbookId}/recipes/${recipeId}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function removeRecipeFromCookbook(token: string, cookbookId: string, recipeId: string) {
    return apiRequest<MessageResponse>(`/cookbooks/${cookbookId}/recipes/${recipeId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function deleteCookbook(token: string, cookbookId: string) {
    return apiRequest<MessageResponse>(`/cookbooks/${cookbookId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}