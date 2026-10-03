# V1 — Contrat d'architecture et de livraison

État mis à jour le 3 octobre 2026. Contrat et limites de livraison, distincts des preuves de production : Maison est en service ; API/web/Telegram déployés à 5bb65aa depuis la PR 10. Les PR 8, 9 et 10 restent ouvertes, non fusionnées. Tests courses Telegram Antoine réussis ; Belinda, envois aux horaires réels et pilote restent ouverts. T07 rendez-vous vocaux hors pilote, encore à faire. T08 installé avec preuves partielles ; reprise complète sur autre machine non éprouvée.

La [fiche d’état actuelle](https://github.com/AntoBel4/Commandement-Center/blob/main/docs/PROJECT-STATE.md) et Notion portent les preuves datées. Les sections ci-dessous décrivent le périmètre cible et les choix, sans valoir validation de chaque critère.

## Objectif

Une application familiale auto-hébergée sous Docker, utilisable sur Android, avec courses partagées, agenda et capture Alexa. Telegram assure les récapitulatifs et actions rapides. Les futurs modules menus, recettes et domotique utilisent les mêmes identifiants et contrats d'API.

## Portail web — livrable V1

Le site web privé est une interface centrale du produit, en complément de Telegram et Alexa.
Il est hébergé dans la stack Docker derrière Traefik. Le domaine réel est configuré au déploiement.

Pages du portail (livrées ; recette globale et intégrations suivies séparément) :
- Accueil : aperçu de la journée, prochains rendez-vous, courses ouvertes, urgences et ajout rapide.
- Courses : liste commune, quantités, ajout/modification, achat, report et urgence.
- Agenda : jour/semaine, création et lecture des événements du fournisseur, indication des demandes en attente.
- Réglages : préférences utilisateur et notifications ; configuration technique réservée à l'administrateur.

La maquette navigable avec données fictives est validée et conservée dans prototype/index.html. Le portail réel est raccordé ; la maquette ne représente pas ses données courantes.
Direction visuelle proposée : claire, chaleureuse, lisible et adaptée au tactile.
Livrer des mises en page téléphone, ordinateur et tablette, ainsi qu'un raccourci Android.
Les modules futurs pourront enrichir la navigation ; aucun bouton de module inachevé présenté comme opérationnel.

Critères de livraison : revue visuelle, recette comptes/courses sur le téléphone d’Antoine (second appareil dispensé pour T04b), puis recette des intégrations sur les deux comptes, absence de débordement horizontal, états de chargement/erreur explicites, accès HTTPS extérieur et refus des données aux visiteurs non connectés.

## Architecture retenue

Conserver Fastify et PostgreSQL ; améliorer progressivement le code existant.
Livrer un seul projet Docker Compose, avec application web/API, traitement des tâches et base séparés si nécessaire.
Réutiliser Traefik existant. Le réseau proxy externe et le domaine sont des paramètres de déploiement.
La base reste sur un réseau interne sans port publié. Le worker doit disposer d'une sortie réseau contrôlée pour joindre Telegram et les fournisseurs, sans exposer son propre port.
Une interface responsive sert les téléphones et les futures tablettes ; aucune application Android native n'est requise pour la V1.
Aucun fonctionnement hors ligne ni infrastructure de plugins dynamique n'est nécessaire à ce stade.

### Responsabilité des données

- PostgreSQL est la référence pour les courses et les actions. L'application et Telegram sont les interfaces retenues.
- Google Calendar est la référence pour les événements confirmés. Les demandes en attente sont identifiées séparément.
- Notion sert au suivi du projet. Aucune synchronisation des courses vers Notion dans la V1.
- Telegram et Alexa sont des canaux de capture et d'action, pas des bases indépendantes.
- Une interface CalendarProvider isole Google ; un adaptateur CalDAV permettra une migration Nextcloud contrôlée ultérieure.

### Courses

Chaque demande possède un identifiant stable, une origine, une date de capture, un auteur connu ou une attribution au foyer, une date de disponibilité et un état ouvert/acheté/annulé.
Le report au lendemain modifie la date de disponibilité sans clore la demande.
Une demande non traitée reste ouverte. Consultation d'un résumé et achat sont deux actions différentes.
L'action Acheter est explicite et idempotente. Un ancien bouton Telegram relit l'état courant avant de modifier.
Les regroupements respectent article, unité et quantité ; ne pas additionner des unités incompatibles.
Le dédoublonnage des requêtes utilise l'identifiant du message ou de la requête source, pas uniquement le nom de l'article.
Les modifications concurrentes des deux utilisateurs doivent être couvertes. Le socle T02 utilise une version d’article pour refuser une écriture obsolète, une clé de reprise par envoi et un historique transactionnel. L’auteur est déduit de l’identité autorisée. La suppression visible annule la demande sans effacer son historique.
Le parcours « Je m’en occupe » fait partie de la recette comptes/courses acceptée ; distinguer cette validation des nouvelles fonctions Telegram.

### Récapitulatifs

V1 : horaires fixes Europe/Paris, coupure 17 h 15, récapitulatif quotidien 17 h 20 et sonde d’acceptation 17 h 30 pour les membres attendus. Aucun écran de configuration de ces horaires n’est promis.
La coupure sélectionne les demandes reçues au plus tard à l'heure limite. Les ajouts ultérieurs restent immédiatement visibles et deviennent éligibles au récapitulatif suivant. Pendant le pilote, un récapitulatif vide affiche « Rien à acheter aujourd’hui » (D1).
Inclure les demandes ouvertes devenues éligibles, y compris celles reportées des jours précédents.
Conserver des reçus par destinataire sans texte familial. Les messages envoyés ne sont pas modifiés lorsque la liste change ; Maison fait foi.
Persister les réservations et réponses ; reprises bornées dans les fenêtres documentées. Envoi ambigu : pas de renvoi automatique arbitraire. La sonde contrôle l’acceptation, pas la lecture.
Telegram ne garantit pas l'exactement-une-fois après un résultat réseau ambigu : tracer cet état et éviter de promettre zéro doublon.
Un acquittement de Telegram prouve l'acceptation par le service, pas la lecture sur le téléphone.
Une action Urgent explicite notifie l’autre membre relié, même en journée tranquille, mais pas s’il est suspendu (D5). Réception croisée encore à éprouver.

### Agenda

Créer un agenda Google familial partagé, puis le sélectionner explicitement.
Les créneaux sont saisis manuellement (1 à 5), sans calcul automatique des disponibilités ; les deux personnes doivent valider le même créneau avant création.
Les créations par le Centre sont envoyées au fournisseur ; un échec est présenté comme attente ou erreur, jamais comme événement synchronisé.
Lire les modifications faites depuis Google, les annulations et les occurrences récurrentes.
Gérer dates sans heure, fuseaux, heure d'été/hiver et identifiants fournisseur.
Un récapitulatif le jour J et un rappel avant chaque rendez-vous sont requis. Le second rappel est prévu une heure avant le rendez-vous. Ils ont leur propre calendrier, indépendant de la coupure courses.
Une resynchronisation doit remplacer le cache du fournisseur, sans effacer les demandes locales non encore confirmées.
L’intégration installée utilise un compte de service Google dédié et le partage explicite de l’agenda ; vérifier la continuité de cet accès, sans imposer une publication OAuth d’utilisateur qui ne correspond pas au connecteur retenu.

### Alexa

Courses acceptées depuis l’application Alexa du téléphone ; essais supplémentaires sur Echo dispensés, sans preuve sur enceintes affirmée. Rendez-vous vocaux T07 encore à réaliser, hors pilote.
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
Keycloak est installé en production ; administration nominative vérifiée et compte bootstrap désactivé le 3 octobre, état conservé après redémarrage.
Deux utilisateurs autorisés, inscriptions publiques désactivées, sessions révocables.
Aucune exposition de production avec AUTH_ENABLED=false. Le socle T02 refuse ce démarrage ; le client navigateur et l’API ont des audiences distinctes et PKCE S256 est requis. Les tests Keycloak locaux utilisent des comptes fictifs ; ils ne remplacent pas la configuration et la recette des comptes réels.
Contrôles côté API sur chaque ressource et chaque action ; identifiants de famille imposés par l'identité autorisée.
Pour les sessions par cookies : Secure, HttpOnly, SameSite adapté et protection CSRF.
Pour Telegram : vérifier expéditeur, conversation autorisée et validité des callbacks. Authentifier aussi les appels n8n.
Léo et la surveillance existante restent inchangés. Le bot Maison, en interrogation sortante sans webhook public, porte les fonctions familiales et les alertes Maison au seul administrateur configuré.
Secrets hors Git, logs sans contenu familial complet, accès des intégrations limité au strict nécessaire.

## Exploitation

- Sonde de vie du processus et sonde de disponibilité incluant la base.
- Surveillance métier : récapitulatifs attendus, envois acceptés, file bloquée, fraîcheur agenda, validité des autorisations, fraîcheur sauvegarde.
- Les alertes de panne et de rétablissement de l'hôte existent déjà selon l'administrateur. Les conserver et documenter leur couverture ; compléter uniquement la surveillance propre à l'application. Le contrôle d'une panne totale doit rester indépendant de l'hôte surveillé.
- Une alerte initiale, rappels espacés si nécessaire et notification de rétablissement ; séparer alertes techniques et messages familiaux.
- Export PostgreSQL cohérent avant sauvegarde chiffrée hors machine. Restaurer dans un environnement séparé et vérifier les données.
- Versionner les migrations ; les scripts d'initialisation Docker ne suffisent pas pour une base déjà créée.
- Images de livraison identifiées, mise à jour planifiée et retour arrière documenté, y compris compatibilité du schéma.
- Objectifs retenus : perte maximale 24 h ; reprise 4 h sur Nexus, 24 h ailleurs. Ce sont des objectifs, pas des délais de reprise mesurés. Sauvegarde nocturne chiffrée hors site ; clé privée USB/papier hors Nexus, compte d’envoi sans lecture/suppression, versions GOVERNANCE 30 jours minimum et conservation distante sans purge.

## Lots et preuves attendues

1. Inventaire : cible, identité, webhook existant, agenda, données antérieures et capacité connus.
2. Socle courses : ajout depuis deux sessions, achat, report, redémarrage, concurrence et contrôle d'accès testés sur PostgreSQL.
3. Telegram : capture et boutons ; limites de coupure, fuseau, redémarrage et échec d'envoi testés avec horloge contrôlée.
4. Agenda : création, modification externe, annulation, récurrence et rappel vérifiés.
5. Alexa : parcours courses accepté sur téléphone, dispense des essais Echo conservée ; T07 rendez-vous vocaux à traiter après le pilote, rejet des requêtes non autorisées à maintenir.
6. Portail : maquette examinée, quatre pages raccordées et essais sur téléphone/ordinateur ; mise en ligne HTTPS via Traefik, authentification, sauvegarde/restauration, alerte réelle et retour arrière validés.
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
