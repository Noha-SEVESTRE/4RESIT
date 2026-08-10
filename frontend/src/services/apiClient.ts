export const API_BASE_URL =
    import.meta.env.VITE_API_URL ?? "http://localhost:8080/api";

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
    fieldErrors: FieldErrors;

    constructor(message: string, fieldErrors: FieldErrors = {}) {
        super(message);
        this.name = "ApiError";
        this.fieldErrors = fieldErrors;
    }
}

type ApiRequestOptions = RequestInit & {
    token?: string;
};

export async function apiRequest<T>(
    path: string,
    options: ApiRequestOptions = {}
) {
    const {
        token,
        headers,
        ...requestOptions
    } = options;

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...requestOptions,
        headers: {
            ...(requestOptions.body
                ? { "Content-Type": "application/json" }
                : {}),
            ...(token
                ? { Authorization: `Bearer ${token}` }
                : {}),
            ...(headers ?? {})
        }
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new ApiError(
            data?.message ?? "Une erreur est survenue",
            data?.fieldErrors ?? data?.errors?.fieldErrors ?? {}
        );
    }

    return data as T;
}

export type MessageResponse = {
    message: string;
};