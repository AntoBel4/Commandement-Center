# État courant — Centre familial

Dernière mise à jour : 17 septembre 2026 (Europe/Paris).
Session terminée à la demande d’Antoine. Aucun travail différé ni surveillance programmée.
Cette fiche est un point de reprise : vérifier GitHub et Notion en direct avant de reprendre.

## Où nous en sommes

- Cadrage V1 établi : portail web privé, courses partagées, agenda et capture vocale, hébergement Docker derrière Traefik.
- Notion a été réorganisé : tableau de bord, sept pages thématiques, onze actions V1 et cinq évolutions.
- Maquette interactive « Maison » livrée : Aujourd’hui, Courses, Agenda, Réglages. Elle est indépendante de l’application, avec données fictives uniquement.
- Dernier retour utilisateur : résultat « très encourageant », mais tous les tests ne sont pas terminés. Ce retour n’est PAS une validation finale. Action T04a = À vérifier.
- Aucun déploiement de cette version sur le serveur ; aucune intégration réelle Google/Telegram/Alexa connectée par ces sessions.
- Base de code examinée au commit 03cf35c05a16714bf49958d191dc092980124b00 : connecteurs de synchronisation incomplets, déploiement initial Caddy, authentification désactivable. La proposition V1 précise les corrections nécessaires.

## Travail sauvegardé et PR

| PR | Branche | Dernier commit observé | État à la clôture | Suite |
| --- | --- | --- | --- | --- |
| [2 — Contrat V1](https://github.com/AntoBel4/Commandement-Center/pull/2) | docs/family-v1-delivery | 611fa997343966cb8d6d35476a8dab78abac12b6 | Ouverte, brouillon, non fusionnée | L’agent relit et aligne avec les décisions courantes, puis gère la fusion lorsque prête. |
| [3 — Maquette Maison](https://github.com/AntoBel4/Commandement-Center/pull/3) | prototype/family-portal | 6e396cb513d560a0f4870223ebdfad3dd8cef254 | Ouverte, brouillon, non fusionnée | Attendre la fin de la revue utilisateur, corriger les retours, puis intégrer. |

La maquette est dans prototype/index.html sur la branche de la PR 3, pas encore dans main. Son README décrit les parcours et limites. Le plan est dans docs/V1-DELIVERY.md sur la branche de la PR 2. Les fichiers de continuité sont publiés séparément sur main afin d’être trouvables immédiatement.

## Vérifications déjà faites

- Cinq tests API existants réussis sous Node 24.13.1 : stockage en mémoire seulement, sans validation PostgreSQL/Docker/intégrations.
- Maquette dans Edge : quatre pages aux largeurs 320/390/768/1440 px, aucun débordement horizontal observé.
- Parcours courses : ajout, achat, report, retour, urgence simulée, suppression, annulation ; agenda : ajout, détail, suppression, navigation ; profils, rappels, Échap.
- Aucun appel externe ni erreur JavaScript observé ; sélection de date après changement d’heure vérifiée en Europe/Paris.
- Essai sur les vrais Android et revue complète par le foyer : encore à faire.

## Prochaine session

1. Relire AGENTS.md, docs/SESSION-PROTOCOL.md et cette fiche depuis main ; consulter les PR et le tableau de bord Notion.
2. Dire à Antoine : « La maquette est livrée ; ta revue est encore en cours. Le site et ses connexions réelles ne sont pas encore en service. »
3. Recueillir les résultats de ses essais, corriger les problèmes concrets et consigner ce qui est validé ou encore à tester. Ne pas reconstruire une nouvelle maquette sans motif.
4. Si la revue reste inachevée, avancer seulement les prérequis indépendants (T01, identité, préparation bot familial/agendas et preuve Alexa), selon la demande de reprise.
5. Après revue : intégrer la direction retenue dans la vraie application (T04b) ; mener ensuite les parcours complets, connexions, sécurisation, sauvegarde/restauration et déploiement. Aucune mise en production implicite à partir du prototype.

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

## Journal de cette clôture

- Retour utilisateur incomplet enregistré ; pas de validation finale ni de fusion des PR 2/3.
- Mise en place d’un protocole début/fin et d’instructions de lecture AGENTS.md.
- Synchronisation du tableau de bord, de la prochaine action et du journal Notion.
- Aucun changement applicatif, déploiement ou message familial réalisé pendant la clôture.
