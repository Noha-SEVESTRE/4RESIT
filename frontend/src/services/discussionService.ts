import {apiRequest, type MessageResponse} from "./apiClient";

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

export function getRecipeComments(token: string, recipeId: string) {
    return apiRequest<RecipeCommentsResponse>(`/recipes/${recipeId}/comments`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function createRecipeComment(token: string, recipeId: string, content: string) {
    return apiRequest<RecipeCommentResponse>(`/recipes/${recipeId}/comments`, {
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
    return apiRequest<MessageResponse>(`/recipes/${recipeId}/comments/${commentId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function getCookbookMessages(token: string, cookbookId: string) {
    return apiRequest<CookbookMessagesResponse>(`/cookbooks/${cookbookId}/messages`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function createCookbookMessage(token: string, cookbookId: string, content: string) {
    return apiRequest<CookbookMessageResponse>(`/cookbooks/${cookbookId}/messages`, {
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
    return apiRequest<MessageResponse>(`/cookbooks/${cookbookId}/messages/${messageId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}