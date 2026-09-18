# Google Agenda — affichage et création dans Maison

Première tranche T06 : l’agenda Google dédié est la référence, sans copie locale des rendez-vous. Les membres autorisés lisent la période choisie et ajoutent un rendez-vous daté ou une journée entière, avec lieu et précisions. La page Aujourd’hui montre les trois prochains rendez-vous de la période chargée.

## Comportement

- Lecture directe à l’ouverture, à l’actualisation et toutes les 30 secondes lorsque Maison est visible. Les changements et annulations Google sont relus ; les récurrences sont développées en occurrences. Période limitée à 93 jours, pagination complète ou erreur explicite.
- Création directe dans l’agenda partagé. Date et heure de début/fin explicites, interprétées en Europe/Paris. L’heure inexistante au printemps et l’heure ambiguë à l’automne sont refusées : choisir une autre heure ou utiliser Google.
- Journées entières : la date de fin affichée est inclusive ; Google reçoit le lendemain comme borne exclusive.
- Une clé de reprise persistée dans cet onglet, par foyer et compte, produit un identifiant Google déterministe. Après perte de réponse, reprendre le même envoi retrouve le rendez-vous. Une modification faite ensuite dans Google n’est jamais écrasée. Un rendez-vous annulé n’est pas recréé par la reprise.
- Les détails privés sont masqués aussi dans le résultat renvoyé au navigateur. Aucune gestion du partage ni autre calendrier accessible par ces routes. Le client Alexa reste limité aux courses.
- En cas de panne Google, une ancienne lecture est signalée comme telle et aucun ajout n’est annoncé comme confirmé. Aucun jeton Google ou secret dans les réponses, journaux ou fichiers publics.

Les modifications, annulations et règles de répétition se font dans Google Agenda, accessible depuis Maison. Les créneaux à double validation, rappels Telegram et capture vocale de rendez-vous ne font pas partie de cette tranche et restent à réaliser. T06 reste En cours jusqu’aux validations correspondantes.

## Configuration privée Nexus

Le compte de service n’a aucun rôle Google Cloud ; il reçoit uniquement le droit de modifier l’agenda dédié, sans détails privés ni gestion du partage. Projet sans compte de facturation, aucune ressource payante. La clé JSON reste dans `.private/nexus/google-calendar.json`, lisible uniquement par le propriétaire (UID compatible avec le conteneur Node), montée en lecture seule dans l’API.

Fichier privé `.private/nexus/google-calendar.env` :

```dotenv
GOOGLE_RELEASE=<commit immuable des images API et web>
GOOGLE_CALENDAR_ID=<agenda dédié>
```

`common.sh` active alors `google-calendar.yml`. Le foyer vient de la configuration privée existante. Seuls API et web changent d’image ; l’API reçoit un réseau de sortie dédié pour joindre Google, aucun port hôte supplémentaire. Le service Alexa conserve sa propre révision. Aucune modification DNS, Traefik, Nextcloud ou autre application.

Sauvegarder avant installation. `backup.sh` conserve aussi la configuration Google et la clé dans le répertoire privé de sauvegarde. Ces copies sont sensibles ; la protection hors serveur reste à décider. Pour revenir en arrière, retirer l’overlay privé et recréer API/web avec leurs images précédentes ; aucune migration de base n’est nécessaire.

## Vérifications

Tests automatiques : authentification/famille/client Alexa, heure d’été/hiver, journées entières, pagination, récurrences, annulations, masquage privé, panne Google, clé réutilisée avec un autre contenu et reprise navigateur après réponse perdue. Les tests simulés ne prouvent pas à eux seuls l’accès Google réel : effectuer séparément la recette du compte dédié et l’essai utilisateur dans Maison.

Références : [création Google](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), [lecture Google](https://developers.google.com/workspace/calendar/api/v3/reference/events/list).
