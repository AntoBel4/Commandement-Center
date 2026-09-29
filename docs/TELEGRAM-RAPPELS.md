# Telegram — rappels des rendez-vous

Périmètre demandé : bot familial dédié, résumé de l’agenda à 7 h, rappel des événements sans heure à 9 h (choix utilisateur du 19 septembre), rappel une heure avant les événements datés. Tous les horaires suivent Europe/Paris. Les courses Telegram, leur résumé à 17 h 20, leurs boutons et urgences restent dans une tranche T05 distincte. Léo et ses alertes ne sont pas modifiés.

## Parcours personnel

Dans Maison → Réglages → Vos rappels Telegram, chaque membre choisit « Relier mon Telegram », ouvre le lien dans son propre compte Telegram, puis appuie sur Démarrer. Retourner dans Maison et actualiser pour vérifier la liaison (environ 30 secondes). Le bot n’envoie pas de message pendant cette seule liaison. « Tester la réception » demande explicitement un message de test dans la conversation reliée.

Le lien est personnel, aléatoire, valable dix minutes, conservé seulement sous forme d’empreinte dans PostgreSQL, à usage unique. Seules les conversations privées sont acceptées ; le même Telegram ne peut recevoir pour deux membres. Les comptes non membres et le client Alexa sont refusés. Un lien ne peut pas remplacer un compte déjà relié : dissocier d’abord.

« Suspendre mes rappels » et « Journée tranquille » ne concernent que leur auteur. La pause du jour se termine le lendemain à 7 h Paris, y compris aux changements d’heure. Reprise anticipée possible. « Dissocier Telegram » ou /stop supprime la liaison ; un envoi déjà en cours peut néanmoins arriver. Ces réglages couvrent les rappels d’agenda de ce lot, pas les futures notifications urgentes de courses.

## Envois et limites explicites

- Google est relu avant chaque cycle. Modifications, annulations et occurrences récurrentes proviennent du connecteur existant ; aucun envoi d’agenda si sa lecture échoue. Les détails privés restent masqués. Ni jeton, ni contenu Telegram/Google dans les journaux ou reçus.
- Résumé à 7 h, y compris « Aucun rendez-vous prévu aujourd’hui ». Événements sans heure en plus dans un rappel groupé à 9 h ; un événement sur plusieurs jours figure chaque jour concerné. Pas de rappel H-1 pour ces événements.
- H-1 est calculé en temps réel depuis chaque début d’occurrence. Un changement du début après un rappel peut entraîner un nouveau rappel à la nouvelle échéance. Les événements ajoutés moins d’une heure avant ne font pas l’objet d’un rappel tardif arbitraire.
- Fenêtres de rattrapage : 15 minutes pour les résumés 7 h/9 h, 5 minutes pour H-1. Après une longue panne, les fenêtres manquées ne sont pas rejouées. Un message déjà envoyé n’est pas édité si Google change ensuite ; ouvrir Maison pour l’agenda actuel.
- Une réservation durable est enregistrée avant l’appel Telegram, par membre et échéance. Le verrou PostgreSQL empêche les doubles services de réserver deux fois. Une réponse Telegram positive signifie acceptation, pas lecture sur le téléphone.
- Telegram ne propose pas de clé d’idempotence pour sendMessage. Si la réponse est perdue ou le processus s’arrête après réservation, l’état reste « non confirmé », sans renvoi automatique pour éviter un doublon. Un message peut donc manquer dans ce cas. Un refus explicite est signalé ; un 429 autorise jusqu’à trois essais bornés par la fenêtre, avec le délai Telegram.
- État visible dans les réglages : service, lecture Google et dernier envoi personnel. Les reçus restent 90 jours, sans texte du rendez-vous. Aucun système externe de secours/alerte n’est ajouté ici.
- Un test manuel possède une clé de reprise ; une nouvelle demande est limitée à une par minute et expire après cinq minutes. Les rappels doivent être activés, hors journée tranquille.

## Installation Nexus

Prérequis : bot familial créé personnellement avec BotFather, getMe vérifié, aucun webhook existant, Google déjà installé. Aucun port public pour Telegram : réception par getUpdates sortant. Ne pas supprimer le webhook d’un autre service ni réutiliser son bot.

Configuration privée .private/nexus/telegram.env :

```dotenv
TELEGRAM_RELEASE=<commit immuable API/web/worker>
TELEGRAM_BOT_USERNAME=<identifiant du bot sans arobase>
```

Jeton dans .private/nexus/telegram-token, hors Git, propriétaire compatible UID 1000, mode 600 ; monté en lecture seule uniquement dans le service telegram. L’API connaît seulement le nom public du bot. Le worker reçoit aussi la configuration Google existante et n’a aucun port hôte. Aucun coût ou permission Google supplémentaire.

1. Sauvegarder avant intervention et conserver les images/configurations API/web précédentes.
2. Construire API/web de la révision voulue ; activer l’overlay privé telegram.env.
3. Exécuter migrate (migration additive 006_telegram_reminders.sql), contrôler Nginx, puis recréer api/web et démarrer telegram.
4. Vérifier les services, /ready, les routes privées anonymes refusées, puis effectuer la liaison et un test personnel pour chaque membre.

common.sh charge l’overlay Telegram après Google. TELEGRAM_RELEASE prend alors la priorité pour API, web et migrate. backup.sh conserve aussi le jeton et la configuration Telegram dans les sauvegardes privées ; ne jamais publier ces sauvegardes.

Retour arrière : arrêter le service telegram pendant que son overlay est actif, retirer uniquement telegram.env de la configuration active en conservant une copie privée, revenir au code précédent et recréer API/web avec leurs anciennes images Google. Conserver la table 006 et ses liaisons/reçus ; ne pas restaurer une base ancienne pour ce seul retour. Aucun événement Google n’est créé ou supprimé par ce lot.

## Vérifications

Tests : horaires Paris été/hiver, 7 h et 9 h, journée entière/multijour, masquage privé, taille de message, lien expiré/consommé, groupe refusé, isolation des comptes, Google indisponible, pause, /stop, reprise après envoi ambigu, 429 borné, PostgreSQL réel et concurrence, révocation des membres, refus anonyme/Alexa. Les tests simulés ne prouvent pas la réception sur les deux téléphones ; celle-ci reste une recette utilisateur distincte, tout comme les premiers rappels aux horaires réels.

Sources : [Bot API — sendMessage](https://core.telegram.org/bots/api#sendmessage), [getUpdates](https://core.telegram.org/bots/api#getupdates), [liens personnels](https://core.telegram.org/bots/features#deep-linking).
