# T04b — Maison raccordée aux courses

Le portail `apps/web` reprend l’apparence de la maquette validée, avec une connexion personnelle Keycloak et les courses PostgreSQL de T02. La maquette autonome sous `prototype/` est conservée.

## Parcours disponibles

- Connexion code/PKCE S256, renouvellement du jeton, déconnexion et refus d’un compte extérieur au foyer. L’identité vient de la session, sans sélecteur de profil fictif.
- Ajout d’une demande distincte avec quantité numérique, unité, rayon, date civile et urgence. Achat, réouverture, changement de date, retrait et annulation du dernier achat/retrait.
- « Je m’en occupe » depuis le récapitulatif ou un article. L’autre membre voit l’attribution ; le portail ne remplace pas silencieusement une attribution existante.
- Accueil, liste par rayon, filtres À acheter / Plus tard / Achetés, réglages du compte, raccourci Android via manifeste. Aucun cache hors connexion ni service worker.
- Date des courses calculée en Europe/Paris. « Plus tard » revient automatiquement dans la liste courante à la date prévue, à l’actualisation suivante.
- Nouveautés par compte dans cet onglet : les articles de l’autre membre ajoutés après la première lecture sont signalés, puis acquittés quand on quitte la vue où ils étaient visibles. Cette indication est locale à l’onglet, pas synchronisée entre appareils.

## Erreurs et reprise

Les écritures ne sont jamais affichées comme réussies avant la réponse de l’API. Un conflit 409 recharge la liste et demande à la personne de vérifier avant de recommencer, sans appliquer la modification à une version nouvelle automatiquement. L’annulation utilise aussi la version reçue après l’action.

Un ajout est préparé dans `sessionStorage`, sous une clé propre au foyer et au compte, avant son envoi. Son contenu et sa clé de reprise restent identiques après une coupure ou un rechargement. Le bouton « Reprendre cet envoi » utilise la même clé API, y compris si le serveur avait déjà enregistré la demande. Aucun nouvel ajout ne remplace celui qui reste à vérifier. « Oublier cet envoi » avertit qu’il peut déjà être enregistré et invite à vérifier la liste. Fermer l’onglet peut effacer cette sauvegarde locale.

Les modifications d’un article ne sont pas remises en file automatiquement : après une réponse perdue, la liste est relue et l’utilisateur vérifie le résultat. Aucun ajout n’est rejoué au simple retour du réseau. Les actions sont suspendues quand la liste ne peut pas être actualisée. En cas de 401/403, la liste et les dialogues sont retirés de l’écran. Les résultats tardifs d’une requête ne doivent pas réafficher les données après déconnexion.

Les jetons restent en mémoire dans le SDK ; ils ne sont pas enregistrés dans le stockage navigateur. Aucun nom ni identifiant familial réel n’est inscrit dans le code. Les noms d’articles sont échappés lors du rendu.

## Configuration locale et Docker

`apps/web/config.json` est une configuration publique, sans secret. Son `familyId` vide empêche volontairement toute utilisation avant configuration. Fournir l’UUID du foyer provisionné et les paramètres du client public Keycloak :

```json
{
  "familyId": "11111111-1111-4111-8111-111111111111",
  "auth": {
    "url": "http://localhost:8081",
    "realm": "commandement",
    "clientId": "commandement-center"
  }
}
```

L’UUID ci-dessus est un exemple. Il ne donne aucun droit : l’API contrôle l’appartenance du compte à chaque requête. Pour Docker, monter un fichier de configuration privé en lecture seule à `/usr/share/nginx/html/config.json`, par exemple dans un override local non publié :

```yaml
services:
  web:
    volumes:
      - ./portal-config.json:/usr/share/nginx/html/config.json:ro
```

Nginx sert le portail et transmet `/api/` au service `api:3000` sur le réseau Compose. Le navigateur n’a plus de champs techniques pour modifier l’URL API, le foyer ou le serveur d’identité. Les réponses utilisent `Cache-Control: no-store`. Le fichier de configuration doit utiliser HTTPS pour l’identité, sauf sur localhost.

Pour développer avec une API et un Keycloak locaux déjà préparés :

```sh
npm ci --ignore-scripts
# Exporter PORTAL_FAMILY_ID, PORTAL_AUTH_URL et PORTAL_API_URL dans le terminal.
npm run dev:web
```

Le serveur écoute exclusivement `127.0.0.1:4173` (port modifiable par `PORTAL_PORT`), sert le SDK installé et transmet les requêtes à une API locale. Adapter les URI de redirection et l’origine autorisée du client Keycloak si le port change. Ce serveur est un outil de développement ; Nginx reste la cible Docker.

### Recette Android par USB

Pour cette recette, Antoine a choisi une liaison USB temporaire, avec débogage USB autorisé sur son téléphone. Aucun port du portail n’est ouvert sur le Wi-Fi et aucun certificat n’est installé. Le portail de test est sur le port 4273 et Keycloak sur le port 8182 du PC. Après vérification qu’aucune redirection préexistante n’utilise ces ports, Android Platform-Tools permet de les relier au téléphone :

```sh
# Un seul téléphone USB connecté ; vérifier son état autorisé avant la suite.
adb devices -l
adb -d reverse --list
adb -d reverse --no-rebind tcp:4273 tcp:4273
adb -d reverse --no-rebind tcp:8182 tcp:8182
adb -d reverse --list
```

Ouvrir `http://localhost:4273/` dans Chrome sur le téléphone et garder le câble branché. L’origine localhost reste identique à celle autorisée dans le client Keycloak ; les comptes et l’API ne changent pas. L’aperçu et son raccourci restent utilisables uniquement pendant la liaison et tant que les services de test tournent sur le PC. Cela ne valide pas encore un accès mobile de production indépendant du PC.

Après les essais, supprimer uniquement les redirections créées pour cette recette, puis désactiver le débogage USB sur le téléphone :

```sh
adb -d reverse --remove tcp:4273
adb -d reverse --remove tcp:8182
```

Références : [outils Android officiels](https://developer.android.com/tools/releases/platform-tools), [accès aux serveurs locaux depuis Android](https://developer.chrome.com/docs/devtools/remote-debugging/local-server).

## Vérifications du 18 septembre 2026

- 7 tests web réussis : réponse POST perdue après enregistrement, reprise après recréation du client, absence de doublon et d’historique supplémentaire, séparation des envois par compte, conflit entre deux clients, session expirée, délai dépassé, réponse illisible et dates civiles.
- 26 contrôles backend réussis avec PostgreSQL local. Deux scénarios optionnels non exécutés dans cette commande : test HTTP Keycloak historique et redémarrage explicite du conteneur T02. La recette navigateur ci-dessous utilise un autre Keycloak réel.
- Recette dans le navigateur Codex avec PostgreSQL et Keycloak réels, trois comptes fictifs : connexion Alice, ajout, attribution, urgence, achat, réouverture, report au lendemain, retrait, annulation du retrait, déconnexion ; Bob retrouve la même course et voit l’attribution à l’autre membre ; le compte visiteur est refusé sans affichage de la liste.
- Page Courses vérifiée à 320, 390, 768 et 1440 px : aucun débordement horizontal. Affichage mobile inspecté visuellement. Cela ne remplace pas les deux téléphones physiques.
- Coupure réelle de l’API de test pendant un ajout : envoi conservé, rechargement du navigateur, relance de l’API puis reprise réussie. La course et son attribution précédentes restent présentes après cette relance. Formulaire inspecté à 320 px ; aucune erreur JavaScript relevée lors du contrôle final.
- Image Docker du portail construite ; dépendances installées sans avis de vulnérabilité connu remonté par npm à cette date.

## Recette utilisateur validée

Antoine confirme « M1 à m7 ok » le 18 septembre : connexion, ajout depuis le clavier du téléphone, achat/réouverture, urgence et changement de date, navigation portrait/paysage, ouverture depuis le raccourci d’accueil et changement de compte avec partage de la liste. Les sept essais mobiles sont déclarés réussis sur son Android via USB. Le deuxième téléphone a été retiré du périmètre à sa demande. La recette T04b du portail connecté aux comptes et aux courses est donc validée, sans valider un déploiement ni les intégrations encore à préparer.

Périmètre révisé par Antoine après les essais ordinateur : la recette mobile sera réalisée sur son téléphone Android uniquement. Il ne juge pas utile de tester le second téléphone ; celui-ci ne constitue donc plus un critère requis pour T04b. La déconnexion ajoutée dans l’en-tête est également confirmée fonctionnelle par Antoine. Les mentions antérieures de deux Android décrivent le périmètre initial.

Retour du 18 septembre : Antoine déclare les 13 essais guidés réussis, après les deux premiers essais connexion/ajout et partage avec le second compte. La série couvre ajout détaillé, achat, réouverture, report, retour au jour courant, urgence, attribution, libération, retrait/annulation, rechargement, nouveautés, refus du visiteur et présentation générale. Ce retour ne valide pas les deux Android.

Observation : déconnexion difficile à trouver dans Réglages. Un bouton textuel « Déconnexion » est désormais présent dans l’en-tête sur chaque page connectée. Vérification après correction : bouton visible à 320 px sans débordement, déconnexion Keycloak réelle et retour à l’écran de connexion. Les 13 essais ne sont pas à refaire pour ce changement ciblé.

1. Connexion et déconnexion avec les deux comptes de test ; vérifier l’accueil et l’ajout sur ordinateur.
2. À deux : création, achat/réouverture, report, urgence, attribution, retrait et annulation. Vérifier la visibilité après actualisation depuis l’autre compte.
3. Recette mobile réalisée : sept essais M1 à M7 déclarés réussis sur le téléphone d’Antoine, y compris l’ouverture depuis le raccourci. L’accès utilisait la liaison USB temporaire.
4. Avant mise en service : comptes réels, HTTPS, domaine et routage Nexus, raccourci vers l’adresse finale et accès sans PC/câble, sauvegarde/restauration et contrôles d’exploitation.

La page Agenda et les réglages indiquent les intégrations à préparer. Aucun rendez-vous Google, créneau à double validation, rappel Telegram, journée tranquille opérationnelle ou capture Alexa n’est annoncé comme connecté. Ces fonctions relèvent des lots suivants. T04b est validé pour le raccordement aux comptes et aux courses dans l’environnement de recette. Aucun déploiement Nexus ni changement DNS.
