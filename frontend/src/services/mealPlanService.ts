import {apiRequest, type MessageResponse} from "./apiClient";

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

export function getMealPlans(token: string) {
    return apiRequest<MealPlansResponse>("/meal-plans", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function createMealPlan(token: string, payload: CreateMealPlanPayload) {
    return apiRequest<MealPlanResponse>("/meal-plans", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });
}

export function deleteMealPlan(token: string, mealPlanId: string) {
    return apiRequest<MessageResponse>(`/meal-plans/${mealPlanId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}