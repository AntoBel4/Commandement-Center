# V1 — Contrat d'architecture et de livraison

Statut : proposition d'implémentation, pas une description des fonctions déjà opérationnelles.
Point de départ audité : commit 03cf35c05a16714bf49958d191dc092980124b00.
Les décisions personnelles, les horaires réels, les identifiants de comptes et les détails d'infrastructure restent hors de ce dépôt public.

## Objectif

Une application familiale auto-hébergée sous Docker, utilisable sur Android, avec courses partagées, agenda et capture Alexa. Telegram assure les récapitulatifs et actions rapides. Les futurs modules menus, recettes et domotique utilisent les mêmes identifiants et contrats d'API.

## Architecture proposée

Conserver Fastify et PostgreSQL ; améliorer progressivement le code existant.
Livrer un seul projet Docker Compose, avec application web/API, traitement des tâches et base séparés si nécessaire.
Réutiliser Traefik existant. Le réseau proxy externe et le domaine sont des paramètres de déploiement.
La base reste sur un réseau interne sans port publié. Le worker doit disposer d'une sortie réseau contrôlée pour joindre Telegram et les fournisseurs, sans exposer son propre port.
Une interface responsive sert les téléphones et les futures tablettes ; aucune application Android native n'est requise pour la V1.
Aucun fonctionnement hors ligne ni infrastructure de plugins dynamique n'est nécessaire à ce stade.

### Responsabilité des données

- Proposition à confirmer : PostgreSQL est la référence pour les courses et les actions.
- Google Calendar est la référence pour les événements confirmés. Les demandes en attente sont identifiées séparément.
- Le rôle opérationnel de Notion reste à décider : suivi du projet uniquement, vue en lecture seule, ou édition directe. Aucun connecteur bidirectionnel implicite.
- Telegram et Alexa sont des canaux de capture et d'action, pas des bases indépendantes.
- Une interface CalendarProvider isole Google ; un adaptateur CalDAV permettra une migration Nextcloud contrôlée ultérieure.

### Courses

Chaque demande possède un identifiant stable, une origine, une date de capture, un auteur connu ou une attribution au foyer, une date de disponibilité et un état ouvert/acheté/annulé.
Le report au lendemain modifie la date de disponibilité sans clore la demande.
Une demande non traitée reste ouverte. Consultation d'un résumé et achat sont deux actions différentes.
L'action Acheter est explicite et idempotente. Un ancien bouton Telegram relit l'état courant avant de modifier.
Les regroupements respectent article, unité et quantité ; ne pas additionner des unités incompatibles.
Le dédoublonnage des requêtes utilise l'identifiant du message ou de la requête source, pas uniquement le nom de l'article.
Les modifications concurrentes des deux utilisateurs doivent être couvertes.

### Récapitulatifs

Heure de coupure, heure d'envoi, jours actifs et destinataires sont configurables dans le fuseau du foyer.
La coupure sélectionne les demandes reçues au plus tard à l'heure limite. Les ajouts ultérieurs restent immédiatement visibles et deviennent éligibles au récapitulatif suivant. Les paramètres réels sont conservés dans la configuration privée.
Inclure les demandes ouvertes devenues éligibles, y compris celles reportées des jours précédents.
Conserver un instantané et un historique par destinataire. Traiter les changements entre sélection et envoi.
Persister les envois dans une outbox transactionnelle ; reprise après redémarrage, essais bornés et alerte finale.
Telegram ne garantit pas l'exactement-une-fois après un résultat réseau ambigu : tracer cet état et éviter de promettre zéro doublon.
Un acquittement de Telegram prouve l'acceptation par le service, pas la lecture sur le téléphone.
Une action Urgent explicite déclenche une notification immédiate aux destinataires autorisés.

### Agenda

Utiliser un agenda partagé explicitement sélectionné.
Les créations par le Centre sont envoyées au fournisseur ; un échec est présenté comme attente ou erreur, jamais comme événement synchronisé.
Lire les modifications faites depuis Google, les annulations et les occurrences récurrentes.
Gérer dates sans heure, fuseaux, heure d'été/hiver et identifiants fournisseur.
Les rappels du jour J ont leur propre calendrier, indépendant de la coupure courses.
Une resynchronisation doit remplacer le cache du fournisseur, sans effacer les demandes locales non encore confirmées.
Tester le renouvellement des autorisations et le mode de publication OAuth adapté avant de déclarer la connexion durable.

### Alexa

Objectif V1 : ajout de courses et événements depuis une skill française sur les enceintes du foyer.
Valider d'abord la phrase d'invocation et un ajout réel sur appareil.
Hébergement recommandé du service de skill dans la stack Docker, via HTTPS derrière Traefik, pour éviter une dépendance Lambda additionnelle.
Valider signature, chaîne de certificat, horodatage, skill ID et liaison du compte Amazon au foyer avec les bibliothèques adaptées.
Un secret global seul ne valide pas une requête Amazon.
Confirmer la capture durable avant la réponse vocale ; traiter les intégrations lentes après.
Une enceinte partagée ne prouve pas qui parle : ne pas inventer l'auteur individuel.
Dates ambiguës et demandes incomprises entraînent une clarification.
Le mode développement/pilote et la distribution durable sont des étapes distinctes à valider.

### Authentification

Accès web HTTPS sans VPN obligatoire pour les usages quotidiens ; administration restreinte.
Réutiliser un fournisseur d'identité existant si disponible. Choix final en attente de l'inventaire.
Deux utilisateurs autorisés, inscriptions publiques désactivées, sessions révocables.
Aucune exposition de production avec AUTH_ENABLED=false.
Contrôles côté API sur chaque ressource et chaque action ; identifiants de famille imposés par l'identité autorisée.
Pour les sessions par cookies : Secure, HttpOnly, SameSite adapté et protection CSRF.
Pour Telegram : vérifier expéditeur, conversation autorisée et validité des callbacks. Authentifier aussi les appels n8n.
Ne pas remplacer le webhook existant de Léo : un seul point d'entrée reçoit les mises à jour et les distribue.
Secrets hors Git, logs sans contenu familial complet, accès des intégrations limité au strict nécessaire.

## Exploitation

- Sonde de vie du processus et sonde de disponibilité incluant la base.
- Surveillance métier : récapitulatifs attendus, envois acceptés, file bloquée, fraîcheur agenda, validité des autorisations, fraîcheur sauvegarde.
- Sonde hors serveur pour détecter panne hôte, DNS ou HTTPS ; alerte Telegram sans dépendance à n8n hébergé sur l'hôte surveillé.
- Une alerte initiale, rappels espacés si nécessaire et notification de rétablissement ; séparer alertes techniques et messages familiaux.
- Export PostgreSQL cohérent avant sauvegarde chiffrée hors machine. Restaurer dans un environnement séparé et vérifier les données.
- Versionner les migrations ; les scripts d'initialisation Docker ne suffisent pas pour une base déjà créée.
- Images de livraison identifiées, mise à jour planifiée et retour arrière documenté, y compris compatibilité du schéma.
- Les objectifs de perte de données et de temps de restauration restent à convenir.

## Lots et preuves attendues

1. Inventaire : cible, identité, webhook existant, agenda, données antérieures et capacité connus.
2. Socle courses : ajout depuis deux sessions, achat, report, redémarrage, concurrence et contrôle d'accès testés sur PostgreSQL.
3. Telegram : capture et boutons ; limites de coupure, fuseau, redémarrage et échec d'envoi testés avec horloge contrôlée.
4. Agenda : création, modification externe, annulation, récurrence et rappel vérifiés.
5. Alexa : preuve précoce sur un Echo, puis ajout course/événement depuis les deux appareils et rejet des requêtes non autorisées.
6. Livraison : Traefik, authentification, sauvegarde/restauration, alerte réelle et retour arrière validés.
7. Pilote : une semaine d'usage réel, incidents corrigés et guide d'exploitation remis.

## Évolutions

Menus et recettes produisent des demandes de courses via l'API existante.
Home Assistant utilise un jeton dédié à droits limités et les points d'API documentés ; aucune dépendance obligatoire à Home Assistant en V1.
Une vue tablette utilise la même application avec droits adaptés.
Nextcloud remplace le fournisseur agenda après rapprochement des données et essai de migration.

## Références

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Google Calendar — synchronisation](https://developers.google.com/workspace/calendar/api/guides/sync)
- [Alexa — héberger une skill HTTPS](https://developer.amazon.com/en-US/docs/alexa/custom-skills/host-a-custom-skill-as-a-web-service.html)
- [Alexa — tests sur appareil](https://developer.amazon.com/en-US/docs/alexa/test/test-your-skill-overview.html)
- [Home Assistant — commandes REST](https://www.home-assistant.io/integrations/rest_command/)
