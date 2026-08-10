SUPMEAL

SUPMEAL est une application web de gestion de recettes et de planification de repas.

Le projet est composé de trois briques principales :
- Une API REST
- Un client web
- Une base de données PostgreSQL

L’application permet notamment aux utilisateurs de :
- Créer et gérer leurs recettes personnelles
- Créer et rejoindre des cookbooks partagés
- Partager des recettes avec les membres d’un cookbook
- Rechercher et filtrer les recettes
- Ajouter des recettes aux favoris
- Planifier des repas personnels ou partagés
- Commenter des recettes
- Echanger via une messagerie instantanée dans les cookbooks
- Importer et exporter leurs données
- Se connecter avec un compte local ou via OAuth2

Stack technique :
- Vue 3
- Vite
- TypeScript
- Node.js
- Express
- PostgreSQL
- Socket.IO
- Docker Compose

Lancement de l’application
Prérequis :
- Docker
- Docker Compose

Configuration :
Créer un fichier .env à partir du fichier .env.example et renseigner les variables nécessaires.

cp .env.example .env

Les identifiants OAuth Google et GitHub sont nécessaires uniquement pour utiliser les connexions OAuth2.

Démarrage :
Depuis la racine du projet :

docker compose up --build

Docker démarre automatiquement les trois services nécessaires :

- frontend
- backend
- PostgreSQL

Une fois les services démarrés, l’application est accessible depuis le navigateur.

Documentation :
Le projet contient également :

une documentation technique
un manuel utilisateur 