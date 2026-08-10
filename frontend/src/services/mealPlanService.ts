import { ApiError } from "./authService";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/api";

export type MealPlan = {
    id: string;
    plannedDate: string;
    mealType: string;
    createdAt: string;
    recipe: {
        id: string;
        title: string;
        preparationTime: number;
        cookingTime: number;
        portions: number;
        imageUrl: string | null;
    };
};

export type CreateMealPlanPayload = {
    recipeId: string;
    plannedDate: string;
    mealType: string;
    shareWithCookbook?: boolean;
};

type MealPlansResponse = {
    mealPlans: MealPlan[];
};

type MealPlanResponse = {
    mealPlan: MealPlan;
};

type MessageResponse = {
    message: string;
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

export function getMealPlans(token: string) {
    return request<MealPlansResponse>("/meal-plans", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function createMealPlan(token: string, payload: CreateMealPlanPayload) {
    return request<MealPlanResponse>("/meal-plans", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });
}

export function deleteMealPlan(token: string, mealPlanId: string) {
    return request<MessageResponse>(`/meal-plans/${mealPlanId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}