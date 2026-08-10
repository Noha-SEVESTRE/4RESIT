import { z } from "zod";
import { pool } from "../database/pool";

export const cookbookRoleSchema = z.enum([
    "OWNER",
    "EDITOR",
    "READER",
    "COMMENTATOR"
]);

export type CookbookRole = z.infer<typeof cookbookRoleSchema>;

export async function getCookbookAccess(
    cookbookId: string,
    userId: string
): Promise<CookbookRole | null> {
    const result = await pool.query(
        `SELECT role
         FROM cookbook_members
         WHERE cookbook_id = $1
           AND user_id = $2`,
        [cookbookId, userId]
    );

    const role = result.rows[0]?.role;

    if (!role) {
        return null;
    }

    return cookbookRoleSchema.parse(role);
}