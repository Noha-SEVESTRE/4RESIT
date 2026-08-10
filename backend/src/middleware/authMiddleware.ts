import type { NextFunction, Request, Response } from "express";
import { type AuthTokenPayload, verifyToken } from "../utils/token";

export type AuthenticatedRequest = Request & {
    user: AuthTokenPayload;
};

function getBearerToken(authorizationHeader: string | undefined) {
    if (!authorizationHeader) {
        return null;
    }

    if (!authorizationHeader.startsWith("Bearer ")) {
        return null;
    }

    return authorizationHeader.slice(7);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    try {
        const token = getBearerToken(req.headers.authorization);

        if (!token) {
            return res.status(401).json({
                message: "Token manquant"
            });
        }

        const payload = verifyToken(token);
        const authenticatedRequest = req as AuthenticatedRequest;

        authenticatedRequest.user = payload;

        return next();
    } catch (_error) {
        return res.status(401).json({
            message: "Token invalide"
        });
    }
}