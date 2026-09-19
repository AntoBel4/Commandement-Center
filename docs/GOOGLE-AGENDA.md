# Google Agenda — affichage et création dans Maison

Première tranche T06 : l’agenda Google dédié est la référence, sans copie locale des rendez-vous. Les membres autorisés lisent la période choisie et ajoutent un rendez-vous daté ou une journée entière, avec lieu et précisions. La page Aujourd’hui montre les trois prochains rendez-vous de la période chargée.

## Comportement

- Lecture directe à l’ouverture, à l’actualisation et toutes les 30 secondes lorsque Maison est visible. Les changements et annulations Google sont relus ; les récurrences sont développées en occurrences. Période limitée à 93 jours, pagination complète ou erreur explicite.
- Création directe dans l’agenda partagé. Date et heure de début/fin explicites, interprétées en Europe/Paris. L’heure inexistante au printemps et l’heure ambiguë à l’automne sont refusées : choisir une autre heure ou utiliser Google.
- Journées entières : la date de fin affichée est inclusive ; Google reçoit le lendemain comme borne exclusive.
- Une clé de reprise persistée dans cet onglet, par foyer et compte, produit un identifiant Google déterministe. Après perte de réponse, reprendre le même envoi retrouve le rendez-vous. Une modification faite ensuite dans Google n’est jamais écrasée. Un rendez-vous annulé n’est pas recréé par la reprise.
- Les détails privés sont masqués aussi dans le résultat renvoyé au navigateur. Aucune gestion du partage ni autre calendrier accessible par ces routes. Le client Alexa reste limité aux courses.
- En cas de panne Google, une ancienne lecture est signalée comme telle et aucun ajout n’est annoncé comme confirmé. Aucun jeton Google ou secret dans les réponses, journaux ou fichiers publics.

Les modifications, annulations et règles de répétition des événements confirmés se font dans Google Agenda, accessible depuis Maison. Les rappels Telegram et la capture vocale restent dans leurs lots. T06 reste En cours jusqu’aux validations correspondantes.

## Proposer des créneaux et décider à deux

Phase choisie le 19 septembre 2026 : saisie manuelle, sans recherche automatique de disponibilités.

- « Proposer des créneaux » partage un titre, un lieu et des précisions facultatives, avec 1 à 5 horaires explicites en heure de Paris. Les doublons, fins invalides, heures ambiguës et créneaux déjà commencés sont refusés. Les conflits avec l’agenda ne sont pas recherchés.
- La proposition seule ne vaut pas accord. Chaque membre valide un seul créneau depuis son compte. Les choix et la proposition persistent dans PostgreSQL ; un changement de choix remplace seulement celui de son auteur. Aucun compte ne peut valider pour l’autre.
- Tant que les choix diffèrent, rien n’est envoyé à Google. Deux choix identiques figent la proposition et déclenchent la création du seul horaire retenu. En cas de lecture périmée, recharger puis valider à nouveau ; aucun accord obsolète n’est appliqué silencieusement.
- Un encadré affiche explicitement « Sans accord commun » lorsque les deux membres ont choisi des horaires différents, et rappelle qu’aucun rendez-vous n’est créé. Avec zéro ou un accord, il précise quelle validation reste attendue.
- Avant les deux accords, chacun peut retirer son accord ou annuler la proposition. Pour changer le titre, le lieu, les précisions ou les horaires, annuler et proposer de nouveau : les anciens accords ne sont pas réutilisés.
- La phase de création est enregistrée durablement avant l’appel Google. Une réponse perdue, un redémarrage ou deux reprises simultanées conservent le même identifiant Google, même si l’autre membre reprend. « Vérifier la création » permet une reprise explicite ; aucun traitement automatique en arrière-plan. Pendant cette vérification, le choix reste figé et ne peut être annulé dans Maison.
- « Création confirmée » n’apparaît qu’après réponse Google. L’historique décrit cette création ; les modifications et suppressions ultérieures restent reflétées par la lecture de l’agenda. Si Google a annulé un événement dont la réponse initiale avait été perdue, il n’est pas recréé ; vérifier directement dans Google.
- La création directe existante reste un parcours distinct pour un rendez-vous déjà décidé. Le client Alexa ne peut accéder aux propositions. Une modification des membres du foyer bloque les validations des anciennes propositions.

Recette guidée après installation : partager deux créneaux ; vérifier leur présence depuis l’autre compte et l’absence dans Google ; donner un seul accord ; choisir des horaires différents ; réunir les deux accords sur le même horaire ; vérifier un unique événement ; essayer ensuite retrait et annulation sur une autre proposition.

## Configuration privée Nexus

Le compte de service n’a aucun rôle Google Cloud ; il reçoit uniquement le droit de modifier l’agenda dédié, sans détails privés ni gestion du partage. Projet sans compte de facturation, aucune ressource payante. La clé JSON reste dans `.private/nexus/google-calendar.json`, lisible uniquement par le propriétaire (UID compatible avec le conteneur Node), montée en lecture seule dans l’API.

Fichier privé `.private/nexus/google-calendar.env` :

```dotenv
GOOGLE_RELEASE=<commit immuable des images API et web>
# Facultatif : correctif d’affichage seul, sans recréer API/migrate.
GOOGLE_WEB_RELEASE=<commit immuable de l’image web>
GOOGLE_CALENDAR_ID=<agenda dédié>
```

`common.sh` active alors `google-calendar.yml`. Le foyer vient de la configuration privée existante. Seuls API et web changent d’image ; l’API reçoit un réseau de sortie dédié pour joindre Google, aucun port hôte supplémentaire. Le service Alexa conserve sa propre révision. Aucune modification DNS, Traefik, Nextcloud ou autre application.

Sans GOOGLE_WEB_RELEASE, web suit GOOGLE_RELEASE. Pour une correction d’affichage seule, conserver GOOGLE_RELEASE, définir GOOGLE_WEB_RELEASE et recréer uniquement web. Pour revenir à un déploiement commun API/web ou appliquer le retour arrière ci-dessous, retirer cette surcharge ou l’aligner sur la révision voulue. Conserver les images précédentes et une copie privée du fichier d’environnement avant le changement.

Sauvegarder avant installation. `backup.sh` conserve aussi la configuration Google et la clé dans le répertoire privé de sauvegarde. Ces copies sont sensibles ; la protection hors serveur reste à décider.

Cette phase ajoute la migration `005_calendar_proposals.sql`. Construire les images de la révision choisie, positionner `GOOGLE_RELEASE`, exécuter le service `migrate` avec cette même image (overlay Google), puis seulement recréer API/web. Le contrôle de disponibilité exige la nouvelle table. Vérifier aussi la configuration Nginx des routes propositions. Aucune nouvelle clé, permission Google ni ressource payante n’est nécessaire.

Retour arrière vers la lecture/création déjà installée : conserver l’overlay Google, remettre `GOOGLE_RELEASE=6534c0c6368eca9d8b929dbfa3a5d3bd4899dd4f`, rétablir sa configuration Nginx et recréer API/web. Conserver la table et les propositions ; ne pas annuler la migration ni restaurer toute la base pour ce seul retour arrière. Les propositions attendront la réinstallation de cette phase ; les événements déjà créés restent dans Google. Un retour à une version antérieure à Google requiert le retrait de l’overlay privé.

## Vérifications

Tests automatiques : authentification/famille/client Alexa, heure d’été/hiver, journées entières, pagination, récurrences, annulations, masquage privé, panne Google, clé réutilisée avec un autre contenu et reprise navigateur après réponse perdue. Les tests simulés ne prouvent pas à eux seuls l’accès Google réel : effectuer séparément la recette du compte dédié et l’essai utilisateur dans Maison.

Références : [création Google](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), [lecture Google](https://developers.google.com/workspace/calendar/api/v3/reference/events/list).
