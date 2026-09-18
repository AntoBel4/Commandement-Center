# État courant — Centre familial

Dernière mise à jour : 18 septembre 2026 (Europe/Paris).
Bilan du parcours de tests guidés et des deux ajouts à la maquette. Aucun travail différé ni surveillance programmée.
Cette fiche est un point de reprise : vérifier GitHub et Notion en direct avant de reprendre.

## Où nous en sommes

- Cadrage V1 établi : portail web privé, courses partagées, agenda et capture vocale, hébergement Docker derrière Traefik.
- Notion a été réorganisé : tableau de bord, sept pages thématiques, onze actions V1 et cinq évolutions.
- Maquette interactive « Maison » livrée : Aujourd’hui, Courses, Agenda, Réglages. Elle est indépendante de l’application, avec données fictives uniquement.
- Les 12 tests guidés de la maquette initiale sont déclarés réussis par Antoine : accueil, ajout/achat/retour/report/urgence/suppression des courses, récapitulatif, création/gestion des rendez-vous, profils et rappels.
- Deux ajouts ensuite livrés : indication des nouveautés par profil sur courses/agenda, et Journée tranquille personnelle jusqu’au lendemain à 7 h Paris (simulation, urgences conservées, reprise anticipée et préférences préservées). Leur validation utilisateur reste à faire : T04a = À vérifier pour ces ajouts.
- Retenus pour la suite, non implémentés : « Je m’en occupe » et propositions de créneaux avec validation des deux personnes avant création du rendez-vous. Détails et autres choix dans Notion.
- Aucun déploiement de cette version sur le serveur ; aucune intégration réelle Google/Telegram/Alexa connectée par ces sessions.
- Base de code examinée au commit 03cf35c05a16714bf49958d191dc092980124b00 : connecteurs de synchronisation incomplets, déploiement initial Caddy, authentification désactivable. La proposition V1 précise les corrections nécessaires.

## Travail sauvegardé et PR

| PR | Branche | Dernier commit observé | État observé | Suite |
| --- | --- | --- | --- | --- |
| [2 — Contrat V1](https://github.com/AntoBel4/Commandement-Center/pull/2) | docs/family-v1-delivery | 611fa997343966cb8d6d35476a8dab78abac12b6 | Ouverte, brouillon, non fusionnée | L’agent relit et aligne avec les décisions courantes, puis gère la fusion lorsque prête. |
| [3 — Maquette Maison](https://github.com/AntoBel4/Commandement-Center/pull/3) | prototype/family-portal | 8fdacfd14734bf0767d4e453c29c6bc76b6da183 | Ouverte, brouillon, non fusionnée | 12 tests initiaux réussis selon l’utilisateur ; vérifier les deux ajouts avant intégration. |

La maquette est dans prototype/index.html sur la branche de la PR 3, pas encore dans main. Son README décrit les parcours et limites. Le plan est dans docs/V1-DELIVERY.md sur la branche de la PR 2. Les fichiers de continuité sont publiés séparément sur main afin d’être trouvables immédiatement.

## Vérifications déjà faites

- Cinq tests API existants réussis sous Node 24.13.1 : stockage en mémoire seulement, sans validation PostgreSQL/Docker/intégrations.
- Maquette dans Edge : quatre pages aux largeurs 320/390/768/1440 px, aucun débordement horizontal observé.
- Parcours courses : ajout, achat, report, retour, urgence simulée, suppression, annulation ; agenda : ajout, détail, suppression, navigation ; profils, rappels, Échap.
- Aucun appel externe ni erreur JavaScript observé ; sélection de date après changement d’heure vérifiée en Europe/Paris.
- 18 septembre : 12 tests initiaux réussis selon le retour utilisateur. Appareil et navigateur non précisés ; essai sur les deux Android et revue par l’autre membre du foyer non confirmés.
- Nouveaux ajouts vérifiés dans le navigateur Codex : indication par profil sur courses/agenda puis disparition à la visite suivante, pause personnelle et reprise anticipée, conservation des préférences, urgence pendant la pause. Agenda avec nouveauté à 320/390/768/1440 px sans débordement, réglages inspectés à 390 px, aucune erreur console observée.
- Échéance de la pause vérifiée isolément à 7 h Europe/Paris, y compris changement d’heure d’hiver et d’année. Aucune ordonnance réelle de rappels ni notification envoyée.

## Prochaines actions

1. Faire essayer les deux ajouts dans la maquette mise à jour sur Notion : ajouter depuis un profil puis vérifier l’indication dans l’autre ; activer Journée tranquille, vérifier la portée personnelle et reprendre les rappels. Ne pas faire refaire les 12 tests initiaux déjà déclarés réussis.
2. Après validation des ajouts, préparer l’intégration T04b et aligner le plan V1 ; terminer les prérequis T01 nécessaires. Les essais sur appareils réels restent à confirmer.
3. Préparer « Je m’en occupe » et les créneaux avec double validation, puis les connexions, la sécurisation, les sauvegardes et la recette de production. Aucun déploiement implicite à partir de la maquette.

## Références privées et décisions

Les horaires réels, détails du serveur, données personnelles et accès restent dans Notion ou la configuration privée. Aucun secret dans le dépôt public.

- [Tableau de bord](https://app.notion.com/p/30bf514ea66d81f7a7a6c905d098228f)
- [Vision et usages](https://app.notion.com/p/3ddf514ea66d81878638d44019bf7cdd)
- [Site et expérience — maquette intégrée](https://app.notion.com/p/3ddf514ea66d815cad8cfb5f122d3c0a)
- [Architecture et exploitation](https://app.notion.com/p/3ddf514ea66d818fa788cc7318be2fe1)
- [Feuille de route](https://app.notion.com/p/3ddf514ea66d813a947ffbf03e71fb8a)
- [Recette et mise en service](https://app.notion.com/p/3ddf514ea66d8144af48ce75253e62ba)
- [Arbitrages et risques](https://app.notion.com/p/3ddf514ea66d812bbb89ca3a26ae2869)
- [Journal et références](https://app.notion.com/p/3ddf514ea66d81d99051cecc66c01014)
- [T01 — Prérequis](https://app.notion.com/p/3ddf514ea66d81689af8cfe2c774f035)
- [T04a — Revue de la maquette](https://app.notion.com/p/3ddf514ea66d81d4b88eeff20a7e9955)
- [T04b — Réalisation du portail](https://app.notion.com/p/3ddf514ea66d81bb8bcce1eefedf2781)

Règles stabilisées : application + Telegram pour les courses, Notion pour le projet ; Google Calendar comme référence agenda, adaptateur Nextcloud futur ; bot familial distinct du bot technique existant ; préserver les alertes existantes ; Alexa est importante mais peut suivre le premier usage ; menus, recettes, Home Assistant et tablette sont des évolutions. Deux utilisateurs capturent et reçoivent les résumés. Ne pas redemander les choix déjà consignés.

## Continuité et limites

Un fichier publié peut être relu ; une conversation antérieure ou un aperçu localhost peut ne plus être disponible. Ne jamais annoncer une mémoire exhaustive automatique. En cas de nouvel environnement, utiliser les instructions de reprise dans le projet ou le lien vers cette fiche. Si un connecteur est inaccessible, expliciter la limite et ne pas présenter le dernier état enregistré comme vérifié en direct.

## Historique — clôture du 17 septembre

- Retour utilisateur incomplet enregistré ; pas de validation finale ni de fusion des PR 2/3.
- Mise en place d’un protocole début/fin et d’instructions de lecture AGENTS.md.
- Synchronisation du tableau de bord, de la prochaine action et du journal Notion.
- Aucun changement applicatif, déploiement ou message familial réalisé pendant la clôture.

## Bilan du 18 septembre

- Consignation des 12 résultats déclarés par l’utilisateur et de ses choix dans T04a/T04b ; aucune déduction sur les appareils utilisés.
- Deux ajouts sauvegardés dans la PR 3, aperçu Notion actualisé. PR 2 et PR 3 restent en brouillon, non fusionnées.
- « Les 3 choses à retenir » reporté ; saisie automatique et rappel « On part dans 15 minutes » écartés ; mode « En magasin » sans décision.
- Tableau de bord, prochaine action et journal Notion actualisés. Aucun service réel connecté, déploiement ou message familial.
- Clone local ancien préservé (main au commit 03cf35c, dossiers prototype/ et .npm-cache/ non suivis). Copie de travail de cette itération dans maison-review-2026-09-18/, hors du clone et des références synchronisées.
