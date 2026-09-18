# Nexus — préparation des comptes et courses

Périmètre : premier service privé comptes/courses, avant Google Agenda, Telegram et Alexa. Ce dossier ne déclare ni le service déployé, ni la V1 complète. Les paramètres du serveur, domaine réel, identités et secrets restent dans Notion et la configuration privée.

## Architecture

Utiliser exclusivement `deploy/nexus/compose.yml`, indépendant des fichiers Compose de développement. Aucun `start-dev`, aucun port publié sur l'hôte, aucune installation ou modification de Traefik existant. Le seul conteneur relié au réseau proxy existant est Nginx. API, Keycloak et les deux PostgreSQL utilisent un réseau interne propre à ce projet. Le traitement des intégrations n'est pas lancé.

Traefik termine HTTPS, puis Nginx dessert le portail, les routes courses et les seules routes publiques du realm familial sous `/auth`. Les routes d'administration, du realm master, de santé Keycloak et des intégrations sont refusées. Nginx reconstruit les en-têtes HTTPS transmis à Keycloak. Celui-ci n'est pas directement accessible depuis le réseau des autres applications. Aucune confiance dans une IP de client n'est utilisée pour accorder des droits.

L'application statique et sa configuration sans secret sont publiques ; les données familiales exigent un jeton valide et une appartenance au foyer vérifiée par l'API. La connexion est un flux code/PKCE ; le jeton d'identité n'est pas accepté comme jeton API. Les deux identités et le foyer ont des UUID générés ensemble. Inscriptions et réinitialisation par email fermées tant que SMTP n'est pas configuré. Un mot de passe temporaire impose son changement à la première connexion. L'administration s'effectue depuis SSH, avec le CLI Keycloak dans son conteneur.

## Préparation privée, une seule fois

Prérequis : Docker/Compose, Git et Bash sur un hôte Linux ; Traefik avec entrée HTTPS et résolveur ACME DNS déjà opérationnels ; réseau externe relevé ; répertoire du projet sur le disque de données. Ne pas exécuter cette procédure dans une stack existante d'un autre service.

1. Récupérer le commit relu dans un clone dédié et vérifier `git status --short`. Ne pas déployer depuis des fichiers modifiés ou un mélange de branches. Noter le SHA dans le suivi privé.
2. Télécharger les versions approuvées des images et relever leurs identifiants immuables :

```sh
docker pull postgres:16-alpine
docker pull quay.io/keycloak/keycloak:26.7.0
docker image inspect postgres:16-alpine --format '{{index .RepoDigests 0}}'
docker image inspect quay.io/keycloak/keycloak:26.7.0 --format '{{index .RepoDigests 0}}'
```

3. Préparer les valeurs privées dans le terminal (les exemples ci-dessous sont fictifs). Les noms de compte sont des identifiants simples en minuscules. La génération refuse les noms invalides, les images sans digest et toute configuration déjà présente.

```sh
export PORTAL_HOST=family.example.test
export MEMBER_USERNAMES=alice,bob
export RELEASE=$(git rev-parse HEAD)
export POSTGRES_IMAGE=$(docker image inspect postgres:16-alpine --format '{{index .RepoDigests 0}}')
export KEYCLOAK_IMAGE=$(docker image inspect quay.io/keycloak/keycloak:26.7.0 --format '{{index .RepoDigests 0}}')
# Node peut être fourni par Docker, sans l'installer sur Nexus.
docker run --rm --user "$(id -u):$(id -g)" \
  --mount "type=bind,src=$PWD,dst=/work" -w /work \
  -e PORTAL_HOST -e MEMBER_USERNAMES -e RELEASE -e POSTGRES_IMAGE -e KEYCLOAK_IMAGE \
  node:22-alpine node deploy/nexus/prepare.mjs
```

Les quatre fichiers sont créés dans `.private/nexus/` (dossier 0700) sans afficher les secrets. Fichiers d'environnement et premiers accès en 0600 ; les deux JSON montés dans les conteneurs sont en 0644, protégés sur l'hôte par le dossier parent. Ne jamais les ajouter au dépôt, copier dans une conversation ni inclure dans une image. `.gitignore` et `.dockerignore` excluent `.private/`, les fichiers `.env*` et les sauvegardes.

Vérifier les valeurs `TRAEFIK_NETWORK` et `TRAEFIK_CERT_RESOLVER` dans le fichier privé. Conserver tous les UUID et les mots de passe : relancer la génération ne constitue pas une rotation. Après import, modifier le realm ou ses utilisateurs nécessite une opération d'administration explicite ; Keycloak ne réimporte pas un realm déjà existant.

## Prévol et lancement

Avant publication : vérifier le DNS prévu, le certificat, le mode TLS Cloudflare (Full strict), l'absence de règles de cache sur ce sous-domaine et le renouvellement de l'adresse publique. Les changements de DNS doivent porter uniquement sur le sous-domaine familial. Préserver le site principal et les autres services.

```sh
source deploy/nexus/common.sh
dc config --quiet  # Ne pas afficher `config` sans --quiet : il contient les secrets.
dc build api web
dc up -d --no-build --wait --wait-timeout 300
dc ps
```

Lancement ordonné : bases saines, migrations, identité prête, rattachement des deux membres, API prête, portail. Les images applicatives portent le SHA `RELEASE`. Conserver les images validées avant une mise à jour : reconstruire un ancien SHA peut changer ses images de base. Relever les identifiants exacts via `dc images` et archiver les images de la version précédente si nécessaire.

Accès initiaux : consulter le fichier privé `initial-access.json` uniquement sur un poste d'administration, transmettre chaque mot de passe temporaire par un canal privé et conserver les mots de passe définitifs dans le coffre. Ne pas communiquer le mot de passe bootstrap d'administration. Après création d'un administrateur nominatif protégé (MFA recommandé) et vérification de son accès, supprimer le compte bootstrap temporaire via le CLI et retirer ses variables du service Keycloak par une évolution relue. Aucune console d'administration publique n'est nécessaire. Ne pas supprimer les comptes familiaux pour réinitialiser un mot de passe : leur UUID porte les droits et l'historique.

Contrôles de mise en service limitée :

- HTTPS et certificat corrects depuis l'extérieur ; connexion puis déconnexion sur Android sans USB ; changement du mot de passe temporaire.
- Deux comptes accèdent à la même liste ; ajout/attribution/achat/rechargement ; compte extérieur refusé ; appel courses anonyme refusé.
- `/auth/admin/`, `/auth/realms/master/`, `/auth/health/ready` et routes d'intégrations renvoient 404.
- Redémarrage de la stack sans perte d'une course confirmée ; les autres services Nexus restent disponibles.
- Sauvegarde des deux bases et restauration séparée réussies ; destination hors serveur et objectifs de reprise explicitement convenus.

Une page d'accueil accessible et un conteneur sain ne suffisent pas à prononcer la mise en service. Le contrôle de santé API vérifie sa base ; le contrôle web vérifie Nginx. Il reste à raccorder les alertes de disponibilité et sauvegarde, sans doubler les alertes Nexus ni utiliser le bot familial.

## Sauvegarder et éprouver la restauration

Les copies contiennent des données et des secrets. Le répertoire cible doit être privé ; leur transport et leur stockage hors serveur doivent être chiffrés. Le script arrête brièvement web/API/Keycloak, laisse les bases en marche, exporte les deux bases avec `pg_dump -Fc`, copie la configuration, note les versions et calcule les empreintes. Il redémarre uniquement les services initialement actifs, y compris si une étape échoue. Aucun effacement ni rotation automatique de sauvegardes n'est réalisé.

```sh
# Choisir un parent de sauvegarde privé existant, en dehors du dépôt.
bash deploy/nexus/backup.sh /path/to/private-backups/first-backup
bash deploy/nexus/restore-check.sh /path/to/private-backups/first-backup "$POSTGRES_IMAGE"
```

La restauration de contrôle vérifie les empreintes, crée un conteneur PostgreSQL sans réseau ni port publié, restaure les deux bases avec arrêt à la première erreur et compare les nombres de foyers/membres/courses/historiques/reprises/realms/comptes/identifiants. Elle supprime uniquement son conteneur et son volume temporaires. Elle ne touche jamais aux volumes du service. Ce contrôle de base doit être complété par une connexion et lecture des courses dans une stack de récupération isolée avant une restauration réelle.

Décision du 18 septembre : une **nouvelle destination hors Nexus sera choisie plus tard**. Aucun dépôt Restic, compte cloud, transfert hors site, planification ou achat créé. Une sauvegarde locale testée ne protège pas d'une panne totale du serveur. Quand la destination sera choisie : provisionner le dépôt chiffré, conserver la clé dans le coffre avec récupération indépendante de Nexus, transférer un jeu complet, le relire depuis la destination et refaire la restauration. Fixer fréquence, rétention, perte de données acceptable, délai de reprise et alerte d'échec avant d'activer la planification.

## Récupération et retour arrière

1. Suspendre les écritures et conserver un nouveau jeu de sauvegarde de l'état actuel. Ne jamais supprimer un volume de production pour "réessayer".
2. Restaurer dans **de nouveaux volumes et un nouveau projet isolé**, sans réseau proxy ni accès public, avec les versions notées dans la sauvegarde. Reprendre `production.env`, `portal-config.json` et le JSON d'import privé (Keycloak ignore le realm déjà restauré). Créer les rôles de base attendus, puis restaurer chaque archive dans sa base vide avec `pg_restore --no-owner --no-acl --exit-on-error` sous le bon propriétaire.
3. Vérifier membres, identifiants immuables, droits et données, puis connexion réelle et modification d'une course fictive. Un retour à une ancienne image n'annule pas les migrations : vérifier leur compatibilité ou restaurer ensemble bases et version correspondante.
4. Après validation, basculer uniquement le portail familial vers le projet récupéré. Garder l'ancien projet arrêté et ses volumes jusqu'à la fin des contrôles ; conserver le plan de retour à l'état précédent.

## Tests locaux reproductibles

`node --test deploy/nexus/test/prepare.test.mjs` vérifie les entrées, la cohérence des UUID et le refus d'écraser une identité existante. Pour le test d'intégration, générer exclusivement des identités fictives `alice,bob` avec `PORTAL_HOST=family.example.test`, modifier le projet privé en `commandement-nexus-test` et le réseau en `cc-nexus-test-proxy`, puis :

```sh
docker network create cc-nexus-test-proxy
docker compose --env-file .private/nexus/production.env -f deploy/nexus/compose.yml -f deploy/nexus/test/local.yml up -d --build --wait --wait-timeout 300
NEXUS_TEST_BASE=http://127.0.0.1:18483 NEXUS_TEST_IDENTITY=http://127.0.0.1:18481 node --test deploy/nexus/test/stack.test.mjs
```

Ces ports sont liés uniquement à localhost et réservés aux tests ; ne jamais utiliser `test/local.yml` sur Nexus. Le test simule la terminaison HTTPS du proxy avec l'origine publique fictive, utilise réellement Keycloak en mode production et PostgreSQL, mais ne valide pas un certificat ni Cloudflare/Traefik. Il exerce le changement de mot de passe temporaire du premier compte fictif, utilise un deuxième compte déjà configuré et crée/supprime un visiteur de test. L'export/restauration peut ensuite être éprouvé sur cette stack locale contenant les données de test.

## Preuves du 18 septembre 2026

- Diagnostic SSH direct de Nexus en lecture seule : Docker 28.4.0, Compose 2.39.4, Traefik 3.5.3 ; paramètres du proxy et ressources confirmés. Valeurs privées conservées dans Notion. Aucun service installé, redémarré ou modifié sur Nexus.
- Générateur : 2 tests réussis (validation des entrées et cohérence/refus d'écrasement). Ajoutés au workflow de tests du dépôt.
- Compose de production validé et images API/web construites ; toutes les sondes passent dans une stack Docker locale distincte.
- Test réel Keycloak/PostgreSQL derrière Nginx : découverte OIDC HTTPS, code/PKCE, changement du mot de passe temporaire, deux comptes sur une liste, reprise d'ajout sans doublon, visiteur refusé, jeton d'identité refusé et routes d'administration/intégration fermées.
- Export des deux bases contenant des données fictives, vérification des empreintes, restauration sans erreur dans un PostgreSQL sans réseau ; nombres d'enregistrements correspondants. Ce test ne valide pas encore une restauration du service complet ni une copie hors site.
- Aucun DNS modifié, aucun compte familial réel créé, aucun message envoyé. Destination hors serveur différée à la demande d'Antoine ; la recette Nexus/4G et les alertes restent à réaliser.

## Références

- [Keycloak derrière un proxy](https://www.keycloak.org/server/reverseproxy) et [hostname](https://www.keycloak.org/server/hostname).
- [Import de realm](https://www.keycloak.org/server/importExport) et [conteneurs](https://www.keycloak.org/server/containers).
- [Routage Docker Traefik 3.5](https://doc.traefik.io/traefik/v3.5/reference/routing-configuration/other-providers/docker/).
- [PostgreSQL 16 : pg_dump](https://www.postgresql.org/docs/16/app-pgdump.html).
