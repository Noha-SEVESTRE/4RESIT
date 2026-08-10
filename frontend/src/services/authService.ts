import {API_BASE_URL, apiRequest} from "./apiClient";

export type User = {
    id: string;
    email: string;
    displayName: string;
    dietaryPreferences: Record<string, unknown>;
    defaultPortions: number;
    createdAt: string;
    updatedAt?: string;
};

type AuthResponse = {
    token: string;
    user: User;
};

export function loginUser(email: string, password: string) {
    return apiRequest<AuthResponse>("/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email,
            password
        })
    });
}

export function registerUser(displayName: string, email: string, password: string) {
    return apiRequest<AuthResponse>("/auth/register", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            displayName,
            email,
            password
        })
    });
}

export function getCurrentUser(token: string) {
    return apiRequest<AuthResponse>("/auth/me", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function startGitHubLogin() {
    window.location.href = `${API_BASE_URL}/auth/github`;
}

export function startGoogleLogin() {
    window.location.href = `${API_BASE_URL}/auth/google`;
}