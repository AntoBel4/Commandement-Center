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

La revue avec Antoine et l’essai sur les vrais appareils Android restent à réaliser. Le retour visuel guidera l’intégration dans l’application réelle, suivie des connexions et de la recette de production.