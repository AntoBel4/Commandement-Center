# État courant — Centre familial

Dernière mise à jour : 18 septembre 2026 (Europe/Paris).
T01 terminé : inventaire daté de la cible et des accès consigné dans Notion. T02 terminé pour le socle technique : courses persistantes et accès privés intégrés en PR 4, sans déploiement. Maquette validée : 14 essais réussis selon l’utilisateur, T04a terminé et PR 3 fusionnée. Aucun travail différé ni surveillance programmée.
Cette fiche est un point de reprise : vérifier GitHub et Notion en direct avant de reprendre.

## Où nous en sommes

- Cadrage V1 établi : portail web privé, courses partagées, agenda et capture vocale, socle Docker prévu derrière Traefik.
- Hébergement décidé par Antoine le 18 septembre : tout le Centre familial sur Nexus avec Docker, y compris le portail, les données et les traitements. Le site existant reste chez Amen ; DNS gérés par Cloudflare et sous-domaine prévu famille.estarellas.online. T01 est terminé pour l’inventaire : accès extérieur existant confirmé, paramètres de publication et ressources relevés, comptes personnels disponibles et nouvelle base vide décidée. Les autorisations applicatives et le routage du futur portail restent à configurer et tester. Aucun DNS modifié.
- T02 intégré le 18 septembre : cycle de vie des courses, historique transactionnel, versions contre les conflits, reprises d’envoi et contrôles d’accès. 28 contrôles locaux réussis, dont PostgreSQL et Keycloak réels avec comptes fictifs. Identité de production et portail connecté restent à préparer.
- Notion a été réorganisé : tableau de bord, sept pages thématiques, onze actions V1 et cinq évolutions.
- Maquette interactive « Maison » livrée : Aujourd’hui, Courses, Agenda, Réglages. Elle est indépendante de l’application, avec données fictives uniquement.
- Les 12 tests guidés de la maquette initiale sont déclarés réussis par Antoine : accueil, ajout/achat/retour/report/urgence/suppression des courses, récapitulatif, création/gestion des rendez-vous, profils et rappels.
- Deux ajouts ensuite livrés : indication des nouveautés par profil sur courses/agenda, et Journée tranquille personnelle jusqu’au lendemain à 7 h Paris (simulation, urgences conservées, reprise anticipée et préférences préservées). Leurs deux essais sont déclarés réussis par Antoine : 14 essais validés au total et T04a = Terminé.
- Retenus pour la suite, non implémentés : « Je m’en occupe » et propositions de créneaux avec validation des deux personnes avant création du rendez-vous. Détails et autres choix dans Notion.
- Aucun déploiement de cette version sur le serveur ; aucune intégration réelle Google/Telegram/Alexa connectée par ces sessions.
- Base de code examinée au commit 03cf35c05a16714bf49958d191dc092980124b00 : connecteurs de synchronisation incomplets, déploiement initial Caddy, authentification désactivable. La proposition V1 précise les corrections nécessaires.

## Travail sauvegardé et PR

| PR | Branche | Dernier commit observé | État observé | Suite |
| --- | --- | --- | --- | --- |
| [2 — Contrat V1](https://github.com/AntoBel4/Commandement-Center/pull/2) | docs/family-v1-delivery | 4303eda1e438f777698bd665a3db95ad6ed1a7e3 | Ouverte, brouillon, non fusionnée | Plan aligné avec T01, maquette validée et T02 ; revue finale documentaire avant fusion. |
| [3 — Maquette Maison](https://github.com/AntoBel4/Commandement-Center/pull/3) | prototype/family-portal | 4366576a63b399a6b921f2dec62a3861fdcbe93e | Fusionnée le 18 septembre, commit 16a635c89f10190daaa447a51bcf2af69ebe86da | Maquette validée ; préparer T04b. |
| [4 — Socle T02](https://github.com/AntoBel4/Commandement-Center/pull/4) | feat/t02-courses | 7e49ac0bd29b033f166dc15370aafaa6dfc04c91 | Fusionnée le 18 septembre, commit afaebca082e69b90eb5ef412a9a19f8f3b33f5ec | Raccorder le portail dans T04b ; aucun déploiement. |

La maquette est désormais dans prototype/index.html sur main après fusion de la PR 3. Elle reste autonome, sans raccordement à l’application. Son README décrit les parcours et limites. Le plan est dans docs/V1-DELIVERY.md sur la branche de la PR 2. Les fichiers de continuité sont publiés séparément sur main afin d’être trouvables immédiatement.

## Vérifications déjà faites

- Cinq tests API existants réussis sous Node 24.13.1 : stockage en mémoire seulement, sans validation PostgreSQL/Docker/intégrations.
- Maquette dans Edge : quatre pages aux largeurs 320/390/768/1440 px, aucun débordement horizontal observé.
- Parcours courses : ajout, achat, report, retour, urgence simulée, suppression, annulation ; agenda : ajout, détail, suppression, navigation ; profils, rappels, Échap.
- Aucun appel externe ni erreur JavaScript observé ; sélection de date après changement d’heure vérifiée en Europe/Paris.
- 18 septembre : 12 tests initiaux et 2 essais des ajouts réussis selon le retour utilisateur. Appareil et navigateur non précisés ; essai sur les deux Android et revue par l’autre membre du foyer non confirmés.
- Nouveaux ajouts vérifiés dans le navigateur Codex : indication par profil sur courses/agenda puis disparition à la visite suivante, pause personnelle et reprise anticipée, conservation des préférences, urgence pendant la pause. Agenda avec nouveauté à 320/390/768/1440 px sans débordement, réglages inspectés à 390 px, aucune erreur console observée.
- Échéance de la pause vérifiée isolément à 7 h Europe/Paris, y compris changement d’heure d’hiver et d’année. Aucune ordonnance réelle de rappels ni notification envoyée.

## Prochaines actions

1. T04b : raccorder Maison à la connexion et aux courses persistantes de T02. Gérer les conflits de version, les reprises d’envoi et la prise en charge « Je m’en occupe ». Les parcours visuels et les deux Android restent à vérifier.
2. Préparer T06 et les autres intégrations : agenda Google partagé/autorisations, créneaux avec double validation, bot familial/appairages et compte développeur Amazon. Ne pas présenter les routes de départ comme des intégrations opérationnelles.
3. Préparer l’identité de production, le routage Traefik et le sous-domaine, puis les sauvegardes, la restauration et la mise en service. Le Compose auth actuel reste local en start-dev ; aucun déploiement implicite. PR 2 alignée, encore en brouillon.

## Socle T02 — preuves du 18 septembre

- [Contrat et commandes T02](https://github.com/AntoBel4/Commandement-Center/blob/main/docs/T02-COURSES.md).
- Demandes distinctes, achats/réouverture, report par date civile, attribution, urgence enregistrée et annulation conservant les données. Historique et clés de reprise dans la transaction PostgreSQL ; version obligatoire pour refuser les écritures obsolètes.
- Contrôle du jeton d’accès et de l’appartenance au foyer à chaque requête ; auteur issu du jeton. Audience API distincte du navigateur, PKCE S256 et provisionnement répétable de deux membres. Authentification désactivée et stockage mémoire refusés en production.
- 28 contrôles locaux réussis : API/JWT, mémoire, PostgreSQL, concurrence, rollback, historique, reprise réseau, relance API et redémarrage réel du conteneur PostgreSQL de test.
- Keycloak local jetable : flux code/PKCE réel via HTTP, deux comptes fictifs sur la même liste, refus du troisième et du jeton d’identité, achat conservé après relance API. Ni compte réel ni recette visuelle des utilisateurs.
- Image Linux construite et testée contre PostgreSQL : 26 contrôles réussis, 2 options locales ignorées dans l’image (Keycloak et redémarrage explicite du conteneur), couvertes dans la recette locale complète. Compose validé. Fastify 5.12.5 et CORS compatible ; npm audit ne remonte aucun avis connu à cette date.
- CI PostgreSQL et GitGuardian réussis sur la tête 7e49ac0bd29b033f166dc15370aafaa6dfc04c91 ; revue locale et retours GitHub contrôlés. Fusion avec SHA attendu : afaebca082e69b90eb5ef412a9a19f8f3b33f5ec. Workflow de tests uniquement.
- T02 terminé pour le socle technique. T04b, les intégrations, les comptes de production, la recette Android et le déploiement restent à faire. Aucun changement Nexus/DNS ni notification familiale.
- Travail isolé dans t02-courses/, ancien clone et maquette préservés. Carte T02, entrées T04b, tableau de bord, architecture et journal Notion actualisés.


## Inventaire T01 — clôture du 18 septembre

- Résultats détaillés dans la carte T01 Notion : commandes exécutées par Antoine, publication web existante, ressources et stockage Docker, accès personnels et décisions. Les informations réseau et chemins privés restent dans Notion.
- Hébergement intégral Nexus/Docker confirmé, avec nouvelle base vide. Aucune migration prévue pour le Centre familial et aucune suppression de données existantes effectuée.
- Accès extérieur existant confirmé par Antoine ; paramètres Traefik et enregistrement Cloudflare relevés. La chaîne réseau complète, le mode SSL/TLS et la gestion d’un changement d’adresse restent à vérifier avant la mise en ligne du futur portail.
- Comptes Google et Telegram disponibles pour les deux utilisateurs ; accès Alexa confirmé. Agenda partagé, autorisations applicatives, bot familial/appairages et compte développeur Amazon restent à préparer.
- Identité centralisée non identifiée dans l’inventaire antérieur ; proposition Keycloak à expliquer/configurer. Léo/n8n et les alertes Nexus existantes restent à préserver ; origine et couverture à documenter lors de la préparation de l’exploitation.
- T01 est un inventaire terminé, pas une validation de production. Aucun DNS modifié, conteneur installé ou redémarré, secret collecté, notification envoyée ou déploiement réalisé pendant ce parcours.
- Carte T01, entrées T02, tableau de bord, prochaine action, architecture, arbitrages et journal Notion actualisés. T02 et T04b restent à réaliser.

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
- Deux ajouts sauvegardés puis validés par Antoine (« 2 tests des nouveautés effectuées ok »). Revue de la maquette terminée, T04a Terminé.
- PR 3 relue, contrôle GitGuardian réussi sur le commit 4366576a63b399a6b921f2dec62a3861fdcbe93e, aucun retour GitHub en attente. Diff limité à prototype/index.html et prototype/README.md ; aucun workflow GitHub Actions présent dans l’arbre main. Fusion avec SHA attendu : 16a635c89f10190daaa447a51bcf2af69ebe86da. PR 2 reste en brouillon.
- La fusion intègre la maquette autonome au dépôt ; elle ne réalise ni le portail connecté ni son déploiement.
- « Les 3 choses à retenir » reporté ; saisie automatique et rappel « On part dans 15 minutes » écartés ; mode « En magasin » sans décision.
- Tableau de bord, prochaine action et journal Notion actualisés. Aucun service réel connecté, déploiement ou message familial.
- Clone local ancien préservé (main au commit 03cf35c, dossiers prototype/ et .npm-cache/ non suivis). Copie de travail de cette itération dans maison-review-2026-09-18/, hors du clone et des références synchronisées.
