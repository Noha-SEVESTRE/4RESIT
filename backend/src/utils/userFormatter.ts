export function formatUser(row: any) {
    return {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        dietaryPreferences: row.dietary_preferences,
        defaultPortions: row.default_portions,
        createdAt: row.created_at,
        ...(row.updated_at !== undefined
            ? { updatedAt: row.updated_at }
            : {})
    };
}