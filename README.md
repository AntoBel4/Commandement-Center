# Centre de Commandement Familial

Portail Maison en service sur Nexus : courses partagées, agenda et capture Alexa.
État au 3 octobre 2026 : API/web/Telegram déployés à `5bb65aa` (PR 10), recette courses réussie pour Antoine ; Belinda, envois programmés et pilote restent à vérifier. La branche main ne contient pas encore toutes les intégrations déployées : consulter la fiche d’état avant toute installation.
La maquette Maison validée est dans prototype/index.html ; elle reste autonome.
Le socle API T02 est décrit dans [docs/T02-COURSES.md](docs/T02-COURSES.md).
Le portail connecté et sa recette sont décrits dans [docs/T04B-PORTAL.md](docs/T04B-PORTAL.md).
L’état vérifié et la prochaine action figurent dans [docs/PROJECT-STATE.md](docs/PROJECT-STATE.md).

## Structure

- apps/backend : API Fastify, stockage PostgreSQL, migrations et tests.
- apps/web : portail Maison, connexion personnelle et courses persistantes (T04b, recette ordinateur et Android validée ; intégrations déployées depuis les branches de PR, recette à deux encore ouverte).
- apps/alexa : intégration courses acceptée dans l’application Alexa du téléphone ; rendez-vous vocaux T07 encore à faire, hors pilote.
- supabase/migrations : migrations PostgreSQL standard.
- deploy/keycloak : realm de préparation locale, inscriptions fermées et PKCE.

## Développement local

Node.js 22 ou supérieur et npm sont requis.

```sh
npm ci --ignore-scripts
npm test
```

Copier .env.example vers .env et définir les valeurs privées. Pour un essai Node en mémoire uniquement, définir explicitement NODE_ENV=development et AUTH_ENABLED=false, laisser DATABASE_URL vide, puis :

```sh
node --env-file=.env apps/backend/src/server.js
```

Ce mode n’est pas utilisable en production. L’API refuse le stockage mémoire et l’authentification désactivée en production. Avec authentification, adapter AUTH_JWKS_URL pour qu’elle soit joignable depuis le processus Node (localhost pour un lancement sur le PC ; nom du service pour Docker).

## Préparation Docker locale

Le Compose existant sert à la préparation locale. Les ports du fichier override sont limités à 127.0.0.1. Ce fichier n’est pas une configuration de mise en ligne Nexus ; la production utilise la configuration Nexus dédiée, décrite sur la branche de livraison et dans la fiche d’état.

Renseigner POSTGRES_PASSWORD, KEYCLOAK_DB_PASSWORD, KEYCLOAK_ADMIN_PASSWORD et AUTH_ISSUER_URL dans .env. AUTH_AUDIENCE vaut commandement-api. Puis :

```sh
docker compose --profile auth up --build -d
```

La base n’a pas de port publié. Le service migrate exécute les migrations avant le démarrage de l’API et du worker. /health indique que le processus répond ; /ready vérifie l’accès au schéma des courses.

Keycloak local utilise start-dev et le realm commandement. Créer deux utilisateurs dans sa console locale, puis renseigner FAMILY_ID (UUID stable), FAMILY_NAME et KEYCLOAK_USER_IDS (les deux UUID séparés par une virgule) :

```sh
docker compose run --rm -e FAMILY_ID -e FAMILY_NAME -e KEYCLOAK_USER_IDS api npm run bootstrap:family -w @family/backend
```

Les variables de provisionnement doivent être exportées dans le terminal qui exécute cette commande, ou fournies explicitement avec -e NOM=VALEUR ; le fichier .env Compose seul ne les exporte pas dans le terminal. Aucun mot de passe utilisateur n’est inscrit dans le realm ou Git.

Les jetons d’accès doivent être destinés à commandement-api. Chaque requête API utilise Authorization: Bearer et X-Family-Id, vérifiés côté serveur. Le profil auth local ne prouve pas que Keycloak est prêt en production.

Le portail exige un fichier public `config.json` avec le foyer provisionné et l’adresse Keycloak ; voir [la configuration T04b](docs/T04B-PORTAL.md#configuration-locale-et-docker). Sa valeur de foyer vide bloque l’ouverture tant qu’il n’est pas configuré. Le navigateur utilise l’API sur la même origine via Nginx.

## Livraison

Le Centre fonctionne sous Docker derrière le Traefik existant, avec configuration privée externe. Les procédures d’exploitation, de pilote et de reprise sont sur la [branche PR 10](https://github.com/AntoBel4/Commandement-Center/tree/claude/eager-galileo-ezltlj/docs). Aucun déploiement sur Nexus, DNS, intégration Google/Telegram/Alexa ou notification réelle n’est déclenché par ce dépôt ou ces tests.
