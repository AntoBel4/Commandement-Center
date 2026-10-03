# Pilote de sept jours — cadre (T09)

Rédigé le 29 septembre 2026. **Statut : cadre écrit, pilote non lancé.** Le suivi jour par jour (J1–J7, preuves par personne, registre des incidents, bilan) vit dans la page Notion « Suivi du pilote sur sept jours et incidents », tenue par Antoine. Ce document ne vaut ni pilote réalisé ni validation.

## Périmètre

Deux membres, deux téléphones Android, pendant sept jours consécutifs d’usage réel :

- **Courses** : liste partagée Maison, ajout Alexa (application Alexa du téléphone, périmètre accepté T03), capture et boutons Telegram, récapitulatif 17 h 20 (coupure 17 h 15), urgences, sonde 17 h 30.
- **Agenda** : agenda Google « Maison - Famille » lu et alimenté depuis Maison, créneaux à double validation, rappels Telegram 7 h / 9 h / une heure avant.
- **Réglages personnels** : journée tranquille et suspension.

**Hors pilote, explicitement : T07 (rendez-vous vocaux Alexa).** Règle du projet : si Alexa retarde, les courses et l’agenda passent d’abord. T07 n’est ni un prérequis ni un critère de réussite ; son absence ne peut pas faire échouer le pilote. Hors pilote aussi : toute fonction V2.

## État au 3 octobre 2026

Version 5bb65aa installée, tests courses manuels Antoine réussis et essais annulés. Belinda à configurer plus tard aujourd’hui. Récapitulatif/sonde et rappels agenda aux heures réelles non observés. Première sauvegarde déclenchée automatiquement attendue le 4 octobre à 03 h 30 Paris. J1 non fixé ; le 5 octobre reste une cible conditionnelle. T07 demeure hors pilote.

## Prérequis — tous requis avant J1

Chaque prérequis se coche avec une preuve (commit, résultat observé, date). Sans preuve : non réuni.

1. **Version installée** : la révision contenant T05 (PR 10, empilée sur PR 9 et PR 8) est installée sur Nexus selon `docs/TELEGRAM-RAPPELS.md` ; services Maison sains ; `/ready` répond ; routes privées anonymes refusées (401). La fusion des PR n’est pas requise pour le pilote, l’installation d’une révision identifiée l’est.
2. **Sauvegarde avant J1** : sauvegarde locale complète (`deploy/nexus/backup.sh`) faite juste avant l’installation, empreintes vérifiées, et contrôle de restauration des deux bases (`deploy/nexus/restore-check.sh`) réussi sur ce jeu. Copie hors Nexus (D2/D3 tranchées le 29 septembre) : première archive chiffrée envoyée par `deploy/nexus/backup-offsite.sh`, déchiffrée depuis le PC d’Antoine (`docs/deploiement-nexus.md` B3), et répétition `restore-service.sh --rehearse` réussie sur Nexus (B4). État au 3 octobre : T05/T08 installés, sauvegardes envoyées, déchiffrement d’une archive réelle et répétition isolée API/Keycloak réussis sur des jeux distincts. Le dernier jeu post-T05 de 10 h 54 n’a pas encore été restauré ; les preuves sur un même jeu exigées ici ne sont pas réputées acquises.
3. **Belinda** : procédure `docs/procedure-belinda.md` réalisée, étapes A1 à A8 notées « réussi » par Antoine (compte Maison, raccourci, liaison et test Telegram, notifications, agenda partagé, rappel H-1, courses Telegram).
4. **Antoine** : Telegram relié et test reçu (déjà accepté le 19 septembre), `TELEGRAM_ALERT_USER` configuré sur son compte Maison, rappels actifs.
5. **Premiers rappels réels** : au moins un résumé de 7 h reçu par les deux membres, avant ou à J1.
6. **Retour arrière prêt** : images et configurations de la révision précédente conservées ; procédure de retour arrière relue (`docs/TELEGRAM-RAPPELS.md`, section installation).
7. **Suivi prêt** : page Notion du pilote datée (J1 fixé), responsable des incidents désigné (Antoine).

## Déroulé quotidien (à noter chaque jour dans Notion)

- 7 h : résumé agenda reçu par chacun (oui / non / suspendu volontairement).
- 9 h : rappel des rendez-vous sans heure si concerné.
- H-1 : chaque rendez-vous daté du jour a donné un rappel.
- 17 h 20 : récapitulatif courses reçu par chacun ; contenu cohérent avec la liste (demandes reçues jusqu’à 17 h 15).
- 17 h 30 : aucune alerte de sonde, ou alerte expliquée.
- Au moins une action courses dans la journée (ajout, bouton, report ou achat) par l’un des deux membres, visible par l’autre.
- Incidents : date, heure, personne, impact, cause supposée, correction, retest.

## Critères de réussite (tous, sur les sept jours)

1. **Aucune perte de données** : aucune course ou proposition enregistrée disparue ou modifiée sans action d’un membre.
2. **Courses** : récapitulatif de 17 h 20 accepté par Telegram pour chaque membre attendu au moins 6 jours sur 7 ; aucune demande reçue avant 17 h 15 absente du récapitulatif ; aucun doublon causé par Telegram ; chaque bouton utilisé a produit l’effet attendu, visible par l’autre membre.
3. **Urgences** : chaque urgence signalée pendant le pilote a été notifiée à l’autre membre (dans la minute, observé au moins une fois).
4. **Agenda** : aucun rendez-vous créé en double ; chaque proposition acceptée par les deux a donné un seul événement Google.
5. **Rappels** : au moins 6 résumés de 7 h sur 7 reçus par chaque membre (jours suspendus volontairement exclus) ; aucun rappel H-1 manquant non expliqué.
6. **Sonde** : toute alerte de 17 h 30 correspond à un défaut réel et a été traitée ; aucune absence de récapitulatif non signalée.
7. **Usage** : les deux membres déclarent le service utilisable au quotidien ; les irritants sont listés (retour d’usage, pas une validation technique).
8. **Incidents** : tous les incidents sont clos ou acceptés explicitement par Antoine comme limites.

Le pilote est « réussi » seulement si Antoine le constate sur ces critères. La clôture de la V1 reste une décision séparée.

## Critères d’arrêt (on arrête et on revient à l’état antérieur ou à l’usage manuel)

Arrêt immédiat si l’un de ces événements survient :

1. **Sécurité** : accès aux données par une personne non membre, secret exposé (jeton, clé, mot de passe) ou port/service exposé sans protection.
2. **Perte ou corruption de données** confirmée (courses, propositions, agenda) non récupérable par une action simple.
3. **Message à une mauvaise personne** : rappel, récapitulatif ou urgence reçu par un Telegram non relié au membre concerné.
4. **Doublons Google** : un rendez-vous créé deux fois par Maison.

Arrêt après décision d’Antoine si :

5. Service Maison indisponible plus de 24 heures cumulées, ou récapitulatif 17 h 20 absent deux jours de suite pour un membre.
6. Plus de trois alertes de sonde sans cause identifiée.
7. Un membre demande l’arrêt (charge, gêne, notifications excessives).

En cas d’arrêt : noter l’heure et la cause, suspendre les rappels (Réglages) ou arrêter le service Telegram selon le retour arrière documenté, sauvegarder avant toute correction, ne pas restaurer une base ancienne sans décision d’Antoine. Reprise du pilote à J1 après correction et retest.

## Après le pilote

- Réévaluer D1 (« Rien à acheter aujourd’hui » envoyé chaque jour).
- Bilan dans Notion ; décider de la fusion des PR 8 → 9 → 10 et de la suite (T07, T08 restant, clôture V1).
