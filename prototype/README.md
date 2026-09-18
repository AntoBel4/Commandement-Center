# Maison — maquette navigable

Maquette du portail familial, livrée le 17 septembre 2026. Ouvrir `index.html` dans un navigateur récent : aucun serveur ni installation nécessaire. Le fichier contient tous ses styles, illustrations et interactions, sans dépendance externe.

## Parcours proposés

- **Aujourd’hui** : liste du jour, rendez-vous et aperçu du récapitulatif Telegram.
- **Courses** : ajout, achat, report à demain, retour à aujourd’hui, urgence simulée, suppression et annulation.
- **Agenda** : sélection du jour, navigation entre semaines, création, détail et suppression de rendez-vous fictifs.
- **Réglages** : changement de profil de démonstration, préférences de rappels et réinitialisation.

Cliquer sur l’avatar en haut à droite pour basculer entre Antoine et Belinda. La présentation s’adapte aux téléphones, tablettes et ordinateurs.

## Limites explicites

Il s’agit d’un prototype visuel indépendant de l’application existante. Tous les articles et rendez-vous sont fictifs. La date de référence est le 17 septembre 2026. Les modifications sont conservées uniquement en mémoire jusqu’au rechargement de la page.

Aucune authentification, base de données, synchronisation Google Agenda, commande Alexa ni notification Telegram n’est branchée. Les connexions affichent « À connecter ». Les ajouts sont placés dans la liste du jour pour tester le parcours ; la coupure de 17 h 15 et l’ordonnancement des rappels ne sont pas exécutés. Les profils sont des aperçus, pas des sessions de comptes réels.

Cette maquette ne constitue pas un déploiement sur `famille.estarellas.online` et ne modifie aucun service sur Nexus.

## Vérifications réalisées

Contrôle visuel et exécution dans Edge via Playwright. Les quatre écrans ont été vérifiés à 320, 390, 768 et 1440 pixels, sans débordement horizontal. Parcours vérifiés : ajout, achat, report, retour, urgence, suppression et annulation de courses ; création, détail et suppression d’un rendez-vous ; navigation semaine/jour ; réglages ; changement de profil ; fermeture de fenêtre par Échap. Aucune erreur JavaScript ni requête externe observée.

Le 18 septembre, les 12 parcours guidés de la version initiale ont été déclarés réussis par Antoine. L’appareil et le navigateur n’ont pas été précisés : cela ne prouve pas un essai sur les deux Android. Les ajouts ci-dessous restent à valider par l’utilisateur avant intégration dans l’application.

## Ajouts du 18 septembre 2026

- **Nouveautés par profil** : les courses et rendez-vous ajoutés par l’autre profil portent « Ajouté depuis votre dernière visite ». L’indication reste pendant la visite courante ; après avoir changé de profil puis être revenu, les éléments affichés lors de la visite précédente ne sont plus nouveaux. Les éléments non encore affichés conservent leur indication. Les exemples initiaux ne sont pas marqués nouveaux.
- **Journée tranquille** : dans Réglages, pause personnelle des rappels ordinaires jusqu’au lendemain à 7 h, heure de Paris. Les préférences existantes sont conservées et les urgences restent actives dans la simulation. Reprise anticipée possible depuis le bandeau. L’échéance utilise la date réelle du navigateur, indépendamment de la date fictive de l’agenda ; actualisation dans les 30 secondes ou au retour sur l’onglet. Aucun message réel n’est programmé ni envoyé.
- Ces états restent en mémoire ; recharger ou réinitialiser efface la simulation.

### Vérifications des ajouts

- Navigateur Codex : apparition et disparition de l’indication après changement de profil, courses et agenda ; pause personnelle, reprise anticipée, maintien d’un rappel déjà désactivé, urgence disponible pendant la pause.
- Agenda avec nouveauté aux largeurs 320/390/768/1440 px : aucun débordement horizontal ; réglages à 390 px inspectés visuellement ; aucune erreur console observée.
- Vérification isolée de l’échéance à 7 h Europe/Paris, y compris passage à l’heure d’hiver et changement d’année.

### Deux essais utilisateur restants

1. Ajouter une course ou un rendez-vous sous un profil, basculer vers l’autre et le consulter : indication visible. Changer de profil puis revenir : l’indication du contenu consulté a disparu.
2. Activer Journée tranquille : bandeau visible et rappels ordinaires en pause pour ce profil uniquement. Vérifier une urgence simulée, puis Reprendre mes rappels : préférences habituelles conservées.
