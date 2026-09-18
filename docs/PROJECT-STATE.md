# État courant — Centre familial

Dernière mise à jour : 18 septembre 2026 (Europe/Paris).
T01 terminé : inventaire daté de la cible et des accès consigné dans Notion. T02 terminé pour le socle technique : courses persistantes et accès privés intégrés en PR 4, sans déploiement. Maquette validée : 14 essais réussis selon l’utilisateur, T04a terminé et PR 3 fusionnée. T04b terminé pour les comptes privés et courses : recette PC/Android validée et PR 5 fusionnée. Aucun travail différé ni surveillance programmée.
T08 : services comptes/courses installés sur Nexus ; publication de famille.estarellas.online réalisée après reprise explicitement autorisée le 18 septembre. DNS propre vers Nexus et HTTPS strict vérifiés. Le 18 septembre, Antoine confirme les mots de passe et informations des deux comptes modifiés, les deux espaces accessibles, puis l’essai Android en 4G/5G sans USB réussi (connexion, ajout d’une course, rechargement, déconnexion). Les huit tests finaux T1 à T8 sont également confirmés réussis par Antoine. Phase actuelle : Alexa courses acceptée depuis l’application Alexa du téléphone ; essais supplémentaires sur les Echo dispensés explicitement. T03 terminé et PR 7 fusionnée. T06 Google Agenda démarré ; propriétaire choisi : compte Google d’Antoine. Destination hors serveur toujours différée.
Cette fiche est un point de reprise : vérifier GitHub et Notion en direct avant de reprendre.

## Google Agenda — phase démarrée le 18 septembre

Agenda partagé pour le foyer, Google comme référence des événements confirmés, affichage et ajout dans Maison, modifications/annulations/récurrences Google reflétées, puis créneaux à double validation selon le besoin existant. Rappels Telegram et capture vocale des rendez-vous restent dans leurs lots respectifs.

- Compte propriétaire choisi : Antoine. Nouvel agenda privé « Maison - Famille » créé, fuseau Europe/Paris ; agenda Famille préexistant préservé. Aucun événement créé.
- Projet Google dédié Maison Famille créé. Antoine exige zéro dépense et autorise le compte de facturation actif seulement si nécessaire. Vérification après activation de Calendar API : aucun compte de facturation associé ; aucun service payant activé.
- Google Calendar API activée après accord explicite d’Antoine sur les conditions ; état Activé observé dans la console.
- Partage avec Belinda enregistré à l’adresse fournie, droit d’ajouter/modifier, détails des événements marqués privés masqués. Réception et affichage sur son téléphone non vérifiés.
- Compte technique Maison Agenda créé sans rôle Cloud. Accès persistant au seul agenda Maison - Famille explicitement autorisé puis enregistré : lecture/ajout/modification/suppression, sans gestion du partage, détails privés masqués. Aucun autre agenda partagé avec ce compte.
- Création personnelle de la clé JSON demandée à Antoine ; fenêtre prête. Aucune clé créée par l’agent ni installée à ce stade. T06 En cours ; aucun événement synchronisé et aucun déploiement Google réalisé.

## Alexa courses — acceptée depuis l’application du téléphone

18 septembre 2026 — Correction d’Antoine : les essais précédemment indiqués « sur Echo » ont été réalisés dans l’application Alexa de son téléphone. Ajout simple, précisions guidées et phrase complète sont acceptés sur ce support. Antoine dispense explicitement les essais supplémentaires, y compris sur les deux Echo, et demande de passer à Google Agenda. Ces essais dispensés ne sont pas des réussites observées. T03 terminé selon ce périmètre accepté ; PR 7 fusionnée au commit 5850fafa41ddc39b2935394d16f1359b53501d55, révision déployée 57aa69d inchangée. Aucun nouveau test ni déploiement Alexa demandé.
Les éléments ci-dessous retracent les diagnostics. Les mentions historiques de validation sur Echo sont corrigées : les essais réussis ont eu lieu dans l’application Alexa du téléphone.

- [PR 7 — Courses Alexa](https://github.com/AntoBel4/Commandement-Center/pull/7), branche `feat/alexa-groceries`, tête `57aa69d882079ad00295b1e734979fdbeb3a7825` : fusionnée au commit `5850fafa41ddc39b2935394d16f1359b53501d55`. Installation initiale f74f1a7 ; correctif web 702a125 puis dialogue Alexa a3aa129 et saisie en une phrase 57aa69d. Image Alexa 57aa69d sélectionnée par ALEXA_RELEASE ; API/web restent f74f1a7, aucun redémarrage de ces services pour l’extension. [Guide et limites](https://github.com/AntoBel4/Commandement-Center/blob/feat/alexa-groceries/docs/ALEXA-COURSES.md).
- Skill française « Courses Maison », invocation actuelle « carnet familial », modèle construit et tests Development activés. Un article par demande ; source Alexa et compte lié, sans identification du locuteur.
- Client dédié code/PKCE S256, audience API, jetons courts et renouvellement ; API limitée à l’ajout de courses pour ce client. Liaison persistante explicitement autorisée après demande d’accord. Aucun secret dans le dépôt, Notion ou le chat ; secret enregistré personnellement, succès de sauvegarde Amazon vérifié.
- Tests locaux : 30 réussis dans la commande générale, deux options backend ignorées ; test du générateur client réussi. Parcours séparé Keycloak/PostgreSQL réel réussi : code PKCE, renouvellement Basic, restrictions d’accès, ajout persisté une seule fois en cas de répétition. CI PostgreSQL et GitGuardian réussis.
- Sauvegarde locale de production faite avant intervention ; restauration isolée des deux bases, empreintes et nombres d’enregistrements vérifiés. Cela ne valide pas encore une restauration complète du service ni une sauvegarde hors serveur.
- Six services Maison sains après installation. HTTPS accueil et découverte OIDC 200 ; courses anonymes 401 ; administration 404 ; POST Alexa sans signature 400. Vérification des paramètres du client effectuée sans afficher le secret.
- Aucune modification DNS/Cloudflare, autre sous-domaine ou service tiers. Seuls API/web Maison et le nouveau service Alexa sont concernés ; configurations précédentes conservées pour retour arrière.
- « Vos skills » retrouvé par Antoine ; association interrompue par Bad Gateway. Erreur Nginx « upstream sent too big header » reproduite avec un état OAuth fictif long. Correctif 702a125 : limites bornées adaptées aux cookies de liaison, uniquement dans le serveur Maison et la route de connexion. Recette complète locale réelle réussie avec état de 4 000 caractères ; CI/GitGuardian réussis. Seul web recréé sur Nexus ; six services sains et même contrôle public passé de 502 à 200 avec formulaire présent.
- Déclaration du type de certificat public corrigée en wildcard dans la skill après contrôle TLS public valide. Après un premier retest encore refusé, le diagnostic manuel Amazon réussit : demande signée reçue et réponse Maison 200 observée le 18 septembre à 17:49 UTC. Le scénario fictif sans jeton reçoit logiquement la carte de liaison. Aucun changement Cloudflare/DNS.
- Après correction, association personnelle confirmée par Antoine (« Compte associé ») ; échanges de jetons 200 observés sur Maison. Premier essai Echo : « aucun groupe ou appareil », aucun ajout confirmé. Antoine confirme Français (France) sur l’enceinte.
- Modèle vocal reconstruit avec succès le 18 septembre (console : 19:55). Après reconstruction, « ouvre courses maison » dans le simulateur produit le véritable accueil Maison, avec compte lié et réponse signée traitée. Le blocage de reconnaissance antérieur ne se reproduit plus dans ce test. Nouvel essai réel Echo toujours en échec selon Antoine : recherche d’appareil ou groupe. Après « stop », « lance courses maison » fonctionne dans le simulateur ; même formulation demandée sur l’Echo, résultat attendu.
- 18 septembre 2026 — Après « lance courses maison », Antoine rapporte « Pour contrôler un appareil vidéo… ». Nouveau nom d’appel de développement : « carnet familial », titre de skill « Courses Maison » inchangé. Modèle construit avec succès (console : 20:05) ; « ouvre carnet familial » produit l’accueil Maison dans le simulateur, avec la même skill et la liaison conservée. Modèle et guide sauvegardés au commit 1bc2f7a dans la PR 7 ; CI et GitGuardian réussis. Aucun changement serveur, DNS, Cloudflare ou compte. Essai réel « Alexa, ouvre carnet familial » demandé ; aucun ajout sur enceinte encore confirmé.
- Retour Echo après le nouveau nom : dialogue jour/heure puis erreur, distinct de l’accueil et des commandes de la skill Maison. Transcription exacte de la commande de lancement demandée dans l’historique vocal pour distinguer reconnaissance et routage ; aucun ajout confirmé.
- **Historique du dialogue guidé :** 18 septembre 2026 — Antoine confirme que l’ajout vocal simple fonctionne et que l’article apparaît dans Maison. Il demande quantité, unité et rayon, puis choisit « Alexa demande les informations manquantes, avec possibilité de dire passer ». Extension réalisée au commit a3aa129 : dialogue manuel, précisions facultatives, combinaison quantité/unité, rayons du portail, écriture seulement en fin de dialogue, annulation sans écriture et clé de reprise stable. Dix tests Alexa et parcours local Keycloak/PostgreSQL réels réussis ; CI et GitGuardian réussis. Modèle Amazon construit (console : 20:26). Seul le service Alexa a été recréé à cette révision ; six services sains, autres images/services et comptes inchangés. Recette réelle dans le simulateur avec compte lié : article « test dialogue alexa » enregistré une seule fois avec 1,5 kg et Fruits & légumes, valeurs relues dans Maison ; « passer » à la quantité et à l’unité, puis « annuler » au rayon vérifiés, article annulé absent de la base. Un essai Echo des trois précisions est demandé ; résultat encore attendu. Second Echo et recette de l’extension restent ouverts, PR 7 brouillon. Google Agenda ensuite ; destination hors serveur différée.
- **Historique de la saisie en une phrase :** 18 septembre 2026 — Antoine confirme que l’article du dialogue quantité/unité/rayon apparaît correctement dans Maison, puis demande de tout dire en une seule phrase. Extension 57aa69d : « ajoute deux paquets de pâtes au rayon épicerie » renseigne les quatre valeurs et ajoute directement ; une phrase incomplète demande seulement les précisions absentes. Extraction limitée aux quantités françaises prises en charge, unités usuelles et rayon explicitement annoncé ; noms composés conservés, aucune information inventée. Quatorze tests Alexa et parcours réel local Keycloak/PostgreSQL réussis, avec reprise sans doublon ; CI et GitGuardian réussis. Seul Alexa recréé sur Nexus à 57aa69d, six services sains ; modèle Amazon et liaison conservés. Simulateur Amazon avec compte lié : ajout immédiat « test phrase alexa », quantité 2, unité paquet, rayon Épicerie ; valeurs relues en base, une seule ligne. Phrase partielle « deux bouteilles de test phrase partielle » : seule question du rayon, puis annulation confirmée et absence en base. Recette de la phrase complète sur Echo confirmée ensuite par Antoine (« Ca fonctionne ») ; passer/annuler sur enceinte et second Echo restent ouverts. PR 7 en brouillon. Google Agenda ensuite ; destination hors serveur différée.
- **Recette acceptée :** application Alexa du téléphone validée ; essais supplémentaires sur Echo dispensés par Antoine, sans les déclarer réussis. T03 terminé ; commandes vocales de rendez-vous encore dans T07.

## Reprise autorisée le 18 septembre — domaine familial publié

Après l’arrêt, Antoine confirme le périmètre exclusif `famille.estarellas.online`, puis demande « très bien execute alors ». Aucune modification des autres noms, de leurs règles ou des réglages globaux du domaine n’est autorisée.

- Création d’un enregistrement A propre au nom familial, directement vers l’adresse publique de Nexus, proxy Cloudflare activé et TTL automatique. Aucun alias vers Nextcloud, aucun autre enregistrement changé.
- Nouvelle règle « Famille - HTTPS strict », active, filtre exact `http.host eq "famille.estarellas.online"`, mode Strict. Aucun joker ni changement global ; aucune règle des autres sous-domaines modifiée.
- Contrôles publics réussis : résolution DNS, certificat HTTPS validé, accueil 200 via Cloudflare, redirection HTTP vers HTTPS 301. Accueil servi avec `Cache-Control: no-store` et `CF-Cache-Status: DYNAMIC`.
- Courses anonymes refusées (401), administration/master/santé identité et intégrations fermées (404), découverte OIDC avec origine HTTPS familiale. L’écran réel de connexion s’ouvre sur ce même domaine.
- Premiers accès des deux comptes déposés dans un fichier privé sur le PC, exclu de Git ; aucun mot de passe publié dans GitHub/Notion ou affiché dans la conversation. Le 18 septembre, Antoine confirme que les deux mots de passe et les informations des deux comptes ont été modifiés et que les deux espaces sont accessibles.
- Essai Android réel confirmé par Antoine le 18 septembre sur l’adresse HTTPS définitive, Wi-Fi désactivé, en 4G/5G sans câble USB : connexion, ajout d’une course, rechargement puis déconnexion réussis.
- 18 septembre 2026 — Antoine confirme « T1 à T8 parfaits ». Les huit tests d’usage du portail installé sont validés : T1 partage des courses dans les deux sens ; T2 attribution et libération entre les deux comptes ; T3 achat et réouverture ; T4 report et urgence ; T5 retrait et annulation ; T6 conservation après fermeture du navigateur ; T7 raccourci Android vers l’adresse HTTPS définitive et accès Wi-Fi ; T8 protection de la liste après déconnexion, retour et actualisation. Les comptes personnels et l’accès Android en 4G/5G sans USB étaient déjà validés. Aucun de ces essais n’est à refaire.
- Prochaine phase convenue : Alexa d’abord pour ajouter des courses depuis les Echo dans la liste familiale, puis Google Agenda et les créneaux à double validation. Les commandes vocales concernant les rendez-vous suivront le raccordement Google. Les intégrations ne sont pas encore réalisées.
- Administration nominative, sauvegarde hors serveur, restauration complète et alertes restent à finaliser. La destination hors serveur reste différée à la demande d’Antoine. T08 reste En cours pour ces contrôles d’exploitation ; la recette d’usage du portail comptes/courses installé est terminée.

## Historique — arrêt demandé le 18 septembre

Antoine avait demandé « STOP » et interdit tout rattachement au sous-domaine Nextcloud existant. Cette pause a été levée par sa reprise explicite consignée ci-dessus, avec confirmation du nom famille.estarellas.online. L’interdiction de modifier les autres sous-domaines et leurs règles reste applicable. Les faits suivants décrivent l’état au moment de l’arrêt.

- Installation réalisée avant l’arrêt : version `4926337fb9e46cf0cc3f43875710d6c1c65c3845`, deux bases, identité, API et portail dans un projet Docker dédié. Code inchangé. Premiers accès générés dans la configuration privée ; mots de passe personnels non définis par les utilisateurs et non transmis.
- Premier démarrage corrigé : droits du code trop restrictifs lors du clonage ; permissions de lecture rétablies pour les fichiers applicatifs, répertoire des secrets maintenu privé, images reconstruites. Migrations et rattachement des deux membres réussis ; un foyer, deux membres, aucune course.
- Certificat Let’s Encrypt réel obtenu par Traefik pour le nom initialement prévu. Vérification directe à l’origine avec validation TLS : accueil 200, courses anonymes 401, administration/master/santé identité et intégrations 404, découverte OIDC 200. Cela ne valide pas un accès Internet ou Android.
- Aucun enregistrement A/AAAA/CNAME familial créé ; aucun changement au DNS Nextcloud. Cloudflare lu après connexion personnelle d’Antoine : mode global Full automatique. Règle Strict limitée au portail préparée, activation refusée par le contrôle automatique puis formulaire abandonné sans enregistrement après le STOP. Ne pas considérer l’ancienne demande d’approbation comme encore applicable.
- Refus initial de réutiliser un accès Cloudflare issu de Traefik : aucune lecture du secret exécutée ; Antoine préfère se connecter lui-même. Ne pas réutiliser cet accès.
- Un jeu de sauvegarde locale initiale est présent après l’interruption. Le résultat final de sa restauration de contrôle n’a pas été reçu : ne pas la déclarer réussie. Aucune destination hors serveur choisie ou configurée.
- Après interruption : les cinq services familiaux persistants sont sains ; migration/provisionnement sortis avec code 0. Nextcloud et Traefik affichent toujours 42 heures de fonctionnement, sans redémarrage provoqué par cette intervention. Aucun processus de sauvegarde/restauration encore actif constaté.
- Restent non validés : publication DNS/Cloudflare, accès extérieur, changement initial des mots de passe, administration nominative, essai Android sans USB, restauration complète et alertes. T08 reste inachevé.

## Historique T08 — préparation Nexus intégrée le 18 septembre

Antoine approuve de préparer Nexus avant les intégrations (« ok commençons »), pour un premier périmètre comptes/courses. T08 reste en cours : préparation intégrée, installation et mise en service non réalisées.

- [PR 6 — Préparation Nexus](https://github.com/AntoBel4/Commandement-Center/pull/6) fusionnée dans main au commit `d61d4186e9b4b9019e9332c38095a2746cc00d3d`, tête vérifiée `f673e90e15f24d4527ac71e624100fe42e1b9a95`. CI PostgreSQL et GitGuardian réussis ; aucune revue humaine GitHub en attente. Workflow de tests uniquement.
- Compose de production indépendant, Keycloak en mode production, deux bases internes, Nginx seul derrière Traefik, routes administratives et intégrations non exposées. Configuration privée générée sans écrasement et mots de passe initiaux temporaires. [Procédure](https://github.com/AntoBel4/Commandement-Center/blob/main/docs/NEXUS-PRODUCTION.md).
- Diagnostic direct de Nexus en lecture seule effectué. Aucun service serveur installé, arrêté ou modifié ; aucun DNS modifié ni compte familial réel créé. Les connexions testées utilisent uniquement des comptes fictifs dans Docker local.
- Validation locale : 2 tests du générateur ; images API/web construites ; Compose et sondes sains ; code/PKCE, changement du mot de passe initial, partage des courses, reprises sans doublon, refus du visiteur et du jeton d'identité. Export de deux jeux de sauvegarde et restauration des deux bases dans un conteneur sans réseau réussis, empreintes et nombres d'enregistrements correspondants. Reprise des services après sauvegarde vérifiée.
- Antoine choisit une nouvelle destination hors Nexus puis reporte son emplacement (« À choisir plus tard »). Aucun stockage distant, achat, transfert ou planification créé. La copie hors serveur, la restauration du service complet, les objectifs de reprise et les alertes restent à établir.
- Travail dans `nexus-production/`, autres dossiers locaux préservés. Préparation validée techniquement ; certificat réel, DNS/TLS, comptes personnels et accès Android indépendant du PC restent à vérifier. T04b reste terminé : ne pas redemander les anciens essais.

## T04b — recette validée et intégration du 18 septembre

Antoine confirme les 13 essais guidés PC, le correctif de déconnexion (« Ca fonctionne »), puis les 7 essais Android (« M1 à m7 ok »), raccourci inclus. Il a explicitement limité la recette mobile à son téléphone : le second appareil est dispensé.

- [PR 5 — Portail Maison connecté](https://github.com/AntoBel4/Commandement-Center/pull/5) fusionnée dans main, commit de fusion `1959ace33eddc4fc67f778694afac13782be5ada`, tête vérifiée `983643f0f8020d0542881cb93cbe490a935ceabe`. CI et GitGuardian réussis ; aucun retour GitHub en attente. [Contrat et recette](https://github.com/AntoBel4/Commandement-Center/blob/main/docs/T04B-PORTAL.md).
- Connexion personnelle, déconnexion visible, courses persistantes, attribution « Je m’en occupe », achat/réouverture, report par date, urgence, retrait/annulation. Reprise des ajouts avec clé conservée et gestion explicite des conflits.
- 7 tests web et 26 contrôles backend PostgreSQL réussis ; 2 scénarios backend optionnels non exécutés dans cette commande. Recette navigateur Keycloak/PostgreSQL réels avec comptes fictifs, accès refusé au visiteur et reprise après coupure/rechargement vérifiés. Docker construit et Nginx contrôlé.
- Courses à 320/390/768/1440 px sans débordement horizontal ; formulaire et déconnexion inspectés à 320 px. Recette utilisateur PC et Android terminée.
- Essais Android via redirections USB locales temporaires, retirées après validation. Le raccourci utilise l’adresse locale de recette et ne constitue pas un accès permanent. L’aperçu PC peut ne plus tourner à la reprise.
- T04b terminé pour les comptes et les courses. Agenda Google, créneaux à double validation, Telegram, journée tranquille opérationnelle et Alexa restent dans leurs lots. Indicateurs de nouveautés locaux par compte et onglet.
- Aucun déploiement Nexus ni modification DNS. Comptes et identité de production, routage, sauvegardes et mise en service restent à préparer.

## Où nous en sommes

- Cadrage V1 établi : portail web privé, courses partagées, agenda et capture vocale, socle Docker prévu derrière Traefik.
- Hébergement décidé par Antoine le 18 septembre : tout le Centre familial sur Nexus avec Docker, y compris le portail, les données et les traitements. Le site existant reste chez Amen ; DNS gérés par Cloudflare et sous-domaine prévu famille.estarellas.online. T01 est terminé pour l’inventaire : accès extérieur existant confirmé, paramètres de publication et ressources relevés, comptes personnels disponibles et nouvelle base vide décidée. Les autorisations applicatives et le routage du futur portail restent à configurer et tester. Aucun DNS modifié.
- T02 intégré le 18 septembre : cycle de vie des courses, historique transactionnel, versions contre les conflits, reprises d’envoi et contrôles d’accès. 28 contrôles locaux réussis, dont PostgreSQL et Keycloak réels avec comptes fictifs. Portail connecté intégré depuis via T04b ; identité de production encore à préparer.
- Notion a été réorganisé : tableau de bord, sept pages thématiques, onze actions V1 et cinq évolutions.
- Maquette interactive « Maison » livrée : Aujourd’hui, Courses, Agenda, Réglages. Elle est indépendante de l’application, avec données fictives uniquement.
- Les 12 tests guidés de la maquette initiale sont déclarés réussis par Antoine : accueil, ajout/achat/retour/report/urgence/suppression des courses, récapitulatif, création/gestion des rendez-vous, profils et rappels.
- Deux ajouts ensuite livrés : indication des nouveautés par profil sur courses/agenda, et Journée tranquille personnelle jusqu’au lendemain à 7 h Paris (simulation, urgences conservées, reprise anticipée et préférences préservées). Leurs deux essais sont déclarés réussis par Antoine : 14 essais validés au total et T04a = Terminé.
- « Je m’en occupe » réalisé, validé par Antoine et intégré via la PR 5. Les propositions de créneaux avec validation des deux personnes restent à préparer avec T06. Détails et autres choix dans Notion.
- Services comptes/courses installés sur Nexus ; domaine familial et HTTPS désormais publiés dans le périmètre strict autorisé (voir la reprise ci-dessus). Aucune intégration réelle Google/Telegram/Alexa connectée par ces sessions.
- Base de code examinée au commit 03cf35c05a16714bf49958d191dc092980124b00 : connecteurs de synchronisation incomplets, déploiement initial Caddy, authentification désactivable. La proposition V1 précise les corrections nécessaires.

## Travail sauvegardé et PR

| PR | Branche | Dernier commit observé | État observé | Suite |
| --- | --- | --- | --- | --- |
| [6 — Préparation Nexus](https://github.com/AntoBel4/Commandement-Center/pull/6) | feat/nexus-production | f673e90e15f24d4527ac71e624100fe42e1b9a95 | Fusionnée le 18 septembre, commit d61d4186e9b4b9019e9332c38095a2746cc00d3d | Services et domaine familial publiés ; deux comptes personnels et essai Android en 4G/5G sans USB validés par Antoine. |
| [5 — Portail T04b](https://github.com/AntoBel4/Commandement-Center/pull/5) | feat/t04b-portal | 983643f0f8020d0542881cb93cbe490a935ceabe | Fusionnée le 18 septembre, commit 1959ace33eddc4fc67f778694afac13782be5ada | Comptes/courses validés PC et Android ; intégrations et déploiement à préparer. |
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

1. Poursuivre Google Agenda : Calendar API activée, agenda Maison - Famille partagé avec Belinda et accès technique limité autorisé/enregistré. Attendre la création personnelle de la clé JSON puis l’installer de manière protégée et raccorder Maison. Projet sans facturation, zéro dépense autorisée. Ne pas reprendre les essais Alexa dispensés ni T1 à T8.
2. Toute intervention DNS/Cloudflare reste strictement limitée à famille.estarellas.online. Aucun changement des autres noms, de leurs règles ni des réglages globaux ; aucun alias vers Nextcloud.
3. Conserver la destination hors serveur différée. Administration nominative, restauration complète et alertes restent à terminer dans T08 ; les intégrations suivent. PR 2 reste en brouillon.

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
