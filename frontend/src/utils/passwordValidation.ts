export function getStrongPasswordError(
    password: string,
    label = "Le mot de passe"
) {
    if (!password) {
        return `${label} est obligatoire`;
    }

    if (password.length < 8) {
        return `${label} doit contenir au moins 8 caractères`;
    }

    if (!/[A-Z]/.test(password)) {
        return `${label} doit contenir au moins une majuscule`;
    }

    if (!/[0-9]/.test(password)) {
        return `${label} doit contenir au moins un chiffre`;
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
        return `${label} doit contenir au moins un caractère spécial`;
    }

    return "";
}