# Déploiement sur Nexus — PR 10 (T05) puis T08 (sauvegarde chiffrée, restauration, alerte)

Mis à jour à la clôture du 3 octobre 2026. T05 est installé à `5bb65aa` ; sauvegarde hors site, administration nominative et alertes Maison sont installées et partiellement éprouvées. Voir `docs/PROJECT-STATE.md` pour les preuves exactes et leurs limites. Les commandes ci-dessous sont une procédure à adapter à l’état présent, pas une instruction de rejouer l’installation. Périmètre : Maison uniquement ; conserver les autres services Nexus.

Décisions d’Antoine (29/09) : **D2** perte maximale 24 h (sauvegarde nocturne), reprise 4 h sur Nexus, 24 h sur une autre machine. **D3** archive chiffrée avec age, clé publique seule sur Nexus, envoi vers un compartiment dédié du stockage objet S3 Contabo existant, clé d’accès limitée à ce compartiment **en écriture seule, sans suppression** ; rotation distante depuis le PC d’Antoine (clé de rotation uniquement sur le PC) ; clé privée sur clé USB chez Antoine + copie papier ailleurs, jamais sur Nexus ni dans un coffre hébergé sur Nexus.

Conventions : commandes lancées depuis la racine du clone Maison sur Nexus (chemin : à vérifier sur place), avec la fonction `dc` de `deploy/nexus/common.sh` :

```bash
cd <racine du clone Maison>            # à vérifier sur place
source deploy/nexus/common.sh           # définit dc() ; umask 077
```

Durée estimée totale : partie A ≈ 45 min, partie B ≈ 1 h 15 (dont 30 min côté panneau Contabo et PC), partie C ≈ 20 min.

---

## A. Installer la PR 10 (T05 courses Telegram)

Révision installée : `5bb65aaa11bbaa07873e80cc22fc9266a51e59ae`, contrôles test, image-permissions et GitGuardian réussis. Pour une intervention future, choisir un SHA relu avec ses contrôles réussis, sans prendre automatiquement la tête mouvante de la PR. Révision de retour arrière : `fb9aedf92f270affda33ebc97dc75309d0cd3063`.

| # | Commande | Sécurité | Sauvegarde préalable | Retour arrière |
|---|---|---|---|---|
| A1 | `git rev-parse HEAD ; dc ps ; dc images` — **à vérifier sur place** : HEAD = fb9aedf, sept services sains, overlays Google et Telegram actifs ; sinon s’arrêter | Lecture seule. | — | — |
| A2 | `deploy/nexus/backup.sh /<dossier sauvegardes>/avant-pr10-$(date +%F)` puis `deploy/nexus/restore-check.sh <ce dossier> <POSTGRES_IMAGE épinglée>` | Arrêt bref des services applicatifs Maison ; dossier 700 contenant des secrets. | C’est la sauvegarde. | Les services redémarrent seuls ; sinon `dc up -d --no-build`. |
| A3 | `cp -p .private/nexus/telegram.env .private/nexus/telegram.env.fb9aedf` et `docker image tag commandement-api:fb9aedf… commandement-api:rollback-fb9aedf` (idem web) | Copie privée 600. | — | Sert au retour arrière. |
| A4 | `git fetch origin claude/eager-galileo-ezltlj && git checkout --detach <SHA PR 10>` | Code seulement ; aucun secret dans le dépôt. | A2 | Conserver le checkout contenant T08 ; restaurer les configurations/images selon « Retour arrière A ». |
| A5 | Éditer `.private/nexus/telegram.env` : `TELEGRAM_RELEASE=<SHA PR 10>` et **ajouter** `TELEGRAM_ALERT_USER=<UUID du compte Maison d’Antoine>` (UUID relevé dans Keycloak, pas un identifiant Telegram) | Fichier privé 600, jamais publié. | A3 | Recopier `telegram.env.fb9aedf`. |
| A6 | `dc config --quiet && dc build api web` | `config` sans `--quiet` affiche des secrets : ne pas l’utiliser. | — | Images fb9aedf conservées (A3). |
| A7 | `dc run --rm migrate` (aucune migration nouvelle en T05, contrôle de cohérence) puis `dc up -d --no-build --wait --wait-timeout 300 api web telegram` | Aucun port, aucun webhook ; polling sortant. | A2 | Voir « Retour arrière A ». |
| A8 | `dc ps` ; `curl -fsS https://famille.estarellas.online/` (200) ; routes privées anonymes 401 | Lecture seule. | — | — |
| A9 | Antoine : dans Maison, vérifier la liaison Telegram, ajouter « test pr10 » par Telegram, cliquer ✅ ; attendre 17 h 20 / 17 h 30 du jour | Messages réels à Antoine uniquement. | — | — |

**Retour arrière A** : conserver le code et les scripts T08 dans le checkout ; ne pas revenir globalement à fb9aedf, qui ferait disparaître ces scripts. Restaurer les copies privées vérifiées de `production.env` et `telegram.env`, puis recharger `common.sh` dans un nouveau processus afin de reprendre les anciennes valeurs d’image. Contrôler la configuration sans afficher les secrets, puis `dc up -d --no-deps --no-build --wait --wait-timeout 300 api web telegram`. Vérifier les images fb9aedf réellement utilisées et leur santé. Pas de restauration de base pour T05 seul : les courses déjà ajoutées restent. Ce repli a réussi lors de l’échec avant bascule du 3 octobre ; une annulation après usage de T05 n’a pas été éprouvée. Détails : `docs/TELEGRAM-RAPPELS.md`.
---

## B. T08 — sauvegarde chiffrée hors Nexus

### B0. Côté PC et panneau Contabo (Antoine, avant toute commande sur Nexus)

**État au 3 octobre :** clé age USB + copie papier préparées, compte dédié et stockage versionné en service ; ne pas les recréer. Sauvegardes réelles envoyées depuis Nexus. Archive de 08 h 30 récupérée par versions exactes, empreintes et déchiffrement intégral conformes ; GOVERNANCE 30 jours vérifié pour l’archive et son SHA-256. Restauration isolée API/Keycloak réalisée avec l’archive du 2 octobre. La sauvegarde post-T05 de 10 h 54 est envoyée mais n’a pas fait l’objet de ces essais de récupération/restauration.

1. **Clé privée age uniquement sur le PC/USB et papier ailleurs.** Relever la clé publique existante `age1…` pour Nexus. Quiconque détient la clé privée peut lire les archives ; sa perte les rend illisibles.
2. **Compartiment dédié**, distinct de la sauvegarde NAS, versionné avec rétention par défaut GOVERNANCE 30 jours. Une nouvelle écriture sous le même nom **peut réussir** : elle crée une nouvelle version. La protection porte sur les versions conservées. `If-None-Match: *` n'a pas empêché deux envois lors du test Contabo ; le script ne l'utilise plus.
3. **Utilisateur dédié en écriture seule, sans liste.** Une simple autorisation PutObject ne retire pas les droits hérités. Politique illustrative du modèle retenu (principal fictif ; adapter depuis la politique privée effectivement testée, sans écraser les règles d'autres utilisateurs) :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AutoriserEnvoi",
      "Effect": "Allow",
      "Principal": {"AWS": ["arn:aws:iam::EXEMPLE_TENANT:user/EXEMPLE_CLIENT:EXEMPLE_UTILISATEUR"]},
      "Action": "s3:PutObject",
      "Resource": "*"
    },
    {
      "Sid": "RefuserLectureSuppressionAdministration",
      "Effect": "Deny",
      "Principal": {"AWS": ["arn:aws:iam::EXEMPLE_TENANT:user/EXEMPLE_CLIENT:EXEMPLE_UTILISATEUR"]},
      "Action": [
        "s3:Get*", "s3:List*", "s3:Delete*", "s3:PutBucket*",
        "s3:PutObjectAcl", "s3:PutObjectVersionAcl",
        "s3:PutObjectTagging", "s3:PutObjectVersionTagging",
        "s3:PutObjectRetention", "s3:PutObjectLegalHold",
        "s3:BypassGovernanceRetention", "s3:PutLifecycleConfiguration",
        "s3:PutReplicationConfiguration", "s3:PutAccelerateConfiguration",
        "s3:PutPublicAccessBlock", "s3:CreateBucket", "s3:RestoreObject",
        "s3:AbortMultipartUpload"
      ],
      "Resource": "*"
    },
    {
      "Sid": "RefuserListeExplicite",
      "Effect": "Deny",
      "Principal": {"AWS": ["arn:aws:iam::EXEMPLE_TENANT:user/EXEMPLE_CLIENT:EXEMPLE_UTILISATEUR"]},
      "Action": ["s3:ListBucket", "s3:ListBucketVersions", "s3:ListBucketMultipartUploads"],
      "Resource": "*"
    }
  ]
}
```

Cette politique est attachée **au compartiment Maison**. Le refus de liste explicite déjà testé est conservé. Sur chaque autre compartiment accessible au compte, une règle distincte doit refuser `s3:*` à **ce seul principal** ; ne pas bloquer les autres utilisateurs ni modifier leurs objets. Ne pas revenir à la politique initiale fondée sur `NotAction` et `s3:if-none-match`, qui n'a pas donné les résultats attendus.

4. **Qualification et limites observées sur PC** :
   - Envoi avec le compte dédié réussi ; lecture, suppression simple, suppression d'une version avec demande de bypass GOVERNANCE et réécriture à l'identique de la politique refusées (`AccessDenied`). Les autres droits administratifs ne sont pas tous testés individuellement.
   - Liste Maison refusée avant le remplacement des autres règles, refus explicite conservé ensuite ; refaire ce contrôle avec la politique finale. Liste du compartiment NAS refusée ; aucun objet NAS manipulé ni sauvegarde NAS retestée.
   - Rétention 30 jours constatée sur les versions administrateur et dédiée ; suppression administrateur sans bypass refusée ; première version du fichier technique restaurée après les écritures suivantes, SHA-256 conforme.
   - **Preuves et suites** : image CLI épinglée qualifiée par plusieurs envois, archive représentative récupérée et déchiffrée ; le déchiffrement USB puis papier est consigné pour le 2 octobre ; la 2FA du panneau Contabo a été confirmée par Antoine le 2 octobre à 09 h 56 pour une connexion en navigation privée. Reprise complète sur autre machine à éprouver. Inventaire des versions réalisé ; capacité/coût non bloquants selon Antoine. La rétention n'empêche pas un compte d'envoi compromis d'ajouter des données.
5. **Clé d'administration/rotation uniquement sur le PC**, jamais sur Nexus ni dans le dépôt. GOVERNANCE peut être contourné par un administrateur disposant du droit de bypass ; le compte d'envoi doit rester privé de ce droit.

**Repli si les prérequis ne sont pas réunis** : `backup-offsite.sh --no-upload` crée l'archive et son `.sha256` localement. Le PC les tire par SSH (compte à clé limité en lecture à `outbox`) ; aucun identifiant externe requis sur Nexus. Cette option ne crée aucun reçu S3 et ne met pas à jour `last-offsite-success` ; elle nécessite un suivi adapté et son RPO dépend du PC allumé.

### B1. Configuration privée sur Nexus

| Commande | Sécurité | Sauvegarde | Retour arrière |
|---|---|---|---|
| Créer `.private/nexus/offsite.env` (600) : `OFFSITE_AGE_RECIPIENT=age1…` (clé **publique**), `OFFSITE_WORKDIR=/<chemin hors dépôt>/maison-offsite`, `OFFSITE_BUCKET=maison-nexus-backup`, `OFFSITE_ENDPOINT=https://<région>.contabostorage.com`, `OFFSITE_PREFIX=nexus-maison`, `OFFSITE_AWS_IMAGE=amazon/aws-cli@sha256:<digest relevé>`, `OFFSITE_CHECK=none`, `OFFSITE_IF_NONE_MATCH=false`, `OFFSITE_KEEP_LOCAL=3`, `OFFSITE_KEEP_ARCHIVES=7` | Clé publique seulement : Nexus peut chiffrer, jamais déchiffrer. | — | Supprimer le fichier. |
| Créer `.private/nexus/offsite-s3.env` (600) : `AWS_ACCESS_KEY_ID=…`, `AWS_SECRET_ACCESS_KEY=…`, `AWS_DEFAULT_REGION=default` | Identifiants de l’utilisateur **dédié écriture seule** ; lisibles par root sur Nexus et visibles par `docker inspect` le temps de l’envoi. | — | Révoquer la clé dans Contabo. |
| `docker pull amazon/aws-cli:<version>` puis `docker image inspect --format '{{index .RepoDigests 0}}' amazon/aws-cli:<version>` | Image officielle épinglée par digest ; à vérifier sur place (version acceptant `--content-md5` ; relever sa version et qualifier son envoi réel). | — | `docker image rm`. |

Prérequis locaux : Bash, Docker, age, tar, sha256sum et **OpenSSL**. Pour chaque PutObject, le script fournit un Content-MD5 calculé sur les octets envoyés (archive **et** fichier SHA-256), avec les checksums automatiques AWS réglés sur `when_required`. L’image CLI épinglée a réussi les envois réels du 3 octobre. Aucun multipart n'est implémenté : vérifier que la taille réelle reste compatible avec un PutObject simple.

Les anciens réglages `OFFSITE_CHECK=list` ou `OFFSITE_IF_NONE_MATCH=true` sont refusés avant l'export des bases. Les nombres de jeux conservés localement doivent être des entiers strictement positifs.

`backup.sh` n’inclut pas `offsite*.env` dans les sauvegardes : les identifiants S3 ne partent pas dans l’archive.

### B2. Premier envoi manuel

```bash
deploy/nexus/backup-offsite.sh
```

- **Sécurité** : arrêt bref (≈ 1 min) des services applicatifs Maison ; le clair reste dans `OFFSITE_WORKDIR/local` (700, 3 jeux) pour la reprise 4 h ; seule l’archive `age` sort.
- **Sauvegarde préalable** : c’est elle-même (A2 couvre la veille).
- **Retour arrière** : désactiver le minuteur si nécessaire ; conserver les versions distantes jusqu'à expiration de leur rétention. Ne pas demander de bypass pour nettoyer un essai.
- **À vérifier sur place** : message « Encrypted archive uploaded », reçu local `commandement-<…>.tar.age.versions.tsv` avec les deux VersionId, et `last-offsite-success` mis à jour. Depuis le PC administrateur, vérifier la rétention de **chacune** de ces versions et télécharger la paire exacte pour B3.

Le reçu contient deux colonnes (`key`, `version_id`) et deux lignes de données : archive puis SHA-256. Le succès hors site n'est enregistré qu'après deux réponses réussies comportant un VersionId exploitable. Cela confirme l'acceptation des fichiers, pas leur déchiffrement ni leur restauration. En cas d'échec, l'ancien marqueur reste intact, l'archive et le reçu `.versions.tsv.partial` restent sur Nexus pour diagnostic. Une réponse sans VersionId peut cacher un envoi accepté : examiner les versions depuis le PC, ne pas conclure à leur absence. Une nouvelle exécution génère un nouveau nom.

**Copier les reçus sur le PC après les envois**, avant leur suppression par la rotation locale (7 archives par défaut). Ils ne contiennent pas de clé privée, mais restent privés. Un reçu conservé uniquement sur Nexus ne survivrait pas à sa perte ; il localise les versions sans constituer une preuve indépendante contre une altération.

### B3. Test de la clé privée depuis le PC — condition de validité

La sauvegarde n'est **pas valide** tant que ce test n'a pas réussi avec une archive réelle. Utiliser le profil administrateur du PC. Choisir l'archive et son SHA-256 dans un reçu sauvegardé avant l'incident. À défaut, lister les versions avec `list-object-versions`, examiner les dates et identifier une paire saine ; **ne pas prendre automatiquement la dernière version après une compromission**.

Exemple **Bash** (à adapter pour PowerShell) : remplacer les valeurs d'exemple ; les deux VersionId sont différents.

```bash
export AWS_PAGER=""
endpoint='https://<region>.contabostorage.com'
bucket='maison-nexus-backup'
archive='commandement-<horodatage>-<suffixe>.tar.age'
archive_version='<VersionId de l archive>'
checksum_version='<VersionId du fichier sha256>'
aws --profile contabo-maison-admin --endpoint-url "$endpoint" s3api get-object-retention \
  --bucket "$bucket" --key "nexus-maison/$archive" --version-id "$archive_version"
aws --profile contabo-maison-admin --endpoint-url "$endpoint" s3api get-object-retention \
  --bucket "$bucket" --key "nexus-maison/$archive.sha256" --version-id "$checksum_version"
aws --profile contabo-maison-admin --endpoint-url "$endpoint" s3api get-object \
  --bucket "$bucket" --key "nexus-maison/$archive" --version-id "$archive_version" "$archive"
aws --profile contabo-maison-admin --endpoint-url "$endpoint" s3api get-object \
  --bucket "$bucket" --key "nexus-maison/$archive.sha256" --version-id "$checksum_version" "$archive.sha256"
sha256sum -c "$archive.sha256"
# Après empreinte conforme, vérifier le déchiffrement et le contenu :
set -o pipefail
age -d -i /media/<usb>/maison-backup.key "$archive" | tar -tvf -
```

Attendu : code 0, empreinte conforme, liste contenant notamment `courses.dump`, `identity.dump` et `SHA256SUMS`. Ne pas poursuivre si un téléchargement, la vérification ou le déchiffrement échoue. Le SHA-256 détecte une altération mais ne prouve pas seul qu'une archive est saine ; vérifier la période choisie et le contenu, puis réaliser B4. Refaire le déchiffrement avec la **copie papier** (ressaisie dans un fichier temporaire privé sur le PC, supprimé après) au moins une fois. Ne jamais transmettre la clé privée dans la conversation.

### B4. Répétition de restauration sur Nexus (sans toucher la production)

**Consigne du 2 octobre : la clé privée ne doit jamais parvenir à Nexus, même en mémoire.** L'ancien exemple SSH envoyant la clé sur stdin est retiré. Le mode historique du script reste compatible, mais ne doit pas être utilisé dans ce projet. Le PC déchiffre l'archive récupérée par VersionId, puis transmet uniquement le tar déchiffré dans le tunnel SSH.

Le script accepte désormais :

```bash
restore-service.sh --rehearse [--with-services] --decrypted-stdin \
  --tar-sha256 <SHA-256 du tar calculé sur le PC> commandement-<horodatage>-<suffixe>
```

Il exige l'empreinte du **tar déchiffré**, distincte de celle du `.tar.age`. Il reçoit intégralement le flux dans un dossier temporaire privé, vérifie son empreinte avant extraction ou Docker, refuse les chemins hors du dossier attendu ainsi que les liens/fichiers spéciaux, puis vérifie `SHA256SUMS`. Une coupure, y compris dans le remplissage final du tar, ne peut pas être acceptée sur la seule base des fichiers déjà reçus.

Exemple **Bash sur le PC**, après vérification de la paire chiffrée récupérée (chemins à adapter, jamais à copier sans vérification) :

```bash
(
  set -Eeuo pipefail
  umask 077
  work=$(mktemp -d)
  trap 'rm -rf -- "$work"' EXIT
  name='commandement-<horodatage>-<suffixe>'
  age -d -i /media/<usb>/maison-backup.key -o "$work/payload.tar" "/<recuperation>/$name.tar.age"
  digest=$(sha256sum "$work/payload.tar" | cut -d ' ' -f1)
  ssh nexus "bash /<scripts-verifies>/restore-service.sh --rehearse --decrypted-stdin --tar-sha256 $digest $name" < "$work/payload.tar"
)
```

**Windows PowerShell : ne pas remplacer ce transfert par un pipeline texte ou une redirection binaire PowerShell 5.1.** Pour une petite archive, recevoir la sortie binaire age dans un `MemoryStream` .NET, attendre le code age 0, calculer le SHA-256 du flux puis le remettre à la position 0 avant transfert. Lire stderr en parallèle pour éviter un blocage. Transférer par `CopyTo` vers `ssh.StandardInput.BaseStream`, fermer ce flux binaire pour signaler la fin et contrôler le code SSH. Lire stdout/stderr SSH en parallèle, conserver les diagnostics localement et afficher seulement les résultats filtrés. Vider le tampon dans un `finally`. Ce parcours a été éprouvé le 2 octobre sur l'archive réelle avec la répétition des deux bases.

Pour une archive trop volumineuse pour la mémoire du PC, déchiffrer avec `age --output` dans un dossier temporaire dont l'ACL exclut les autres utilisateurs, calculer `Get-FileHash`, puis transférer par un flux binaire .NET vers SSH et supprimer le clair dans un `finally`. Dans les deux parcours, vérifier séparément les codes age et SSH. Aucune clé privée ne doit figurer dans la commande SSH, un fichier Nexus ou le flux tar.

Préparation temporaire avant installation : copier uniquement le script corrigé et `rehearsal.yml` depuis un commit exact de PR 10 dans un dossier privé séparé, vérifier leurs empreintes et la syntaxe Bash. Ne pas changer le checkout en production. Vérifier les images et la révision API réellement présentes avant `--with-services` : `RELEASE` de `production.env` peut être remplacée par les overlays Google/Telegram dans le service actif ; ne pas considérer le test probant s'il utilise une autre image sans l'avoir relevé.

La répétition applique maintenant le même ordre que `common.sh` : `RELEASE`, puis `GOOGLE_RELEASE` si `google-calendar.env` existe, puis `TELEGRAM_RELEASE` si `telegram.env` existe. Elle affiche l'image API retenue ; une référence invalide provoque un arrêt avant Docker. Seule la référence est lue dans les overlays : aucune variable d'intégration ni aucun jeton Google/Telegram n'est importé. Le mode `--with-services` attend les états de santé de Keycloak et de l'API avant les sondes finales. Vérifier la mémoire disponible et les images locales avant de créer les conteneurs temporaires.

La mémoire des seuls conteneurs de répétition est plafonnée : 2 Gio pour Keycloak, 512 Mio pour chacun des deux PostgreSQL et pour l'API, soit 3,5 Gio de plafonds cumulés. `memswap_limit` égale `mem_limit` pour ne pas autoriser de swap supplémentaire à ces conteneurs. Keycloak calcule sa mémoire Java en proportion de celle du conteneur : une limite explicite évite qu'il se dimensionne sur toute la mémoire de Nexus ([documentation Keycloak](https://www.keycloak.org/server/containers), [limites Compose](https://docs.docker.com/reference/compose-file/services/#memswap_limit)). Ces réglages ne changent pas la production et ne constituent pas un test de charge. Vérifier la marge mémoire actuelle avant le démarrage ; si une limite provoque un échec, examiner le diagnostic avant de l'augmenter.

- **Sécurité** : projet Compose isolé, aucun port, réseau proxy, label Traefik, volume/fichier de production monté. Réseau interne sans sortie ; web, Telegram et Alexa ne sont jamais démarrés. Données déchiffrées et tar transitoire dans un dossier 700, supprimé à la sortie, en cas d'erreur ou d'interruption prise en charge. Projet et volumes de répétition supprimés ; nom avec suffixe aléatoire pour éviter les collisions.
- **Sauvegarde préalable** : aucune nécessaire pour ce test isolé ; la production est intacte.
- **Retour arrière** : le script nettoie ses ressources. En cas de SIGKILL ou coupure de machine, relever le projet exact avant de supprimer uniquement ce projet et ses volumes, puis son dossier temporaire ; jamais de purge Docker globale. Le clair sur PC doit aussi être retiré.
- **Attendu** : `complete stream SHA-256 verified`, `Archive contents and SHA256SUMS verified`, `counts match`, puis avec `--with-services` : `api /ready 200` et Keycloak prêt.

### B5. Restauration de production — **manuelle uniquement**

`--production` n’est **jamais** appelé par `monitor.sh` ni par un minuteur. Uniquement à la main, après décision d’Antoine :

```bash
# Sur Nexus : checkout exact préalablement vérifié, sauvegarde et accord explicite.
# Sur le PC : tar déchiffré dans un dossier privé et empreinte vérifiés comme en B4.
ssh nexus 'bash /<racine>/deploy/nexus/restore-service.sh --production --confirm commandement-<…> --pre-backup /<sauvegardes>/avant-restauration-<date> --decrypted-stdin --tar-sha256 <SHA-du-tar> commandement-<…>' < /<prive-PC>/payload.tar
```

- **Sécurité** : écrase les deux bases de production ; refuse sans `--confirm <nom exact de l’archive>` et si le code en place diffère de celui de la sauvegarde. `--restore-private` réinstalle aussi les fichiers privés (nouvelle machine).
- **Sauvegarde préalable obligatoire** : `backup.sh` vers `--pre-backup` avant toute écriture ; le script s’arrête si elle échoue.
- **Retour arrière** : restaurer le jeu `--pre-backup` (non chiffré, local) avec la même méthode, ou `restore-check.sh` pour l’inspecter d’abord. Les services restent arrêtés si les comptes diffèrent.
- **Reprise sur une autre machine (24 h)** : Docker + Compose, clone du dépôt au SHA de l’archive, `--restore-private`, construction des images, réseau Traefik équivalent, puis bascule de l’enregistrement DNS Cloudflare `famille.estarellas.online` vers la nouvelle adresse (Antoine). Procédure détaillée à écrire dans `docs/EXPLOITATION.md` (non fait).

### B6. Minuteurs systemd (sauvegarde 3 h 30 Paris, hors 7 h, 9 h et 17 h 15–17 h 30)

Installé et testé le 3 octobre : service exécuté manuellement avec succès, timer enabled/active/waiting ; premier déclenchement automatique attendu le 4 octobre. Exemple de structure ci-dessous : les fichiers service et timer sont distincts ; utiliser le compte du dépôt ayant accès à Docker, UMask=0077 et l’unité réellement vérifiée sur Nexus.

`/etc/systemd/system/maison-backup-offsite.service` + `.timer` :

```ini
[Service]
Type=oneshot
WorkingDirectory=<racine>
ExecStart=<racine>/deploy/nexus/backup-offsite.sh
[Timer]
OnCalendar=*-*-* 03:30:00 Europe/Paris
Persistent=true
[Install]
WantedBy=timers.target
```

- **Sécurité** : compte du dépôt disposant de l’accès Docker ; aucune exposition. **Retour arrière** : `systemctl disable --now maison-backup-offsite.timer`. **À vérifier sur place** : fuseau et `systemctl list-timers`.

### B7. Rotation distante depuis le PC (clé de rotation)

**Décision du 3 octobre : conserver les versions distantes sans purge automatique.** Antoine confirme que capacité et coût disposent d’une marge suffisante. Rotation locale maintenue à 3 jeux en clair et 7 archives chiffrées. Les 30 jours de verrouillage ne sont pas une suppression automatique. Toutes les versions, même non courantes, consomment du quota ; un nouvel envoi ne remplace pas leur stockage.

Aucune purge distante automatique n'est installée. Depuis le PC, inventorier les versions (`list-object-versions`), rapprocher archives et SHA-256 avec les reçus conservés, puis contrôler la rétention de chaque version envisagée. Faire approuver la sélection avant suppression. Ne supprimer que les versions expirées et devenues inutiles, avec leur **VersionId explicite** (`delete-object --version-id …`), sans bypass GOVERNANCE. Une suppression sans VersionId peut seulement ajouter un marqueur de suppression et ne constitue pas une purge des anciennes versions. Conserver les paires nécessaires aux restaurations et tester leur lecture avant toute rotation. Jamais de clé de rotation sur Nexus.

---

## C. Alerte Maison (`monitor.sh`)

Installée le 3 octobre : panne et rétablissement réellement reçus à 09 h 27, puis exécutions automatiques confirmées jusqu’à 10 h 50. Ce contrôle n’a pas déclenché de message répété à l’état sain.

Contrôle toutes les 5 minutes des seuls conteneurs Maison (postgres, keycloak-db, keycloak, api, web, + alexa/telegram si actifs) et de la fraîcheur de la dernière sauvegarde hors site (> 26 h). Alerte Telegram au seul compte `TELEGRAM_ALERT_USER` (conversation liée dans Maison, mise en cache), **uniquement** au changement (panne, rétablissement), après deux passages identiques (anti-rebond) ; silence pendant la fenêtre de sauvegarde (≤ 45 min). Ne vérifie pas la joignabilité de Nexus (la couverture indépendante existante n’a pas été éprouvée dans cette session) ; ne touche ni Léo ni ses sondes ; ne restaure jamais rien.

| Commande | Sécurité | Retour arrière |
|---|---|---|
| Prérequis : A5 fait (`TELEGRAM_ALERT_USER`), liaison Telegram d’Antoine active, `curl` présent (à vérifier sur place). | Jeton lu dans `.private/nexus/telegram-token`, passé à curl par l’entrée standard (absent de la liste des processus). | — |
| `deploy/nexus/monitor.sh; echo $?` deux fois | Lecture Docker + un message au plus. | — |
| Service/timer `maison-monitor` : `ExecStart=<racine>/deploy/nexus/monitor.sh`, `OnCalendar=*:0/5` | Compte du dépôt, accès Docker, UMask=0077. | `systemctl disable --now maison-monitor.timer` ; état dans `.private/nexus/monitor/`. |
| Essai : `dc stop web` puis attendre 10 min → une alerte « panne » ; `dc start web` → une alerte « rétabli » | Coupure volontaire du portail ≈ 10 min : choisir un créneau calme. | `dc start web`. |

---

## Historique — preuves obtenues dans la session cloud du 29/09 (Docker local, données fictives)

- Pile fictive (PostgreSQL 16 épinglé par digest, deux bases avec tables fictives : 1 foyer, 2 membres, 42 articles, 97 historiques, 13 demandes ; 2 realms, 3 utilisateurs, 2 identifiants).
- `backup-offsite.sh --no-upload` : `backup.sh` réel, archive `commandement-20260929T223725Z-de11d3c2.tar.age` + `.sha256`, aucun mot de passe fictif lisible dans l’archive.
- `restore-service.sh --rehearse` (clé sur l’entrée standard) : déchiffrement, `SHA256SUMS` vérifiés, restauration des deux bases dans un projet isolé, comptes identiques (`1|2|42|97|13`, `2|3|2`), aucun reste (dossier déchiffré, conteneur, volume).
- Refus vérifiés, sans reste déchiffré : archive altérée (empreinte), archive altérée sans empreinte (age refuse), mauvaise clé, interruption SIGTERM en cours (dossier présent pendant, supprimé après), `--production` sans `--confirm`, absence de clé.
- `rehearsal.yml --profile services` : configuration effective sans port, Traefik, réseau externe, montage, ni variable Google/Telegram ; réseau `internal: true`.
- `monitor.sh` avec `curl` simulé (aucun appel externe) : panne signalée au 2e passage seulement, aucune répétition, silence en maintenance, rétablissement signalé, chat retrouvé en cache base arrêtée.
- **Non vérifié** : envoi S3 réel vers Contabo, `If-None-Match` chez Contabo, `--with-services` (images API/Keycloak absentes de la session), `--production`, minuteurs systemd, réception Telegram réelle de l’alerte.


## Historique — qualification complémentaire du 2 octobre 2026

Les observations Contabo sur PC sont détaillées en B0 et dans `docs/PROJECT-STATE.md` : protection et restauration d'une version d'un fichier technique confirmées, pas encore d'archive réelle envoyée depuis Nexus.

Les tests automatisés `deploy/nexus/test/backup-offsite.test.mjs` exécutent le vrai script Bash, tar et OpenSSL ; export des bases, age et Docker/S3 sont simulés. Ils vérifient les Content-MD5 des deux fichiers, les reçus de versions, le SHA-256 de l'archive envoyée, les échecs d'envoi/checksum/chiffrement/réponse sans version, le refus des anciennes options, `--no-upload` et la rotation locale sans suppression distante. Ils ne remplacent ni l'intégration avec l'image CLI retenue ni B3/B4.


## Historique — qualification réelle du 2 octobre — PC et Nexus, avant installation

Antoine a exécuté une sauvegarde réelle avec le script déjà installé à fb9aedf, puis le chiffrement age 1.3.2 avec la clé publique existante, dans une préparation temporaire séparée. Après l'arrêt cohérent/reprise, les sept services Maison étaient sains. Archive récupérée sur le PC via SCP historique (`scp -O`, sous-système SFTP indisponible dans l'essai) et empreinte conforme.

Deux PutObject réels (archive et SHA-256), Content-MD5 pour chacun, avec le compte dédié et l'image officielle AWS CLI 2.37.8 : `amazon/aws-cli@sha256:420ab345e847291b541b45d989535f55bcff957c27fa1100fae4aa233e86398c`. VersionId conservés dans un reçu sur PC. Rétention GOVERNANCE 30 jours constatée sur chacune ; récupération par versions exactes, empreinte conforme au SHA-256 récupéré et à celle relevée avant envoi. Déchiffrement complet avec l'USB puis indépendamment avec la clé ressaisie depuis le papier : codes age 0, sortie vers NUL, aucune copie en clair conservée sur PC par ces deux tests. Liste Maison refusée avec la politique finale (AccessDenied).

À 04 h 08 Paris, les deux bases issues de cette archive récupérée ont été restaurées réellement sur Nexus avec les seuls scripts de répétition de `cefb430`, dans un dossier séparé du checkout de production. Déchiffrement sur PC vers un tampon .NET, SHA-256 du tar calculé et revérifié, transfert SSH binaire ; flux complet et manifeste conformes côté Nexus, comptages des deux bases identiques à la sauvegarde, code SSH 0. Nettoyage annoncé par le script sans erreur ; tampon PC vidé. La répétition sans `--with-services` n'a pas démarré l'API ni Keycloak : ce contrôle reste à réaliser, ainsi que la vérification indépendante du nettoyage et de la santé de production.

Ces résultats sont issus des sorties communiquées par l'utilisateur. Ils qualifient l'envoi manuel avec l'image épinglée, les déchiffrements, le transport Windows et la restauration des deux bases, **pas encore l'exécution de backup-offsite.sh sur Nexus ni le démarrage des services restaurés**. B4 complet, coût/quota, rotation, 2FA effective, installation, minuteurs et alertes restent ouverts. Versions, comptages et preuves privées : carte T08 Notion.
