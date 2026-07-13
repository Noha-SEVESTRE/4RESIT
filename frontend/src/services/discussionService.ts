import { ApiError } from "./authService";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/api";

export type DiscussionAuthor = {
    id: string;
    email: string;
    displayName: string;
};

export type RecipeComment = {
    id: string;
    content: string;
    createdAt: string;
    author: DiscussionAuthor;
};

export type CookbookMessage = {
    id: string;
    content: string;
    createdAt: string;
    author: DiscussionAuthor;
};

type RecipeCommentsResponse = {
    comments: RecipeComment[];
};

type RecipeCommentResponse = {
    comment: RecipeComment;
};

type CookbookMessagesResponse = {
    messages: CookbookMessage[];
};

type CookbookMessageResponse = {
    message: CookbookMessage;
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

export function getRecipeComments(token: string, recipeId: string) {
    return request<RecipeCommentsResponse>(`/recipes/${recipeId}/comments`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function createRecipeComment(token: string, recipeId: string, content: string) {
    return request<RecipeCommentResponse>(`/recipes/${recipeId}/comments`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            content
        })
    });
}

export function deleteRecipeComment(token: string, recipeId: string, commentId: string) {
    return request<MessageResponse>(`/recipes/${recipeId}/comments/${commentId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function getCookbookMessages(token: string, cookbookId: string) {
    return request<CookbookMessagesResponse>(`/cookbooks/${cookbookId}/messages`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function createCookbookMessage(token: string, cookbookId: string, content: string) {
    return request<CookbookMessageResponse>(`/cookbooks/${cookbookId}/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            content
        })
    });
}

export function deleteCookbookMessage(token: string, cookbookId: string, messageId: string) {
    return request<MessageResponse>(`/cookbooks/${cookbookId}/messages/${messageId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}