# Maison — guide d’utilisation pour la famille (T10)

Version mise à jour le 3 octobre 2026, pour le pilote. Maison, c’est notre liste de courses et notre agenda communs, sur `https://famille.estarellas.online` (icône **Maison** sur le téléphone). Chacun a son propre compte ; ce que l’un fait, l’autre le voit.

## Au quotidien

**Courses**
- Ajouter : **Courses → Ajouter à la liste**, ou écrire l’article au bot Telegram Maison (un par ligne), ou « Alexa, ouvre carnet familial », puis « ajoute du lait » (application Alexa du téléphone).
- Boutons Telegram sous chaque course : ✅ acheté · 📅 Demain · ❗ Urgent · ✖ retirer. Dans l’application : **Marquer acheté**, **Date des courses**, **Signaler comme urgent**, **Je m’en occupe**.
- Sans action, une course reste sur la liste. Lire ou recevoir un récapitulatif ne coche rien.
- Chaque jour à **17 h 20**, le récapitulatif des demandes reçues jusqu’à **17 h 15** (reports et anciennes demandes compris) ; ce qui arrive après passe au lendemain. « Rien à acheter aujourd’hui » s’il n’y a rien.
- **Urgent** prévient l’autre tout de suite, même en journée tranquille.

**Agenda**
- **Agenda** affiche l’agenda Google « Maison - Famille » ; **Ajouter un rendez-vous** l’y enregistre. Modifier, annuler ou répéter un rendez-vous : dans Google Agenda (lien depuis Maison).
- Se mettre d’accord : **Agenda → Proposer des créneaux** (1 à 5 horaires) → **Partager la proposition**. Le rendez-vous est créé une seule fois, quand les deux ont validé le même créneau (**Valider ce créneau**). Sinon : **Aucun créneau ne convient ?** puis **Proposer d’autres créneaux**.

**Rappels Telegram** (Réglages → Vos rappels Telegram)
- 7 h : agenda du jour · 9 h : rendez-vous sans heure · une heure avant chaque rendez-vous · 17 h 20 : courses.
- **Journée tranquille** : pause jusqu’au lendemain 7 h (sauf urgences). **Suspendre mes rappels** : plus aucun message jusqu’à réactivation. Réglages personnels : ils ne changent rien pour l’autre.
- Un message ne se met pas à jour : en cas de doute, ouvrir Maison, qui fait foi.

**Un problème ?** Vérifier Réglages (pause ou suspension actives ?), puis prévenir Antoine. Ne jamais transmettre un lien ou code reçu de Maison ; Maison ne demande jamais de mot de passe par Telegram.

## Limites acceptées

Consignées comme acceptées par Antoine (voir `docs/PROJECT-STATE.md`) :

1. **Alexa courses** validé dans l’application Alexa du téléphone ; essais sur les enceintes Echo dispensés, donc non vérifiés. Un article par demande, sans reconnaissance de la personne qui parle.
2. **Rendez-vous vocaux Alexa (T07)** : non réalisés, hors pilote.
3. **Créneaux** saisis à la main (1 à 5), sans recherche automatique de disponibilités ; pas de remplacement pendant ou après la création Google.
4. **Agenda** : modification, annulation et répétition se font dans Google ; les détails d’un rendez-vous privé sont masqués (masquage vérifié par tests, pas en recette réelle).
5. **Rappels agenda** : horaires 7 h / 9 h / H-1 choisis le 19 septembre ; pas de rattrapage après une longue panne (fenêtres de 15 et 5 minutes) ; un envoi à l’issue incertaine n’est pas renvoyé (un message peut manquer, jamais doublé) ; « accepté par Telegram » ne prouve pas la lecture.
6. **Recette mobile T04b** limitée au téléphone d’Antoine (second appareil dispensé) ; indicateurs de nouveautés propres à chaque appareil.
7. **Résumé sans course** : « Rien à acheter aujourd’hui » envoyé chaque jour pendant le pilote (D1), à réévaluer à la fin.
8. **Urgence pendant la journée tranquille** : envoyée ; rien en suspension (D5).

Proposées à l’acceptation pour le pilote (**non encore acceptées**, à confirmer par Antoine) :

9. Courses Telegram : pas de quantité, unité ni rayon par Telegram (à compléter dans Maison) ; pas de message vocal ; 10 articles par message ; récapitulatif limité à 30 lignes et 12 lignes de boutons.
10. Pas de récapitulatif ni de sonde si le service est arrêté de 17 h 20 à 17 h 45 ; un membre relié entre 17 h 20 et 17 h 30 peut déclencher une alerte sans objet.
11. Exploitation : sauvegardes hors site, administration nominative et alertes Maison sont installées. Réception panne/rétablissement et restauration isolée API/Keycloak sur données sauvegardées éprouvées. Restent la première exécution nocturne, la qualification de la reprise complète sur une autre machine et les preuves restantes avant J1. La surveillance locale ne couvre pas seule une panne totale de Nexus/Telegram. Ces dettes résiduelles restent à lever ou à accepter explicitement ; elles ne sont pas réputées acceptées.

## Relecture des PR ouvertes — clôture du 3 octobre 2026

- PR 2 : contrat documentaire réaligné sur l’état réel lors de cette clôture ; indépendante, laissée en brouillon.
- PR 8 : Google installé ; recette Google sur le téléphone de Belinda encore ouverte.
- PR 9 : rappels installés ; liaison/réception de Belinda et envois aux horaires réels encore ouverts.
- PR 10 : T05 et T08 installés à 5bb65aa, CI réussie ; tests manuels Antoine réussis. Tests à deux, envois programmés, preuves de reprise restantes et pilote non achevés.

Aucune fusion. Ordre 8 → 9 → 10 lorsque les critères sont remplis, chacune avec l’accord d’Antoine. La tête documentaire d’une PR ne désigne pas automatiquement la version en production.
