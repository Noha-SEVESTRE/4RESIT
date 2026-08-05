import swaggerJSDoc from "swagger-jsdoc";

const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "SUPMEAL API",
            version: "1.0.0",
            description: "Documentation de l'API SUPMEAL"
        },
        servers: [
            {
                url: "http://localhost:8080/api",
                description: "API"
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT"
                }
            },
            schemas: {
                User: {
                    type: "object",
                    properties: {
                        id: {
                            type: "string",
                            format: "uuid"
                        },
                        email: {
                            type: "string",
                            format: "email"
                        },
                        displayName: {
                            type: "string"
                        },
                        dietaryPreferences: {
                            type: "object"
                        },
                        defaultPortions: {
                            type: "number"
                        },
                        createdAt: {
                            type: "string"
                        },
                        updatedAt: {
                            type: "string"
                        }
                    }
                },
                Recipe: {
                    type: "object",
                    properties: {
                        id: {
                            type: "string",
                            format: "uuid"
                        },
                        title: {
                            type: "string"
                        },
                        description: {
                            type: "string"
                        },
                        preparationTime: {
                            type: "number"
                        },
                        cookingTime: {
                            type: "number"
                        },
                        portions: {
                            type: "number"
                        },
                        imageUrl: {
                            type: "string",
                            nullable: true
                        },
                        sourceUrl: {
                            type: "string",
                            nullable: true
                        },
                        ingredients: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    name: {
                                        type: "string"
                                    },
                                    quantity: {
                                        type: "string"
                                    },
                                    unit: {
                                        type: "string"
                                    }
                                }
                            }
                        },
                        steps: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    position: {
                                        type: "number"
                                    },
                                    content: {
                                        type: "string"
                                    }
                                }
                            }
                        },
                        tags: {
                            type: "array",
                            items: {
                                type: "string"
                            }
                        }
                    }
                },
                Cookbook: {
                    type: "object",
                    properties: {
                        id: {
                            type: "string",
                            format: "uuid"
                        },
                        name: {
                            type: "string"
                        },
                        description: {
                            type: "string"
                        },
                        role: {
                            type: "string"
                        },
                        createdAt: {
                            type: "string"
                        },
                        updatedAt: {
                            type: "string"
                        }
                    }
                },
                ErrorResponse: {
                    type: "object",
                    properties: {
                        message: {
                            type: "string"
                        },
                        fieldErrors: {
                            type: "object"
                        }
                    }
                }
            }
        },
        paths: {
            "/health": {
                get: {
                    tags: ["Health"],
                    summary: "Vérifier que l'API est disponible",
                    responses: {
                        200: {
                            description: "API disponible"
                        }
                    }
                }
            },
            "/db-health": {
                get: {
                    tags: ["Health"],
                    summary: "Vérifier la connexion à PostgreSQL",
                    responses: {
                        200: {
                            description: "Base de données disponible"
                        },
                        500: {
                            description: "Erreur de connexion à la base"
                        }
                    }
                }
            },
            "/auth/register": {
                post: {
                    tags: ["Authentification"],
                    summary: "Créer un compte local",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["email", "password", "displayName"],
                                    properties: {
                                        email: {
                                            type: "string",
                                            format: "email"
                                        },
                                        password: {
                                            type: "string"
                                        },
                                        displayName: {
                                            type: "string"
                                        }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        201: {
                            description: "Compte créé"
                        },
                        400: {
                            description: "Champs invalides"
                        },
                        409: {
                            description: "Email déjà utilisé"
                        }
                    }
                }
            },
            "/auth/login": {
                post: {
                    tags: ["Authentification"],
                    summary: "Se connecter avec un compte local",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["email", "password"],
                                    properties: {
                                        email: {
                                            type: "string",
                                            format: "email"
                                        },
                                        password: {
                                            type: "string"
                                        }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        200: {
                            description: "Connexion réussie"
                        },
                        401: {
                            description: "Email ou mot de passe incorrect"
                        },
                        423: {
                            description: "Compte temporairement verrouillé"
                        }
                    }
                }
            },
            "/auth/me": {
                get: {
                    tags: ["Authentification"],
                    summary: "Récupérer l'utilisateur connecté",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    responses: {
                        200: {
                            description: "Utilisateur connecté"
                        },
                        401: {
                            description: "Token absent ou invalide"
                        }
                    }
                }
            },
            "/auth/github": {
                get: {
                    tags: ["OAuth2"],
                    summary: "Démarrer la connexion GitHub OAuth2",
                    responses: {
                        302: {
                            description: "Redirection vers GitHub"
                        }
                    }
                }
            },
            "/auth/google": {
                get: {
                    tags: ["OAuth2"],
                    summary: "Démarrer la connexion Google OAuth2",
                    responses: {
                        302: {
                            description: "Redirection vers Google"
                        }
                    }
                }
            },
            "/users/me/preferences": {
                get: {
                    tags: ["Utilisateur"],
                    summary: "Récupérer les préférences utilisateur",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    responses: {
                        200: {
                            description: "Préférences récupérées"
                        },
                        401: {
                            description: "Token absent ou invalide"
                        }
                    }
                },
                patch: {
                    tags: ["Utilisateur"],
                    summary: "Modifier les préférences utilisateur",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    responses: {
                        200: {
                            description: "Préférences modifiées"
                        },
                        400: {
                            description: "Champs invalides"
                        },
                        401: {
                            description: "Token absent ou invalide"
                        }
                    }
                }
            },
            "/users/me/security": {
                get: {
                    tags: ["Utilisateur"],
                    summary: "Récupérer les informations de sécurité du compte",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    responses: {
                        200: {
                            description: "Informations de sécurité récupérées"
                        },
                        401: {
                            description: "Token absent ou invalide"
                        }
                    }
                }
            },
            "/users/me/email": {
                patch: {
                    tags: ["Utilisateur"],
                    summary: "Modifier l'email d'un compte local",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["email", "currentPassword"],
                                    properties: {
                                        email: {
                                            type: "string",
                                            format: "email"
                                        },
                                        currentPassword: {
                                            type: "string"
                                        }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        200: {
                            description: "Email modifié"
                        },
                        400: {
                            description: "Mot de passe actuel incorrect"
                        },
                        403: {
                            description: "Email non modifiable pour un compte OAuth2"
                        },
                        409: {
                            description: "Email déjà utilisé"
                        }
                    }
                }
            },
            "/users/me/password": {
                patch: {
                    tags: ["Utilisateur"],
                    summary: "Modifier le mot de passe d'un compte local",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["currentPassword", "newPassword", "newPasswordConfirmation"],
                                    properties: {
                                        currentPassword: {
                                            type: "string"
                                        },
                                        newPassword: {
                                            type: "string"
                                        },
                                        newPasswordConfirmation: {
                                            type: "string"
                                        }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        200: {
                            description: "Mot de passe modifié"
                        },
                        400: {
                            description: "Champs invalides"
                        },
                        403: {
                            description: "Mot de passe non modifiable pour un compte OAuth2"
                        }
                    }
                }
            },
            "/recipes": {
                get: {
                    tags: ["Recettes"],
                    summary: "Lister les recettes avec recherche et filtres",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "q",
                            in: "query",
                            schema: {
                                type: "string"
                            }
                        },
                        {
                            name: "tag",
                            in: "query",
                            schema: {
                                type: "string"
                            }
                        },
                        {
                            name: "ingredient",
                            in: "query",
                            schema: {
                                type: "string"
                            }
                        },
                        {
                            name: "cookbookId",
                            in: "query",
                            schema: {
                                type: "string"
                            }
                        },
                        {
                            name: "maxTotalTime",
                            in: "query",
                            schema: {
                                type: "number"
                            }
                        },
                        {
                            name: "favorite",
                            in: "query",
                            schema: {
                                type: "boolean"
                            }
                        }
                    ],
                    responses: {
                        200: {
                            description: "Liste des recettes"
                        },
                        401: {
                            description: "Token absent ou invalide"
                        }
                    }
                },
                post: {
                    tags: ["Recettes"],
                    summary: "Créer une recette",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    responses: {
                        201: {
                            description: "Recette créée"
                        },
                        400: {
                            description: "Champs invalides"
                        },
                        401: {
                            description: "Token absent ou invalide"
                        }
                    }
                }
            },
            "/recipes/favorites": {
                get: {
                    tags: ["Recettes"],
                    summary: "Lister les recettes favorites",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    responses: {
                        200: {
                            description: "Favoris récupérés"
                        },
                        401: {
                            description: "Token absent ou invalide"
                        }
                    }
                }
            },
            "/recipes/{id}": {
                get: {
                    tags: ["Recettes"],
                    summary: "Consulter les détails d'une recette",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        }
                    ],
                    responses: {
                        200: {
                            description: "Détail de la recette"
                        },
                        404: {
                            description: "Recette introuvable"
                        }
                    }
                },
                put: {
                    tags: ["Recettes"],
                    summary: "Modifier une recette",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        }
                    ],
                    responses: {
                        200: {
                            description: "Recette modifiée"
                        },
                        403: {
                            description: "Action non autorisée"
                        },
                        404: {
                            description: "Recette introuvable"
                        }
                    }
                },
                delete: {
                    tags: ["Recettes"],
                    summary: "Supprimer une recette",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        }
                    ],
                    responses: {
                        200: {
                            description: "Recette supprimée"
                        },
                        403: {
                            description: "Action non autorisée"
                        },
                        404: {
                            description: "Recette introuvable"
                        }
                    }
                }
            },
            "/recipes/{id}/favorite": {
                post: {
                    tags: ["Recettes"],
                    summary: "Ajouter une recette aux favoris",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        }
                    ],
                    responses: {
                        200: {
                            description: "Favori ajouté"
                        }
                    }
                },
                delete: {
                    tags: ["Recettes"],
                    summary: "Retirer une recette des favoris",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        }
                    ],
                    responses: {
                        200: {
                            description: "Favori retiré"
                        }
                    }
                }
            },
            "/recipes/{recipeId}/comments": {
                get: {
                    tags: ["Commentaires"],
                    summary: "Lister les commentaires d'une recette d'un cookbook",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "recipeId",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        }
                    ],
                    responses: {
                        200: {
                            description: "Commentaires récupérés"
                        }
                    }
                },
                post: {
                    tags: ["Commentaires"],
                    summary: "Ajouter un commentaire sur une recette d'un cookbook",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "recipeId",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        }
                    ],
                    responses: {
                        201: {
                            description: "Commentaire ajouté"
                        },
                        403: {
                            description: "Rôle insuffisant"
                        }
                    }
                }
            },
            "/recipes/{recipeId}/comments/{commentId}": {
                delete: {
                    tags: ["Commentaires"],
                    summary: "Supprimer un commentaire d'une recette",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "recipeId",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        },
                        {
                            name: "commentId",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        }
                    ],
                    responses: {
                        200: {
                            description: "Commentaire supprimé"
                        },
                        403: {
                            description: "Action non autorisée"
                        }
                    }
                }
            },
            "/cookbooks": {
                get: {
                    tags: ["Cookbooks"],
                    summary: "Lister les cookbooks de l'utilisateur",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    responses: {
                        200: {
                            description: "Liste des cookbooks"
                        }
                    }
                },
                post: {
                    tags: ["Cookbooks"],
                    summary: "Créer un cookbook partagé",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    responses: {
                        201: {
                            description: "Cookbook créé"
                        },
                        400: {
                            description: "Champs invalides"
                        }
                    }
                }
            },
            "/cookbooks/{id}": {
                get: {
                    tags: ["Cookbooks"],
                    summary: "Consulter un cookbook",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        }
                    ],
                    responses: {
                        200: {
                            description: "Cookbook récupéré"
                        },
                        404: {
                            description: "Cookbook introuvable"
                        }
                    }
                },
                delete: {
                    tags: ["Cookbooks"],
                    summary: "Supprimer un cookbook",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        }
                    ],
                    responses: {
                        200: {
                            description: "Cookbook supprimé"
                        },
                        403: {
                            description: "Seul le propriétaire peut supprimer le cookbook"
                        },
                        404: {
                            description: "Cookbook introuvable"
                        }
                    }
                }
            },
            "/cookbooks/{id}/members": {
                post: {
                    tags: ["Cookbooks"],
                    summary: "Ajouter un membre à un cookbook",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        }
                    ],
                    responses: {
                        201: {
                            description: "Membre ajouté"
                        },
                        403: {
                            description: "Action non autorisée"
                        }
                    }
                }
            },
            "/cookbooks/{id}/members/{userId}": {
                delete: {
                    tags: ["Cookbooks"],
                    summary: "Retirer un membre d'un cookbook",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        },
                        {
                            name: "userId",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        }
                    ],
                    responses: {
                        200: {
                            description: "Membre retiré"
                        },
                        403: {
                            description: "Action non autorisée"
                        }
                    }
                }
            },
            "/cookbooks/{id}/recipes": {
                get: {
                    tags: ["Cookbooks"],
                    summary: "Lister les recettes d'un cookbook",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        },
                        {
                            name: "q",
                            in: "query",
                            schema: {
                                type: "string"
                            }
                        },
                        {
                            name: "tag",
                            in: "query",
                            schema: {
                                type: "string"
                            }
                        },
                        {
                            name: "ingredient",
                            in: "query",
                            schema: {
                                type: "string"
                            }
                        },
                        {
                            name: "maxTotalTime",
                            in: "query",
                            schema: {
                                type: "number"
                            }
                        }
                    ],
                    responses: {
                        200: {
                            description: "Recettes du cookbook"
                        }
                    }
                }
            },
            "/cookbooks/{id}/recipes/{recipeId}": {
                post: {
                    tags: ["Cookbooks"],
                    summary: "Ajouter une recette à un cookbook",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        },
                        {
                            name: "recipeId",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        }
                    ],
                    responses: {
                        200: {
                            description: "Recette ajoutée au cookbook"
                        },
                        403: {
                            description: "Action non autorisée"
                        }
                    }
                },
                delete: {
                    tags: ["Cookbooks"],
                    summary: "Retirer une recette d'un cookbook",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        },
                        {
                            name: "recipeId",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        }
                    ],
                    responses: {
                        200: {
                            description: "Recette retirée du cookbook"
                        },
                        403: {
                            description: "Action non autorisée"
                        }
                    }
                }
            },
            "/cookbooks/{cookbookId}/messages": {
                get: {
                    tags: ["Messages"],
                    summary: "Lister les messages d'un cookbook",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "cookbookId",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        }
                    ],
                    responses: {
                        200: {
                            description: "Messages récupérés"
                        }
                    }
                },
                post: {
                    tags: ["Messages"],
                    summary: "Ajouter un message dans un cookbook",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "cookbookId",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        }
                    ],
                    responses: {
                        201: {
                            description: "Message ajouté"
                        },
                        403: {
                            description: "Rôle insuffisant"
                        }
                    }
                }
            },
            "/cookbooks/{cookbookId}/messages/{messageId}": {
                delete: {
                    tags: ["Messages"],
                    summary: "Supprimer un message d'un cookbook",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "cookbookId",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        },
                        {
                            name: "messageId",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        }
                    ],
                    responses: {
                        200: {
                            description: "Message supprimé"
                        },
                        403: {
                            description: "Action non autorisée"
                        }
                    }
                }
            },
            "/meal-plans": {
                get: {
                    tags: ["Planning"],
                    summary: "Lister le planning de repas",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    responses: {
                        200: {
                            description: "Planning récupéré"
                        }
                    }
                },
                post: {
                    tags: ["Planning"],
                    summary: "Ajouter une recette au planning",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    responses: {
                        201: {
                            description: "Recette ajoutée au planning"
                        }
                    }
                }
            },
            "/meal-plans/{id}": {
                delete: {
                    tags: ["Planning"],
                    summary: "Retirer une recette du planning",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        }
                    ],
                    responses: {
                        200: {
                            description: "Élément retiré du planning"
                        }
                    }
                }
            },
            "/recipes/{id}/export": {
                get: {
                    tags: ["Import export"],
                    summary: "Exporter une recette",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                format: "uuid"
                            }
                        }
                    ],
                    responses: {
                        200: {
                            description: "Recette exportée"
                        }
                    }
                }
            },
            "/recipes/import": {
                post: {
                    tags: ["Import export"],
                    summary: "Importer une recette",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    responses: {
                        201: {
                            description: "Recette importée"
                        },
                        400: {
                            description: "Fichier invalide"
                        }
                    }
                }
            },
            "/data/export": {
                get: {
                    tags: ["Import export"],
                    summary: "Exporter les données utilisateur",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    responses: {
                        200: {
                            description: "Données exportées"
                        }
                    }
                }
            },
            "/data/import": {
                post: {
                    tags: ["Import export"],
                    summary: "Importer des données utilisateur",
                    security: [
                        {
                            bearerAuth: []
                        }
                    ],
                    responses: {
                        200: {
                            description: "Données importées"
                        },
                        400: {
                            description: "Fichier invalide"
                        }
                    }
                }
            }
        }
    },
    apis: []
};

export const swaggerSpec = swaggerJSDoc(swaggerOptions);