import jwt, { type SignOptions } from "jsonwebtoken";

export type AuthTokenPayload = {
    userId: string;
    email: string;
};

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("JWT secret is missing");
    }

    return secret;
}

export function createToken(payload: AuthTokenPayload) {
    const options: SignOptions = {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? "7d") as SignOptions["expiresIn"]
    };

    return jwt.sign(payload, getJwtSecret(), options);
}

export function verifyToken(token: string): AuthTokenPayload {
    const decoded = jwt.verify(token, getJwtSecret());

    if (typeof decoded === "string") {
        throw new Error("Invalid token");
    }

    if (!decoded.userId || !decoded.email) {
        throw new Error("Invalid token");
    }

    return {
        userId: String(decoded.userId),
        email: String(decoded.email)
    };
}