# Maison — guide d’utilisation pour la famille (T10)

Version du 29 septembre 2026, pour le pilote. Maison, c’est notre liste de courses et notre agenda communs, sur `https://famille.estarellas.online` (icône **Maison** sur le téléphone). Chacun a son propre compte ; ce que l’un fait, l’autre le voit.

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
11. Exploitation (T08 non fait) : pas de copie de sauvegarde hors Nexus, restauration du service complet jamais éprouvée, pas d’alerte de panne propre à Maison, administration Keycloak par le compte d’amorçage non nominatif. Ce sont des **dettes**, pas des choix : à lever par T08 ou à accepter explicitement avant J1.

## Relecture des PR ouvertes (29 septembre 2026, aucune fusion)

| PR | Tête | État technique | Verdict |
| --- | --- | --- | --- |
| [2 — Contrat V1](https://github.com/AntoBel4/Commandement-Center/pull/2) | 4303eda | Brouillon, fusionnable sans conflit (un fichier, `docs/V1-DELIVERY.md`), aucun contrôle CI attaché, aucun fil de revue. | **Pas prête** : contenu arrêté au 18 septembre (« raccorder maintenant les fonctions réelles »), antérieur à Google, Telegram et T05 ; à réaligner sur l’état réel avant fusion. Documentation seule, sans risque technique. |
| [8 — Google Agenda](https://github.com/AntoBel4/Commandement-Center/pull/8) | 348dd38 | Brouillon vers main, fusion sans conflit avec main, CI « test » et GitGuardian verts, aucun fil de revue. Code installé sur Nexus (selon la fiche d’état). | **Techniquement prête, validation métier incomplète** : critère « Google sur le téléphone de Belinda » (T06) non vérifié. Prête à fusionner dès ce critère observé (procédure Belinda, A6). |
| [9 — Rappels Telegram](https://github.com/AntoBel4/Commandement-Center/pull/9) | fb9aedf | Brouillon vers `feat/google-calendar`, CI et GitGuardian verts, aucun fil de revue. Installée sur Nexus (selon la fiche d’état). | **Pas prête** : liaison et réception de Belinda non vérifiées, premiers rappels réels non observés. Dépend de la PR 8. |
| [10 — T05 et documents pilote](https://github.com/AntoBel4/Commandement-Center/pull/10) | (cette branche) | Brouillon vers `feat/telegram-reminders`, CI verte sur f30a8e6. | **Pas prête** : non installée ; recette Telegram réelle et pilote à faire. |

Ordre de fusion quand chaque PR est prête : 8 → 9 → 10, chacune avec l’accord d’Antoine. La PR 2 est indépendante.
