import {apiRequest, type MessageResponse} from "./apiClient";
import type {User} from "./authService.ts";

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

export type ChangeEmailPayload = {
    email: string;
    currentPassword: string;
};

type UserResponse = {
    user: User;
};

type SecurityResponse = {
    security: UserSecurity;
};

export function getUserPreferences(token: string) {
    return apiRequest<UserResponse>("/users/me/preferences", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function updateUserPreferences(token: string, payload: UpdatePreferencesPayload) {
    return apiRequest<UserResponse>("/users/me/preferences", {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });
}

export function getUserSecurity(token: string) {
    return apiRequest<SecurityResponse>("/users/me/security", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function changePassword(token: string, payload: ChangePasswordPayload) {
    return apiRequest<MessageResponse>("/users/me/password", {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });
}

export function changeEmail(token: string, payload: ChangeEmailPayload) {
    return apiRequest<UserResponse & MessageResponse>("/users/me/email", {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });
}