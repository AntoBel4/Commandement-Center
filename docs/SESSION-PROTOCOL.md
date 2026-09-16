# Protocole des sessions

Objectif : reprendre sans dépendre de la mémoire de la conversation et laisser chaque séance dans un état explicite.

## Début de session

1. Lire AGENTS.md et docs/PROJECT-STATE.md depuis la branche main actuelle, puis ce protocole. Si le checkout est ancien, lire les versions distantes via le connecteur sans écraser le travail local.
2. Vérifier le dépôt, la branche, le commit et les modifications locales. Lire les PR ouvertes (état, branche, dernier commit, contrôles et retours), puis le tableau de bord Notion, les cartes actives et les décisions pertinentes.
3. Rapprocher les sources : GitHub fait foi pour le code et les contrôles ; Notion pour les usages, priorités, paramètres privés et validations humaines ; une preuve de déploiement pour la production. En cas d’écart, le signaler et corriger la synthèse.
4. Présenter un point bref : terminé / en cours ou à vérifier / limites / prochaine action concrète. Ne pas reposer les questions dont la réponse est enregistrée.
5. Continuer le travail demandé. Une revue non terminée n’est pas une approbation. Une reprise n’autorise pas à déployer un prototype comme service opérationnel.

## Pendant la session

- Mettre à jour les décisions importantes et leurs preuves à chaque étape significative, sans attendre la toute fin.
- Éviter deux tableaux de tâches indépendants : Notion porte les actions, GitHub porte code, PR et preuves techniques.
- Réutiliser une branche/PR quand elle correspond au même livrable. Préserver les fichiers utilisateur et ne pas écraser des changements non identifiés.
- Aucun secret ni donnée familiale réelle dans GitHub ; utiliser des exemples fictifs.
- Ne pas supposer qu’un ancien serveur de prévisualisation tourne encore.

## Fin de session (demande « on arrête », « pause », « fin de session »)

1. Suspendre le travail fonctionnel à une étape cohérente et relever ce qui reste incomplet.
2. Examiner les modifications ; sauvegarder le travail pertinent dans sa branche distante/PR, sans caches, dépendances ou secrets. Si cela échoue, indiquer exactement ce qui n’est sauvegardé que localement.
3. Actualiser docs/PROJECT-STATE.md : date/fuseau, décisions, retour utilisateur exact, validations réelles, tests et limites, branches/commits/PR, blocages, puis 1 à 3 prochaines actions.
4. Publier la note de continuité sur main lorsque les règles du dépôt le permettent (documentation uniquement). Si main est protégé, utiliser une PR dédiée et laisser son lien et sa branche dans le tableau de bord Notion ; ne pas prétendre qu’elle est sur main. Ne pas mélanger un bilan de session à un déploiement.
5. Mettre à jour les cartes concernées, le champ Prochaine Action, le tableau de bord et le journal Notion. Conserver les critères non vérifiés ouverts. Une clôture de conversation ne termine pas le projet.
6. Relire les notes publiées et vérifier les liens, les statuts et la prochaine action. Indiquer toute synchronisation échouée.
7. Donner un bilan bref : sauvegardé où, état des PR, prochaine étape, éventuelle action utilisateur. Aucun suivi automatique ni poursuite après la clôture sauf demande explicite.

En cas de fermeture brutale, aucun agent ne peut garantir l’écriture d’un bilan après sa coupure ; d’où les sauvegardes intermédiaires.

## Qui s’occupe des pull requests ?

L’agent gère la préparation, les correctifs, les contrôles et la fusion quand le travail est prêt et dans le périmètre autorisé. L’utilisateur donne les retours métier/visuels nécessaires ; aucun clic GitHub ne lui est demandé par défaut.

- **Brouillon (draft)** : proposition encore en préparation ou en revue utilisateur.
- **Prête à fusionner** : changements relus, retours applicables traités, contrôles nécessaires réussis et validation métier requise réellement obtenue.
- **Fusionner (merge)** : intégrer les changements dans main. GitHub clôt alors la PR comme fusionnée.
- **Fermer sans fusionner (close)** : abandonner/remplacer la proposition. Ce n’est pas le geste pour accepter du travail.
- **Déployer** : mettre une version en service ; c’est distinct de la fusion. Vérifier les automatisations du dépôt avant de fusionner.

Avant une fusion, relire le diff et l’état courant, vérifier les contrôles appropriés et utiliser le SHA attendu de la branche pour éviter d’intégrer une révision non relue. Respecter les protections sans les contourner. Ne pas demander une nouvelle permission si les instructions existantes suffisent ; une validation utilisateur encore explicitement en cours reste toutefois en cours.

PR 3 à la clôture du 17 septembre : revue utilisateur non terminée, donc laisser en brouillon. PR 2 : documentation à relire/aligner lors de la reprise. Ne pas fermer les PR pour simplement « ranger » la fin d’une session.

## Instruction portable pour un nouveau projet ou environnement

« Pour ce projet, commence chaque session en lisant les versions actuelles de AGENTS.md, docs/SESSION-PROTOCOL.md et docs/PROJECT-STATE.md dans AntoBel4/Commandement-Center sur GitHub (branche main), puis le tableau de bord Notion lié. Vérifie les PR ouvertes et présente l’état réel et la prochaine action. À chaque fin de session, sauvegarde le travail et actualise ces notes ainsi que Notion. Ne confonds jamais maquette, validation, fusion et déploiement. »

Les fichiers AGENTS sont découverts dans les environnements Codex compatibles, selon le dossier ouvert. Pour une conversation ChatGPT ou un autre environnement qui ne lit pas le dépôt local, placer cette instruction dans les instructions du projet ou la donner dans le message de reprise. La présence d’un fichier GitHub seul ne déclenche pas sa lecture dans tous les produits.
