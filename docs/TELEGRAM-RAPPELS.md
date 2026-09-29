# Telegram — rappels des rendez-vous et courses

Périmètre demandé : bot familial dédié, résumé de l’agenda à 7 h, rappel des événements sans heure à 9 h (choix utilisateur du 19 septembre), rappel une heure avant les événements datés. Tous les horaires suivent Europe/Paris. Les courses Telegram (T05 : capture, boutons, récapitulatif de 17 h 20, urgences, sonde de 17 h 30) sont décrites plus bas. Léo et ses alertes ne sont pas modifiés.

## Parcours personnel

Dans Maison → Réglages → Vos rappels Telegram, chaque membre choisit « Relier mon Telegram », ouvre le lien dans son propre compte Telegram, puis appuie sur Démarrer. Retourner dans Maison et actualiser pour vérifier la liaison (environ 30 secondes). Le bot n’envoie pas de message pendant cette seule liaison. « Tester la réception » demande explicitement un message de test dans la conversation reliée.

Le lien est personnel, aléatoire, valable dix minutes, conservé seulement sous forme d’empreinte dans PostgreSQL, à usage unique. Seules les conversations privées sont acceptées ; le même Telegram ne peut recevoir pour deux membres. Les comptes non membres et le client Alexa sont refusés. Un lien ne peut pas remplacer un compte déjà relié : dissocier d’abord.

« Suspendre mes rappels » et « Journée tranquille » ne concernent que leur auteur. La pause du jour se termine le lendemain à 7 h Paris, y compris aux changements d’heure. Reprise anticipée possible. « Dissocier Telegram » ou /stop supprime la liaison ; un envoi déjà en cours peut néanmoins arriver. Ces réglages couvrent aussi le récapitulatif des courses. Exception décidée par Antoine le 29 septembre (D5) : une course urgente est envoyée même pendant la journée tranquille ; rien n’est envoyé à un membre suspendu.

## Envois et limites explicites

- Google est relu avant chaque cycle. Modifications, annulations et occurrences récurrentes proviennent du connecteur existant ; aucun envoi d’agenda si sa lecture échoue. Les détails privés restent masqués. Ni jeton, ni contenu Telegram/Google dans les journaux ou reçus.
- Résumé à 7 h, y compris « Aucun rendez-vous prévu aujourd’hui ». Événements sans heure en plus dans un rappel groupé à 9 h ; un événement sur plusieurs jours figure chaque jour concerné. Pas de rappel H-1 pour ces événements.
- H-1 est calculé en temps réel depuis chaque début d’occurrence. Un changement du début après un rappel peut entraîner un nouveau rappel à la nouvelle échéance. Les événements ajoutés moins d’une heure avant ne font pas l’objet d’un rappel tardif arbitraire.
- Fenêtres de rattrapage : 15 minutes pour les résumés 7 h/9 h, 5 minutes pour H-1. Après une longue panne, les fenêtres manquées ne sont pas rejouées. Un message déjà envoyé n’est pas édité si Google change ensuite ; ouvrir Maison pour l’agenda actuel.
- Une réservation durable est enregistrée avant l’appel Telegram, par membre et échéance. Le verrou PostgreSQL empêche les doubles services de réserver deux fois. Une réponse Telegram positive signifie acceptation, pas lecture sur le téléphone.
- Telegram ne propose pas de clé d’idempotence pour sendMessage. Si la réponse est perdue ou le processus s’arrête après réservation, l’état reste « non confirmé », sans renvoi automatique pour éviter un doublon. Un message peut donc manquer dans ce cas. Un refus explicite est signalé ; un 429 autorise jusqu’à trois essais bornés par la fenêtre, avec le délai Telegram.
- État visible dans les réglages : service, lecture Google et dernier envoi personnel. Les reçus restent 90 jours, sans texte du rendez-vous. Aucun système externe de secours/alerte n’est ajouté ici.
- Un test manuel possède une clé de reprise ; une nouvelle demande est limitée à une par minute et expire après cinq minutes. Les rappels doivent être activés, hors journée tranquille.

## Courses Telegram (T05)

Règles validées par Antoine, appliquées telles quelles. Toutes les heures sont celles de Paris, changements d’heure compris.

- **Capture** : dans sa conversation privée reliée, chaque membre écrit un article par ligne (10 au plus par message, 255 caractères chacun). Les commandes commençant par « / » ne sont jamais capturées ; un Telegram non relié, un groupe ou un expéditeur différent de la conversation sont ignorés. La confirmation (message et boutons) n’est envoyée **qu’après l’enregistrement durable** dans PostgreSQL. La clé de reprise `telegram:<update_id>` empêche un doublon si le service s’arrête entre l’enregistrement et l’avancement de la file Telegram.
- **Boutons** (sous chaque confirmation, récapitulatif et urgence) : ✅ acheté clôt la demande ; 📅 Demain reporte au lendemain (une date déjà plus tardive est conservée) ; ❗ Urgent marque la demande et déclenche la notification immédiate ; ✖ retire la demande (annulation conservée dans l’historique). Sans action, la demande reste ouverte. Une demande déjà achetée ou retirée n’est pas modifiée ; la réponse l’indique. Les actions sont faites au nom du membre relié et sont visibles par l’autre dans Maison et dans les messages suivants.
- **Récapitulatif 17 h 20** : envoyé aux deux membres. Il contient les demandes ouvertes disponibles aujourd’hui ou avant (reports arrivés à échéance et anciennes demandes encore ouvertes compris) **reçues au plus tard à 17 h 15**. Les ajouts après 17 h 15 sont visibles tout de suite dans la liste et entrent dans le récapitulatif suivant ; une urgence ne change pas cette coupure. Sans demande éligible : « Rien à acheter aujourd’hui » (choix D1, pour le pilote, à réévaluer à sa fin). 30 lignes et 12 lignes de boutons au plus (message sous la limite Telegram de 4 096 caractères) ; au-delà, « Suite dans Maison ». Fenêtre d’envoi 17 h 20–17 h 30 ; pas d’envoi tardif après une panne plus longue. Envoyer ou lire le récapitulatif ne clôt rien.
- **Urgences** : toute demande devenue urgente (Telegram ou Maison) est notifiée une fois aux membres reliés autres que son auteur, dans les 30 secondes environ (cycle du service). Pendant la journée tranquille : envoyée (D5). Membre suspendu ou dissocié : rien. Les demandes déjà urgentes à la première mise en service ne sont pas renvoyées. Fenêtre de reprise 30 minutes.
- **Suivi des envois** : chaque envoi a un reçu par membre (`recap`, `urgent`, `capture`, `probe`…) sans le texte des courses. Réglages affiche le dernier récapitulatif et le dernier contrôle.
- **Sonde 17 h 30** (fenêtre 15 minutes) : vérifie que Telegram a **accepté** le récapitulatif de chaque membre attendu (relié, rappels actifs, hors journée tranquille). Elle ne prouve pas la lecture. En cas d’écart, une seule alerte va à Antoine (compte Maison désigné par `TELEGRAM_ALERT_USER`), même en journée tranquille, pas s’il est suspendu ou dissocié ; résultat visible dans Réglages. Si le service est arrêté de 17 h 20 à 17 h 45, ni récapitulatif ni sonde : cette panne relève de la surveillance d’exploitation (T08).

Limites acceptées pour le pilote : pas de quantité/unité/rayon par Telegram (à compléter dans Maison) ; pas de message vocal ; un message déjà envoyé n’est pas mis à jour quand la liste change ; un membre relié entre 17 h 20 et 17 h 30 peut déclencher une alerte sans objet.

## Installation Nexus

Prérequis : bot familial créé personnellement avec BotFather, getMe vérifié, aucun webhook existant, Google déjà installé. Aucun port public pour Telegram : réception par getUpdates sortant. Ne pas supprimer le webhook d’un autre service ni réutiliser son bot.

Configuration privée .private/nexus/telegram.env :

```dotenv
TELEGRAM_RELEASE=<commit immuable API/web/worker>
TELEGRAM_BOT_USERNAME=<identifiant du bot sans arobase>
# T05, facultatif : identifiant (UUID) du compte Maison d’Antoine, seul destinataire de l’alerte de 17 h 30.
TELEGRAM_ALERT_USER=<UUID du compte Maison>
```

T05 n’ajoute aucune migration : son état (file de réponses, urgences vues, sondes) vit dans `telegram_state`. Le worker lit et écrit les courses avec la même base et le même `DATABASE_URL`.

Jeton dans .private/nexus/telegram-token, hors Git, propriétaire compatible UID 1000, mode 600 ; monté en lecture seule uniquement dans le service telegram. L’API connaît seulement le nom public du bot. Le worker reçoit aussi la configuration Google existante et n’a aucun port hôte. Aucun coût ou permission Google supplémentaire.

1. Sauvegarder avant intervention et conserver les images/configurations API/web précédentes.
2. Construire API/web de la révision voulue ; activer l’overlay privé telegram.env.
3. Exécuter migrate (migration additive 006_telegram_reminders.sql), contrôler Nginx, puis recréer api/web et démarrer telegram.
4. Vérifier les services, /ready, les routes privées anonymes refusées, puis effectuer la liaison et un test personnel pour chaque membre.

common.sh charge l’overlay Telegram après Google. TELEGRAM_RELEASE prend alors la priorité pour API, web et migrate. backup.sh conserve aussi le jeton et la configuration Telegram dans les sauvegardes privées ; ne jamais publier ces sauvegardes.

Retour arrière T05 seul : recréer API/web/worker avec l’image de la révision précédente (fb9aedf) ; l’ancienne version ignore les nouvelles clés d’état et les boutons (elle ne demande plus les `callback_query`). Les courses déjà ajoutées par Telegram restent dans la liste.

Retour arrière complet : arrêter le service telegram pendant que son overlay est actif, retirer uniquement telegram.env de la configuration active en conservant une copie privée, revenir au code précédent et recréer API/web avec leurs anciennes images Google. Conserver la table 006 et ses liaisons/reçus ; ne pas restaurer une base ancienne pour ce seul retour. Aucun événement Google n’est créé ou supprimé par ce lot.

## Vérifications

Tests : horaires Paris été/hiver, 7 h et 9 h, journée entière/multijour, masquage privé, taille de message, lien expiré/consommé, groupe refusé, isolation des comptes, Google indisponible, pause, /stop, reprise après envoi ambigu, 429 borné, PostgreSQL réel et concurrence, révocation des membres, refus anonyme/Alexa. Les tests simulés ne prouvent pas la réception sur les deux téléphones ; celle-ci reste une recette utilisateur distincte, tout comme les premiers rappels aux horaires réels.

Sources : [Bot API — sendMessage](https://core.telegram.org/bots/api#sendmessage), [getUpdates](https://core.telegram.org/bots/api#getupdates), [liens personnels](https://core.telegram.org/bots/features#deep-linking).
