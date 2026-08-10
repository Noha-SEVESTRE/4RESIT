import { z } from "zod";

export function createStrongPasswordSchema(label = "Le mot de passe") {
    return z.string()
        .min(1, `${label} est obligatoire`)
        .min(8, `${label} doit contenir au moins 8 caractères`)
        .max(120, `${label} est trop long`)
        .regex(/[A-Z]/, `${label} doit contenir au moins une majuscule`)
        .regex(/[0-9]/, `${label} doit contenir au moins un chiffre`)
        .regex(/[^A-Za-z0-9]/, `${label} doit contenir au moins un caractère spécial`);
}