const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/api";

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

type MeResponse = {
    user: User;
};

async function request<T>(path: string, options: RequestInit) {
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(data?.message ?? "Une erreur est survenue");
    }

    return data as T;
}

export function loginUser(email: string, password: string) {
    return request<AuthResponse>("/auth/login", {
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
    return request<AuthResponse>("/auth/register", {
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
    return request<MeResponse>("/auth/me", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}