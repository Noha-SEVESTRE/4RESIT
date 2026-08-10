export function formatDate(value: string) {
    return new Date(value).toLocaleDateString("fr-FR");
}

export function formatDateTime(value: string) {
    return new Date(value).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}