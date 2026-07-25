import type { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { pool } from "../database/pool";
import { type AuthTokenPayload, verifyToken } from "../utils/token";

type AuthenticatedSocket = Socket & {
    user?: AuthTokenPayload;
};

type SocketAuth = {
    token?: unknown;
};

export type RealtimeCookbookMessage = {
    id: string;
    content: string;
    createdAt: string;
    author: {
        id: string;
        email: string;
        displayName: string;
    };
};

export type RealtimeCookbookUpdate = {
    type: "member-updated" | "member-removed" | "recipe-added" | "recipe-removed";
    label: string;
};

let io: Server | null = null;

function getRoomName(cookbookId: string) {
    return `cookbook:${cookbookId}`;
}

function getSocketToken(socket: Socket) {
    const auth = socket.handshake.auth as SocketAuth;

    return typeof auth.token === "string" ? auth.token : "";
}

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function canAccessCookbook(cookbookId: string, userId: string) {
    const result = await pool.query(
        `SELECT 1
         FROM cookbook_members
         WHERE cookbook_id = $1 AND user_id = $2`,
        [cookbookId, userId]
    );

    return Boolean(result.rows[0]);
}

export function initializeSocket(server: HttpServer) {
    io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL ?? "http://localhost:8081",
            methods: ["GET", "POST"]
        }
    });

    io.use((socket, next) => {
        try {
            const token = getSocketToken(socket);

            if (!token) {
                return next(new Error("Token manquant"));
            }

            const authenticatedSocket = socket as AuthenticatedSocket;
            authenticatedSocket.user = verifyToken(token);

            return next();
        } catch (_error) {
            return next(new Error("Token invalide"));
        }
    });

    io.on("connection", (socket) => {
        const authenticatedSocket = socket as AuthenticatedSocket;

        socket.on("cookbook:join", async (cookbookId: string) => {
            try {
                if (!authenticatedSocket.user || !isUuid(cookbookId)) {
                    return;
                }

                const hasAccess = await canAccessCookbook(cookbookId, authenticatedSocket.user.userId);

                if (!hasAccess) {
                    socket.emit("cookbook:error", {
                        message: "Accès au cookbook refusé"
                    });
                    return;
                }

                socket.join(getRoomName(cookbookId));
                socket.emit("cookbook:joined", {
                    cookbookId
                });
            } catch (_error) {
                socket.emit("cookbook:error", {
                    message: "Impossible de rejoindre le cookbook"
                });
            }
        });

        socket.on("cookbook:leave", (cookbookId: string) => {
            if (!isUuid(cookbookId)) {
                return;
            }

            socket.leave(getRoomName(cookbookId));
        });
    });

    return io;
}

export function emitCookbookMessageCreated(cookbookId: string, message: RealtimeCookbookMessage) {
    io?.to(getRoomName(cookbookId)).emit("cookbook:message-created", {
        cookbookId,
        message
    });
}

export function emitCookbookMessageDeleted(cookbookId: string, messageId: string) {
    io?.to(getRoomName(cookbookId)).emit("cookbook:message-deleted", {
        cookbookId,
        messageId
    });
}

export function emitCookbookUpdated(cookbookId: string, update: RealtimeCookbookUpdate) {
    io?.to(getRoomName(cookbookId)).emit("cookbook:updated", {
        cookbookId,
        update
    });
}