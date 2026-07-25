import { io, type Socket } from "socket.io-client";
import type { CookbookMessage } from "./discussionService";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/api";
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, "");

export type CookbookMessageCreatedPayload = {
    cookbookId: string;
    message: CookbookMessage;
};

export type CookbookMessageDeletedPayload = {
    cookbookId: string;
    messageId: string;
};

export type CookbookUpdatedPayload = {
    cookbookId: string;
    update: {
        type: "member-updated" | "member-removed" | "recipe-added" | "recipe-removed";
        label: string;
    };
};

let socket: Socket | null = null;

export function connectRealtime(token: string) {
    if (socket?.connected) {
        return socket;
    }

    socket = io(SOCKET_URL, {
        auth: {
            token
        },
        transports: ["websocket", "polling"]
    });

    return socket;
}

export function disconnectRealtime() {
    socket?.disconnect();
    socket = null;
}

export function joinCookbookRoom(cookbookId: string) {
    socket?.emit("cookbook:join", cookbookId);
}

export function leaveCookbookRoom(cookbookId: string) {
    socket?.emit("cookbook:leave", cookbookId);
}

export function onCookbookMessageCreated(callback: (payload: CookbookMessageCreatedPayload) => void) {
    socket?.on("cookbook:message-created", callback);

    return () => {
        socket?.off("cookbook:message-created", callback);
    };
}

export function onCookbookMessageDeleted(callback: (payload: CookbookMessageDeletedPayload) => void) {
    socket?.on("cookbook:message-deleted", callback);

    return () => {
        socket?.off("cookbook:message-deleted", callback);
    };
}

export function onCookbookUpdated(callback: (payload: CookbookUpdatedPayload) => void) {
    socket?.on("cookbook:updated", callback);

    return () => {
        socket?.off("cookbook:updated", callback);
    };
}