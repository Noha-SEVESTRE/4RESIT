import type { PoolClient } from "pg";

export async function findOrCreateOAuthUser(
    client: PoolClient,
    provider: string,
    providerUserId: string,
    email: string,
    displayName: string
) {
    const accountResult = await client.query(
        `SELECT u.id,
                u.email,
                u.display_name,
                u.dietary_preferences,
                u.default_portions,
                u.created_at
         FROM oauth_accounts oa
         JOIN users u ON u.id = oa.user_id
         WHERE oa.provider = $1
           AND oa.provider_user_id = $2`,
        [provider, providerUserId]
    );

    let user = accountResult.rows[0];

    if (user) {
        return user;
    }

    const existingUserResult = await client.query(
        `SELECT id,
                email,
                display_name,
                dietary_preferences,
                default_portions,
                created_at
         FROM users
         WHERE email = $1`,
        [email.toLowerCase()]
    );

    user = existingUserResult.rows[0];

    if (!user) {
        const newUserResult = await client.query(
            `INSERT INTO users (
                email,
                display_name,
                password_hash
             )
             VALUES ($1, $2, NULL)
             RETURNING id,
                       email,
                       display_name,
                       dietary_preferences,
                       default_portions,
                       created_at`,
            [
                email.toLowerCase(),
                displayName
            ]
        );

        user = newUserResult.rows[0];
    }

    await client.query(
        `INSERT INTO oauth_accounts (
            user_id,
            provider,
            provider_user_id
         )
         VALUES ($1, $2, $3)
         ON CONFLICT (
            provider,
            provider_user_id
         )
         DO NOTHING`,
        [
            user.id,
            provider,
            providerUserId
        ]
    );

    return user;
}