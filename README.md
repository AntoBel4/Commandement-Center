# Centre de Commandement Familial

Implémentation MVP+ d'un centre de commandement familial basé sur la spécification fournie.

## Structure

- `apps/backend`: API Fastify (événements, courses, sync, webhooks), validation Zod, logs.
- `apps/alexa`: handler Alexa Skill (`AjouterEvenement`, `AjouterCourse`) qui appelle l'API backend.
- `apps/web`: interface web légère pour voir/créer des événements, gérer des courses et déclencher les syncs.
- `supabase/migrations`: schéma SQL initial pour Supabase/PostgreSQL.

La migration `002_family_scope.sql` prépare l'isolation par famille et les
index PostgreSQL. Les colonnes `family_id` sont volontairement nullable pendant
la transition vers l'authentification et la persistance.

## Développement et déploiement Docker

Le projet est prévu pour fonctionner derrière Caddy. Copier `.env.example`
vers `.env`, définir un mot de passe PostgreSQL fort, puis lancer :

```bash
docker compose up --build
```

Le service web écoute dans le réseau Docker sur `web:80` et l'API sur
`api:3000`. Caddy doit reverse-proxyer le domaine public vers ces services.
La base PostgreSQL n'est pas exposée sur l'hôte.

L'authentification OIDC/Keycloak est désactivée en développement (`AUTH_ENABLED=false`).
Avant toute exposition publique, configurer un realm Keycloak, un client
`commandement-center`, les URLs `AUTH_*`, puis activer `AUTH_ENABLED=true`.
L'API exigera alors un Bearer token valide et un `X-Family-Id` correspondant à
une ligne de `family_members`.

Pour lancer Keycloak localement avec son realm importé :

```bash
docker compose --profile auth up -d
```

La console sera disponible sur `http://localhost:8081`. Le mot de passe
administrateur doit être remplacé par une valeur forte dans `.env` avant tout
déploiement sur Nexus. La commande `start-dev` est réservée au développement ;
Nexus devra utiliser une commande Keycloak de production derrière Caddy.

Après avoir créé un utilisateur dans le realm `commandement`, récupérer son
UUID dans la console Keycloak, renseigner `FAMILY_NAME`, `KEYCLOAK_USER_ID` et
`DATABASE_URL`, puis lancer une seule fois :

```bash
docker compose run --rm \
  -e FAMILY_NAME="Ma famille" \
  -e KEYCLOAK_USER_ID="UUID_DE_L_UTILISATEUR" \
  api npm run bootstrap:family -w @family/backend
```

La commande crée la famille et donne le rôle `owner` à cet utilisateur. Elle
ne doit pas être exposée comme une route HTTP.

## Prérequis

- Node.js 18+
- npm 9+

## Procédure de test pas à pas

### 1) Installer les dépendances

```bash
npm install
```

### 2) Lancer le backend

```bash
npm run dev:backend
```

Le backend écoute par défaut sur `http://localhost:3000`.

### 3) Vérifier l'API rapidement

```bash
curl http://localhost:3000/health
```

Réponse attendue:

```json
{"status":"ok"}
```

### 4) Tester la création d'un événement

```bash
curl -X POST http://localhost:3000/api/v1/events \
  -H "content-type: application/json" \
  -d '{"title":"Dentiste","date":"2026-04-20","time":"15:00","person":"Paul","source":"dashboard"}'
```

### 5) Tester la création d'une course

```bash
curl -X POST http://localhost:3000/api/v1/grocery/batch \
  -H "content-type: application/json" \
  -d '{"items":[{"name":"Lait","quantity":2,"unit":"litres","source":"dashboard"}]}'
```

### 6) Lancer l'interface web

Depuis `apps/web`:

```bash
cd apps/web
python3 -m http.server 4173
```

Puis ouvrir `http://localhost:4173` dans le navigateur.

- Renseigner l'URL API (par défaut `http://localhost:3100` avec Docker Compose).
- Utiliser les formulaires pour créer événements/courses.
- Utiliser les boutons "Rafraîchir" et les boutons de sync.

### 7) Exécuter les tests automatiques

```bash
npm test
```

## Variables utiles

- `PORT`, `HOST`, `LOG_LEVEL` pour le backend.
- `FAMILY_API_BASE_URL` pour la lambda Alexa.
- Renseigner les secrets uniquement dans `.env` ou dans le gestionnaire de
  secrets du serveur ; ne jamais les committer.
