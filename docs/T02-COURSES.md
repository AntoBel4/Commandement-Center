# T02 — Courses persistantes et contrôle d’accès

Cette branche prépare le socle API. Elle ne publie pas le portail Maison sur Nexus.
L’interface de production, la connexion réelle des deux personnes et le routage Traefik restent à vérifier lors du raccordement T04b.

## Contrat des courses

Une capture crée une demande distincte. Deux articles du même nom ne sont plus fusionnés automatiquement : une quantité en kilogrammes ne peut pas être additionnée à un nombre de pièces.

- POST /api/v1/grocery/batch : 1 à 100 demandes. Champs : name, quantity, unit, category, source, availableOn (date civile), urgent. L’auteur vient du jeton, jamais du corps.
- Idempotency-Key (facultatif) : identifie un envoi. Réutiliser la même clé pour la reprise réseau du même envoi. Une clé identique avec un autre contenu ou auteur renvoie 409. Sans clé, chaque POST constitue une nouvelle demande.
- GET /api/v1/grocery : masque les demandes annulées par défaut. Filtres status, purchased, category, availableOn ; ce dernier sélectionne les demandes disponibles au plus tard à cette date.
- PUT /api/v1/grocery/:id : exige version et au moins une modification. status vaut open, purchased ou cancelled ; purchased reste un alias compatible. availableOn reporte sans clôturer. assignedTo doit désigner un membre du même foyer ou null.
- DELETE /api/v1/grocery/:id?version=N : annule sans effacer l’historique. PUT avec status=open permet de rouvrir.
- GET /api/v1/grocery/:id/history : journal réservé au foyer, comprenant auteur, action, état avant et après.
- Un achat déjà effectué, réémis avec la version courante, ne change ni sa date ni son auteur. Une version ancienne renvoie 409 et exige un rechargement : elle n’est jamais appliquée à un état plus récent.
- Les ajouts, leur historique et leur clé de reprise sont enregistrés dans une même transaction. Deux modifications de la même version ne peuvent pas réussir simultanément.

La date par défaut utilise FAMILY_TIMEZONE (Europe/Paris par défaut). Un report reçoit une date civile explicite du client ; il ne s’agit pas d’un délai fixe de 24 heures. Le drapeau urgent est enregistré ; l’envoi de notifications appartient aux lots suivants.

## Identité

L’API exige un jeton d’accès signé RS256, un émetteur et une audience attendus, une expiration et un sujet UUID. Elle consulte family_members à chaque requête. Une famille demandée dans X-Family-Id ne confère aucun droit sans appartenance enregistrée.

Le navigateur utilise le client public Keycloak commandement-center et le flux code avec PKCE S256. Le mapper du realm ajoute commandement-api aux jetons d’accès seulement. AUTH_AUDIENCE doit correspondre à cette audience API, distincte de celle du jeton d’identité.

Aucune inscription publique dans le realm fourni. Le provisionnement ajoute exactement deux UUID d’utilisateurs au foyer explicitement identifié. Le script peut être relancé sans créer de foyer en double ; il refuse de remplacer silencieusement une appartenance différente.

Les tests JWT utilisent des identités et des clés fictives. Le test optionnel keycloak.test.js effectue aussi un flux code/PKCE réel par HTTP sur une instance Keycloak locale jetable, avec trois comptes fictifs : deux membres autorisés, un tiers refusé et rejet du jeton d’identité. Ce test ne remplace pas la recette visuelle du portail, la vérification de révocation d’une session Keycloak ou la configuration des comptes de production. Un retrait de family_members est contrôlé à la requête suivante.

## Base et migrations

Une nouvelle base vide est prévue. Aucun script n’efface une base existante. Les colonnes historiques restent compatibles avec les enregistrements antérieurs ; une récupération éventuelle exige une revue dédiée.

Le service Compose migrate applique les fichiers SQL avant API et worker. Chaque migration est transactionnelle, identifiée par son nom et son empreinte ; une migration déjà appliquée ne peut pas être modifiée silencieusement. Le verrou PostgreSQL empêche deux exécutants de migrer en même temps.

Les anciens fichiers 001 à 003 sont réexécutables pour prendre en charge une base initialisée par l’ancien montage Docker. La nouvelle migration 004 doit passer par le lanceur, et non par docker-entrypoint-initdb.d. Un volume ayant reçu manuellement 004 sans registre nécessite une réconciliation explicite avant reprise.

Le dossier historique supabase/migrations contient ici du SQL PostgreSQL standard : aucune dépendance au service Supabase.

## Vérifications reproductibles

Depuis la racine :

```sh
npm ci --ignore-scripts
npm test
```

Avec une base PostgreSQL de test jetable, depuis apps/backend :

```sh
TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/TEST_DB npm run test:postgres
```

Le test crée puis supprime seulement un schéma au nom aléatoire. Ne pas utiliser une base de production. Le script dédié refuse de réussir sans TEST_DATABASE_URL ; npm test seul signale explicitement le scénario PostgreSQL comme ignoré si cette variable est absente.

Le test optionnel TEST_RESTART_CONTAINER est limité au conteneur local identifié cc-t02-db-20260918 avec son étiquette de test. Il n’est pas requis en CI ; la réouverture d’une instance API/store est toujours testée avec PostgreSQL. Les tests Docker de cette session ont aussi redémarré réellement PostgreSQL.

## Preuves locales du 18 septembre 2026

- 27 contrôles réussis dans la suite API/JWT/mémoire/PostgreSQL, y compris le redémarrage réel du conteneur PostgreSQL de test.
- Un contrôle supplémentaire Keycloak réel avec code/PKCE, deux comptes sur la même liste, refus du troisième compte et du jeton d’identité, puis conservation de l’achat après relance de l’API.
- Migration réexécutée, provisionnement des deux membres répété, annulation transactionnelle après erreur, historique et reprise réseau persistants vérifiés.
- Image Docker backend construite ; Compose validé. Fastify 5.12.5 et module CORS compatible ; aucun avis de vulnérabilité retourné par npm audit à cette date.
- En CI, PostgreSQL est toujours utilisé. Le redémarrage explicite d’un conteneur et Keycloak réel sont des vérifications locales optionnelles identifiées comme telles.

## Limites avant mise en service

- Raccorder le portail Maison aux routes et gérer visuellement les conflits de version.
- Configurer Keycloak en production, domaine exact, redirections exactes, TLS, comptes et sessions ; le profil Compose auth fourni reste local et utilise start-dev.
- Préparer Traefik, les réseaux et la configuration privée de Nexus ; aucune valeur réseau privée dans ce dépôt.
- Préparer sauvegarde, restauration et mise à jour. Aucun contrôle de charge, durabilité face à une panne disque ou test sur les deux Android n’est déduit des essais locaux.
- Ne pas exposer les routes de synchronisation/webhooks comme des intégrations fonctionnelles : elles appartiennent aux lots suivants.

Références de conception : [validation JWT jose](https://github.com/panva/jose/blob/main/docs/jwt/verify/interfaces/JWTVerifyOptions.md), [verrous PostgreSQL](https://www.postgresql.org/docs/16/explicit-locking.html), [Keycloak en production](https://www.keycloak.org/server/configuration-production).
