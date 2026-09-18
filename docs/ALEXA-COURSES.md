# Alexa — courses du foyer

Premier périmètre : skill française privée en développement, hébergée sur Nexus.
Invocation proposée : « Alexa, ouvre courses maison », puis « ajoute du lait ».
Un article par demande ; le libellé reconnu est conservé, y compris « sel et poivre ».
Quantité, unité, dates, urgence et rendez-vous ne sont pas interprétés dans ce premier parcours.
Le portail reste disponible pour les modifier. Google Agenda suit cette étape ; les commandes de rendez-vous suivent Google.

## Accès et données

- Liaison OAuth code avec PKCE S256 à un client confidentiel `commandement-alexa`, distinct du navigateur.
- Redirections exactes copiées de la console Amazon, sans joker. Scopes `openid offline_access`, aucun profil ou email demandé.
- Secret client conservé dans la configuration privée et la console Amazon ; jamais dans Git, le modèle vocal ou les journaux.
- Le client Alexa peut seulement ajouter des courses. L'API vérifie la signature du jeton, son audience, son expiration et l'appartenance au foyer à chaque ajout ; elle refuse à ce client la lecture et les autres actions.
- Les Echo partagent un compte Amazon. Le compte Maison associé autorise le foyer ; il ne prouve pas qui parle. La source reste `alexa`, l'acteur technique est le compte associé.
- La liaison est renouvelable. Désactiver la skill côté Amazon et révoquer la session hors ligne du client dans Keycloak retire la liaison ; désactiver le client arrête toute nouvelle liaison. Retirer l'appartenance du compte au foyer refuse immédiatement ses ajouts.

## Traitement

`apps/alexa` est un service sans base ni mot de passe familial, isolé des autres applications.
Seul `POST /integrations/alexa` est routé vers lui sur le domaine du portail.
Le SDK Amazon vérifie la signature SHA-256 du corps brut ; contrôle strict du temps (passé/futur, 150 secondes), de la skill et du français FR avant tout traitement.
Les messages et jetons ne sont pas journalisés. La réponse vocale échappe le texte reconnu.
L'identifiant de requête Amazon devient une clé de reprise stable dans PostgreSQL : une livraison répétée ne crée qu'un article.
Deux demandes vocales distinctes restent deux demandes distinctes.
La voix ne confirme qu'après réception de l'article enregistré. En cas de délai dépassé ou réponse incohérente, elle invite à vérifier Maison avant de recommencer.

## Configuration et installation

1. Créer la skill Custom française avec hébergement propre, en développement. Importer `apps/alexa/interaction-model/fr-FR.json`, enregistrer et construire le modèle.
2. Après sauvegarde locale récente et contrôle de restauration, préparer le client avec les trois redirections exactes de cette skill : variable `ALEXA_REDIRECT_URIS`, valeurs HTTPS séparées par des virgules, puis `node deploy/nexus/prepare-alexa.mjs`. Le fichier privé `alexa-client.json` est créé sans écrasement ; le script ne modifie pas Keycloak.
3. Créer ce seul client dans le realm `commandement` via le canal d'administration existant. Attribuer le rôle standard `offline_access` aux deux membres du foyer si absent : les utilisateurs importés sans rôles ne peuvent sinon pas renouveler la liaison. Cela n'accorde aucun rôle d'administration. Ne pas réimporter le realm, changer les identifiants/mots de passe des utilisateurs ou modifier le client du portail. Conserver le secret dans le coffre. Si le client existe déjà, vérifier sa configuration ; ne pas le remplacer silencieusement.
4. Dans Account Linking : Auth Code Grant, PKCE activé, liaison obligatoire, URL d'autorisation `https://<PORTAL_HOST>/auth/realms/commandement/protocol/openid-connect/auth`, URL de jeton avec suffixe `/token`, client `commandement-alexa`, secret dédié, HTTP Basic, scopes `openid` et `offline_access`. Seul le domaine du portail figure dans Domain List.
5. Après validation technique, créer `.private/nexus/alexa.env` (0600) contenant uniquement `ALEXA_SKILL_ID=amzn1.ask.skill.<id>`. `common.sh` sélectionne alors l'overlay `alexa.yml`. Construire les images à une révision identifiée ; recréer uniquement API, Alexa et web. Pas de migration nouvelle, de port hôte, de nouvelle règle Traefik ou de changement DNS.
6. Endpoint HTTPS de la skill : `https://<PORTAL_HOST>/integrations/alexa`. Vérifier le certificat présenté sur cette adresse publique, qui peut différer du certificat à l'origine derrière un proxy. S'il contient un nom générique (wildcard), choisir dans Amazon « My development endpoint is a sub-domain of a domain that has a wildcard certificate from a certificate authority » ; sinon choisir le certificat standard d'une autorité de confiance. Cette déclaration concerne uniquement l'endpoint de la skill et ne change aucun DNS ni certificat. Activer les essais Development. Associer personnellement le compte Maison depuis l'application Alexa et essayer les Echo réels avant de déclarer T03 terminé. Aucune publication au catalogue.

Le réseau `alexa_egress` permet la récupération HTTPS du certificat de signature Amazon ; les bases restent sur le réseau interne.
La sauvegarde arrête aussi Alexa avant les exports, copie son fichier d'activation et redémarre les services auparavant actifs. Le secret du client est contenu dans l'export de la base d'identité. La destination hors serveur reste différée.
Pour récupérer avec Alexa : restaurer également `alexa.env` et utiliser la version du code archivée, puis revérifier le client et la liaison.
Pour revenir au pilote sans Alexa : arrêter le service Alexa, conserver puis retirer son fichier d'activation et recréer le web avec la configuration de base. Les volumes de données sont préservés ; révoquer le client dédié si nécessaire. Aucune suppression du client ou d'une session sans décision explicite.

## Vérification

- `npm test` : signature absente/certificat hors Amazon refusés, timestamps invalides/passés/futurs, mauvaise skill et locale, compte non lié/extérieur, échappement vocal, erreurs et absence de faux succès, reprise d'une demande, restriction du jeton Alexa.
- `node --test deploy/nexus/test/alexa-client.test.mjs` : redirections strictes, PKCE, audience, absence de grants mot de passe/service.
- Installation locale jetable : ajouter l'overlay Alexa au Compose de recette, puis `NEXUS_TEST_ALEXA=true` dans `deploy/nexus/test/stack.test.mjs`. Ce parcours teste réellement Keycloak (code PKCE et renouvellement HTTP Basic), PostgreSQL, partage, absence de doublon et rejet public non signé. Il ne simule pas une signature Amazon valide.
- Essai réel requis : ouvrir la skill sur l'Echo, lier Maison, ajouter un article test et le retrouver depuis les deux comptes, puis tester aide, arrêt et le second Echo. Les résultats locaux ne remplacent pas ce contrôle.

Références : [SDK Amazon web service](https://developer.amazon.com/en-US/docs/alexa/alexa-skills-kit-sdk-for-nodejs/host-web-service.html), [vérification des requêtes](https://developer.amazon.com/en-US/docs/alexa/custom-skills/host-a-custom-skill-as-a-web-service.html), [liaison de compte](https://developer.amazon.com/docs/alexaplus/account-linking/configure-authorization-code-grant.html).
