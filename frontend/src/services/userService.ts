import { ApiError, type User } from "./authService";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/api";

export type UpdatePreferencesPayload = {
    displayName?: string;
    defaultPortions?: number;
    dietaryPreferences?: {
        diet?: string;
        allergies?: string[];
        favoriteCuisine?: string;
    };
};

export type UserSecurity = {
    email: string;
    hasPassword: boolean;
    oauthProviders: string[];
    canChangePassword: boolean;
};

export type ChangePasswordPayload = {
    currentPassword: string;
    newPassword: string;
    newPasswordConfirmation: string;
};

type UserResponse = {
    user: User;
};

type SecurityResponse = {
    security: UserSecurity;
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

export function getUserPreferences(token: string) {
    return request<UserResponse>("/users/me/preferences", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function updateUserPreferences(token: string, payload: UpdatePreferencesPayload) {
    return request<UserResponse>("/users/me/preferences", {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });
}

export function getUserSecurity(token: string) {
    return request<SecurityResponse>("/users/me/security", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function changePassword(token: string, payload: ChangePasswordPayload) {
    return request<MessageResponse>("/users/me/password", {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });
}