# Procédure Belinda — mise en route de son téléphone Android

Rédigée le 29 septembre 2026. Téléphone de Belinda : **Android** (décision confirmée par Antoine). Ce document ne contient ni mot de passe, ni jeton, ni code : chaque code est généré au moment de l’étape et ne doit être ni photographié ni transmis.

**Statut : procédure écrite, non réalisée.** Aucune étape ci-dessous n’est validée tant qu’Antoine n’a pas noté le résultat observé. La configuration du téléphone reste une action d’Antoine et de Belinda, hors de cette session.

Prérequis côté serveur (à vérifier par Antoine avant de commencer, voir `docs/deploiement-nexus.md`) :

- Maison répond sur `https://famille.estarellas.online` et, dans **Réglages → Vos rappels Telegram** sur le téléphone d’Antoine, aucun message « Le service de rappels reste à vérifier » ni « Lecture de l’agenda non confirmée ».
- Les parties « Courses par Telegram » (étape A8) supposent la version T05 **installée** sur Nexus. Sinon, sauter A8 et la noter « à faire après installation ».

---

## A. Pour Antoine — déroulé à deux sur le téléphone de Belinda

Durée totale : **environ 50 minutes**, plus deux contrôles le lendemain matin (7 h et 9 h). Belinda tient son téléphone et saisit elle-même ses identifiants ; Antoine guide sans regarder la saisie.

| # | Étape | Durée |
| --- | --- | --- |
| A0 | Préparation | 5 min |
| A1 | Compte Maison | 5 min |
| A2 | Raccourci sur l’écran d’accueil | 2 min |
| A3 | Liaison Telegram (code à usage unique) | 5 min |
| A4 | Test de réception | 2 min |
| A5 | Notifications Android | 3 min |
| A6 | Agenda partagé « Maison - Famille » | 8 min |
| A7 | Contrôle des rappels (H-1 le jour même, 7 h et 9 h le lendemain) | 15 min + lendemain |
| A8 | Courses par Telegram (si T05 installé) | 5 min |
| A9 | Journée tranquille et bilan | 5 min |

### A0 — Préparation (5 min)

- **Faire** : vérifier que le téléphone est à jour, connecté (Wi-Fi ou 4G/5G), que Chrome, Telegram (compte personnel de Belinda) et Google Agenda (compte Google de Belinda) sont installés et ouverts au moins une fois. Vérifier que Belinda connaît le mot de passe de son compte Maison, qu’elle a elle-même changé le 18 septembre.
- **On doit voir** : les trois applications s’ouvrent sur le compte de Belinda.
- **Si ça échoue** : mot de passe Maison oublié → **ne pas créer de nouveau compte** ; arrêter ici, Antoine réinitialisera le mot de passe par l’administration nominative (T08), puis reprendre. Pas de compte Telegram → le créer avec son numéro, puis reprendre.

### A1 — Compte Maison (5 min)

- **Faire** : dans Chrome, ouvrir `https://famille.estarellas.online`, se connecter avec le compte de Belinda (saisie par elle).
- **On doit voir** : l’accueil Maison, puis **Courses** avec la liste partagée (mêmes articles que sur le téléphone d’Antoine) et le bouton **Se déconnecter**.
- **Si ça échoue** : « identifiants invalides » → une seule nouvelle tentative, puis même conduite qu’en A0. Page d’erreur ou blanche → noter l’heure et le message exact, vérifier le même accès depuis le téléphone d’Antoine ; s’il échoue aussi, c’est le serveur : arrêter la séance.

### A2 — Raccourci sur l’écran d’accueil (2 min)

- **Faire** : dans Chrome, menu ⋮ → **Installer l’application** ou **Ajouter à l’écran d’accueil** → Ajouter.
- **On doit voir** : l’icône Maison sur l’écran d’accueil ; en la touchant, Maison s’ouvre directement, déjà connecté.
- **Si ça échoue** : l’option n’apparaît pas → mettre Chrome à jour et réessayer ; sinon ajouter un favori. L’icône ouvre la page de connexion → se reconnecter une fois, puis rouvrir l’icône.

### A3 — Liaison Telegram (5 min, code valable 10 minutes)

- **Faire** : dans Maison, **Réglages → Vos rappels Telegram → Relier mon Telegram**, puis **Ouvrir Telegram et démarrer Maison**. Dans Telegram, appuyer sur **Démarrer**. Revenir dans Maison, attendre environ 30 secondes, toucher **Actualiser Telegram**.
- **On doit voir** : « Votre Telegram est relié. Rappels activés. » Le code est unique, personnel, généré à l’instant et inutilisable ensuite : ne pas le copier ni le transmettre.
- **Si ça échoue** :
  - plus de 10 minutes écoulées ou « lien expiré » → toucher de nouveau **Relier mon Telegram** (nouveau code) ;
  - le lien s’ouvre dans le navigateur au lieu de Telegram → appui long sur le bouton, « Ouvrir avec Telegram » ;
  - toujours non relié après 1 minute et **Actualiser** → vérifier que Belinda a bien appuyé sur **Démarrer** dans *sa* conversation privée (pas un groupe) ; si le message « Le service de rappels reste à vérifier » s’affiche, arrêter : panne serveur à traiter par Antoine.

### A4 — Test de réception (2 min)

- **Faire** : dans Maison, **Tester la réception**.
- **On doit voir** : dans Telegram, en moins d’une minute, « Maison · Votre Telegram est bien relié. Les rappels arriveront ici. » Dans Maison, « Dernier envoi : Accepté par Telegram (lecture non vérifiée) ».
- **Si ça échoue** : « Envoi non confirmé » ou « refusé » → noter le libellé exact, ne pas relancer en boucle (une demande par minute au plus), passer à A5 puis refaire un seul test. Rien reçu mais « Accepté » → problème de notification du téléphone : A5.

### A5 — Notifications Android (3 min)

- **Faire** : Paramètres Android → Applications → Telegram → **Notifications autorisées**. Dans Telegram, conversation Maison → vérifier qu’elle n’est pas en sourdine. Paramètres → Applications → Telegram → Batterie → **Non restreinte** (évite les notifications retardées).
- **On doit voir** : un nouveau test (A4) arrive avec une notification sonore ou visible écran verrouillé.
- **Si ça échoue** : noter le modèle et la version d’Android ; garder l’étape « à revoir » sans la déclarer réussie.

### A6 — Agenda partagé « Maison - Famille » (8 min)

- **Faire** : l’agenda a été partagé avec l’adresse Google de Belinda (droit d’ajouter et modifier). Ouvrir l’e-mail d’invitation reçu dans sa messagerie Google et accepter (**Ajouter cet agenda**). Puis dans l’application Google Agenda : menu ☰ → vérifier que **Maison - Famille** est coché sous son compte. Si absent : ☰ → Paramètres → Maison - Famille → **Synchroniser** activé.
- **On doit voir** : un rendez-vous existant de Maison - Famille apparaît dans son Google Agenda, et le même dans **Maison → Agenda**.
- **Si ça échoue** : pas d’invitation → vérifier que l’adresse partagée est bien le compte Google configuré sur ce téléphone (**à vérifier sur place**, l’adresse n’est pas écrite ici) ; Antoine contrôle depuis son ordinateur le partage de l’agenda. L’agenda reste visible dans Maison même si Google Agenda n’est pas configuré : noter ce critère séparément.

### A7 — Contrôle des rappels (15 min le jour même + lendemain matin)

- **H-1 (jour même)** — **Faire** : Antoine crée dans **Maison → Agenda → Ajouter un rendez-vous** un événement « Test rappel » commençant **1 h 05 plus tard**. **On doit voir** : environ 5 minutes après, sur les deux téléphones, « Maison · Rendez-vous dans une heure » avec l’horaire. **Si ça échoue** : vérifier dans Réglages la lecture de l’agenda et le dernier envoi ; vérifier que l’événement est bien dans Maison - Famille. Supprimer l’événement de test ensuite (dans Google Agenda).
- **7 h (lendemain)** — **On doit voir** : « Maison · Votre agenda du jour » (ou « Aucun rendez-vous prévu aujourd’hui »). Belinda confirme à Antoine avant 7 h 30.
- **9 h (lendemain)** — **Faire** la veille : créer un événement **journée entière** « Test journée » pour le lendemain. **On doit voir** à 9 h : « Maison · Rendez-vous sans heure aujourd’hui ». Supprimer ensuite.
- **Si ça échoue** : noter l’heure attendue et l’absence ; ne pas relancer d’essai le même jour ; Antoine consulte l’état « Dernier envoi » dans les Réglages de Belinda.

### A8 — Courses par Telegram (5 min, seulement si T05 est installé)

- **Faire** : Belinda écrit « Test Belinda » dans la conversation Maison. Puis touche **✖** sous la confirmation.
- **On doit voir** : « Maison · Course ajoutée » avec quatre boutons ; l’article apparaît dans **Maison → Courses** sur les deux téléphones ; après ✖, « Retiré de la liste : Test Belinda » et l’article disparaît de la liste.
- **Si ça échoue** : aucune confirmation après une minute → vérifier dans Maison si l’article est présent (ne pas le réécrire). Présent sans confirmation : noter ; absent : vérifier la liaison (A3).
- Le récapitulatif de 17 h 20 sera observé pendant le pilote, pas pendant cette séance.

### A9 — Journée tranquille et bilan (5 min)

- **Faire** : montrer **Réglages → Journée tranquille** puis **Reprendre maintenant**, et **Suspendre mes rappels** puis **Activer mes rappels**. Terminer sur « Rappels activés ».
- **On doit voir** : les messages correspondants dans Réglages ; état final « Votre Telegram est relié. Rappels activés. »
- **Bilan** : Antoine note pour chaque étape A1–A8 « réussi / échec (message) / non fait » avec la date, et le reporte dans Notion. Une étape non observée reste « non vérifiée ».

---

## B. Pour Belinda — l’essentiel (une page)

Version imprimable A4 d’une page : `docs/procedure-belinda-imprimable.html` (ouvrir dans un navigateur, puis Imprimer). Même contenu que ci-dessous.

Maison, c’est notre liste de courses et notre agenda communs. Vous l’ouvrez avec l’icône **Maison** de votre téléphone, et les messages arrivent dans Telegram, conversation **Maison**.

**Ajouter une course** — Dans Telegram, conversation Maison : écrivez l’article et envoyez (« lait »). Plusieurs articles : un par ligne. Maison répond « Course ajoutée ». Ou dans l’application : **Courses → Ajouter à la liste**.

**Sous chaque course, quatre boutons :**
- ✅ acheté · 📅 **Demain** (reporter) · ❗ **Urgent** · ✖ retirer.
- Sans toucher à rien, la course reste sur la liste. Ce que vous faites, Antoine le voit aussi.

**Reporter** — 📅 **Demain**, ou dans l’application **Date des courses** pour choisir un autre jour.

**Urgent** — ❗ **Urgent**, ou dans l’application **Signaler comme urgent**. Antoine est prévenu tout de suite.

**Chaque jour à 17 h 20** — le récapitulatif des courses demandées jusqu’à 17 h 15. Ce qui est ajouté après arrive dans le récapitulatif du lendemain (mais reste visible tout de suite dans la liste). S’il n’y a rien : « Rien à acheter aujourd’hui ».

**Proposer un rendez-vous** — Application Maison → **Agenda → Proposer des créneaux** : indiquez 1 à 5 horaires, puis **Partager la proposition**. Le rendez-vous n’est créé que lorsque vous et Antoine avez **validé le même créneau** (**Valider ce créneau**). Si rien ne convient : **Aucun créneau ne convient ?**

**Vos rappels** — 7 h : l’agenda du jour. 9 h : les rendez-vous sans heure. Une heure avant chaque rendez-vous.

**Mettre en pause** — Application Maison → **Réglages** :
- **Journée tranquille** : plus de rappels ni de récapitulatif jusqu’à demain 7 h. Les courses urgentes arrivent quand même. **Reprendre maintenant** pour annuler.
- **Suspendre mes rappels** : plus aucun message jusqu’à ce que vous touchiez **Activer mes rappels**.

**Un rappel n’arrive pas ?** — Vérifiez dans **Réglages** que la journée tranquille ou la suspension ne sont pas actives. Sinon, **appelez Antoine**. Ne désinstallez pas Telegram et ne touchez pas **Dissocier Telegram**.

**Sécurité** — Maison ne vous demandera jamais votre mot de passe par Telegram. Ne transférez jamais un lien ou un code reçu de Maison.
