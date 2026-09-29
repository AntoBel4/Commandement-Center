# Déploiement sur Nexus — PR 10 (T05) puis T08 (sauvegarde chiffrée, restauration, alerte)

Rédigé le 29 septembre 2026, en session cloud **sans accès à Nexus**. Rien de ce document n’a été exécuté sur Nexus. Chaque commande indique son **implication de sécurité**, sa **sauvegarde préalable** et son **retour arrière**. « À vérifier sur place » : l’état réel de Nexus prime sur ce document. Périmètre : `famille.estarellas.online` uniquement. Aucun port publié, aucune modification de Traefik global, Nextcloud, Léo ni de ses sondes.

Décisions d’Antoine (29/09) : **D2** perte maximale 24 h (sauvegarde nocturne), reprise 4 h sur Nexus, 24 h sur une autre machine. **D3** archive chiffrée avec age, clé publique seule sur Nexus, envoi vers un compartiment dédié du stockage objet S3 Contabo existant, clé d’accès limitée à ce compartiment **en écriture seule, sans suppression** ; rotation distante depuis le PC d’Antoine (clé de rotation uniquement sur le PC) ; clé privée sur clé USB chez Antoine + copie papier ailleurs, jamais sur Nexus ni dans un coffre hébergé sur Nexus.

Conventions : commandes lancées depuis la racine du clone Maison sur Nexus (chemin : à vérifier sur place), avec la fonction `dc` de `deploy/nexus/common.sh` :

```bash
cd <racine du clone Maison>            # à vérifier sur place
source deploy/nexus/common.sh           # définit dc() ; umask 077
```

Durée estimée totale : partie A ≈ 45 min, partie B ≈ 1 h 15 (dont 30 min côté panneau Contabo et PC), partie C ≈ 20 min.

---

## A. Installer la PR 10 (T05 courses Telegram)

Révision à installer : tête de la PR 10 au moment de l’installation, CI « test » verte (relever le SHA exact sur GitHub). Révision de retour arrière : `fb9aedf92f270affda33ebc97dc75309d0cd3063`.

| # | Commande | Sécurité | Sauvegarde préalable | Retour arrière |
|---|---|---|---|---|
| A1 | `git rev-parse HEAD ; dc ps ; dc images` — **à vérifier sur place** : HEAD = fb9aedf, sept services sains, overlays Google et Telegram actifs ; sinon s’arrêter | Lecture seule. | — | — |
| A2 | `deploy/nexus/backup.sh /<dossier sauvegardes>/avant-pr10-$(date +%F)` puis `deploy/nexus/restore-check.sh <ce dossier> <POSTGRES_IMAGE épinglée>` | Arrêt bref des services applicatifs Maison ; dossier 700 contenant des secrets. | C’est la sauvegarde. | Les services redémarrent seuls ; sinon `dc up -d --no-build`. |
| A3 | `cp -p .private/nexus/telegram.env .private/nexus/telegram.env.fb9aedf` et `docker image tag commandement-api:fb9aedf… commandement-api:rollback-fb9aedf` (idem web) | Copie privée 600. | — | Sert au retour arrière. |
| A4 | `git fetch origin claude/eager-galileo-ezltlj && git checkout --detach <SHA PR 10>` | Code seulement ; aucun secret dans le dépôt. | A2 | `git checkout --detach fb9aedf…` |
| A5 | Éditer `.private/nexus/telegram.env` : `TELEGRAM_RELEASE=<SHA PR 10>` et **ajouter** `TELEGRAM_ALERT_USER=<UUID du compte Maison d’Antoine>` (UUID relevé dans Keycloak, pas un identifiant Telegram) | Fichier privé 600, jamais publié. | A3 | Recopier `telegram.env.fb9aedf`. |
| A6 | `dc config --quiet && dc build api web` | `config` sans `--quiet` affiche des secrets : ne pas l’utiliser. | — | Images fb9aedf conservées (A3). |
| A7 | `dc run --rm migrate` (aucune migration nouvelle en T05, contrôle de cohérence) puis `dc up -d --no-build --wait --wait-timeout 300 api web telegram` | Aucun port, aucun webhook ; polling sortant. | A2 | Voir « Retour arrière A ». |
| A8 | `dc ps` ; `curl -fsS https://famille.estarellas.online/` (200) ; routes privées anonymes 401 | Lecture seule. | — | — |
| A9 | Antoine : dans Maison, vérifier la liaison Telegram, ajouter « test pr10 » par Telegram, cliquer ✅ ; attendre 17 h 20 / 17 h 30 du jour | Messages réels à Antoine uniquement. | — | — |

**Retour arrière A** (≈ 10 min) : `git checkout --detach fb9aedf…` ; `cp .private/nexus/telegram.env.fb9aedf .private/nexus/telegram.env` ; `dc up -d --no-build --wait api web telegram` (images fb9aedf). Pas de restauration de base : T05 n’a pas de migration ; les courses ajoutées par Telegram restent. Détails : `docs/TELEGRAM-RAPPELS.md`, section Installation.

---

## B. T08 — sauvegarde chiffrée hors Nexus

### B0. Côté PC et panneau Contabo (Antoine, avant toute commande sur Nexus)

1. **Paire de clés age, sur le PC** (pas sur Nexus) : `age-keygen -o /media/<usb>/maison-backup.key` ; relever la ligne `# public key: age1…`. Imprimer la ligne `AGE-SECRET-KEY-1…` pour la copie papier rangée ailleurs. **Implication** : quiconque détient ce fichier lit toutes les sauvegardes (qui contiennent les secrets Google, Telegram et Keycloak) ; sa perte rend les archives illisibles.
2. **Compartiment dédié** dans l’offre S3 Contabo existante (nom d’exemple : `maison-nexus-backup`), distinct de la sauvegarde hors site existante.
3. **Utilisateur dédié** avec ses propres identifiants S3, limité par politique de compartiment. Exemple (valeurs fictives ; ARN au format documenté par Contabo `arn:aws:iam::<s3TenantId>:user/<customerId>:<userId>`) :

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "NexusWriteOnly",
    "Effect": "Allow",
    "Principal": {"AWS": ["arn:aws:iam::EXEMPLE_TENANT:user/EXEMPLE_CLIENT:EXEMPLE_UTILISATEUR"]},
    "Action": ["s3:PutObject"],
    "Resource": ["arn:aws:s3:::maison-nexus-backup/nexus-maison/*"]
  }]
}
```

   Optionnel : ajouter `s3:ListBucket` sur `arn:aws:s3:::maison-nexus-backup` (avec condition de préfixe) pour que le script **vérifie qu’un objet du même nom n’existe pas** (`OFFSITE_CHECK=list`). Sans ce droit, une clé en écriture seule **ne peut pas** vérifier l’existence : la protection repose alors sur des noms uniques (horodatage UTC + 32 bits aléatoires, jamais réutilisés) et sur l’en-tête `If-None-Match: *` (refus d’écraser) si Contabo le prend en charge — **non vérifié**.

4. **Vérifications sur le panneau Contabo — à cocher avant de considérer la sauvegarde valide** :
   - [ ] la politique limite l’utilisateur dédié au seul compartiment (il ne voit ni la sauvegarde existante ni d’autres compartiments) ;
   - [ ] l’utilisateur dédié n’a **aucun droit de suppression** : depuis le PC, avec la clé de Nexus, `aws s3api delete-object …` doit répondre AccessDenied ;
   - [ ] versionnage ou verrouillage d’objets (Object Lock) disponible ? Noter oui/non ; s’il est disponible sans coût, l’activer sur ce compartiment ;
   - [ ] écrasement refusé : second `put-object --if-none-match '*'` sur la même clé → refus attendu ; si Contabo ignore l’en-tête, mettre `OFFSITE_IF_NONE_MATCH=false` et le noter comme limite ;
   - [ ] **aucun coût supplémentaire** : le compartiment et l’utilisateur restent dans l’offre actuelle (quota consommé : archives de quelques Mo × 30).
5. **Clé de rotation** (droit de suppression) : clé principale ou second utilisateur, **uniquement sur le PC**, jamais sur Nexus ni dans le dépôt.

**Repli si l’une de ces conditions est impossible** : le PC tire l’archive chiffrée par SSH (`scp nexus:<OFFSITE_WORKDIR>/outbox/commandement-*.tar.age …`, compte SSH à clé, en lecture seule sur `outbox`). Nexus ne détient alors aucun identifiant externe ; le RPO dépend du PC allumé. Lancer `backup-offsite.sh --no-upload` sur Nexus.

### B1. Configuration privée sur Nexus

| Commande | Sécurité | Sauvegarde | Retour arrière |
|---|---|---|---|
| Créer `.private/nexus/offsite.env` (600) : `OFFSITE_AGE_RECIPIENT=age1…` (clé **publique**), `OFFSITE_WORKDIR=/<chemin hors dépôt>/maison-offsite`, `OFFSITE_BUCKET=maison-nexus-backup`, `OFFSITE_ENDPOINT=https://<région>.contabostorage.com`, `OFFSITE_PREFIX=nexus-maison`, `OFFSITE_AWS_IMAGE=amazon/aws-cli@sha256:<digest relevé>`, `OFFSITE_CHECK=none` (ou `list`), `OFFSITE_IF_NONE_MATCH=true`, `OFFSITE_KEEP_LOCAL=3`, `OFFSITE_KEEP_ARCHIVES=7` | Clé publique seulement : Nexus peut chiffrer, jamais déchiffrer. | — | Supprimer le fichier. |
| Créer `.private/nexus/offsite-s3.env` (600) : `AWS_ACCESS_KEY_ID=…`, `AWS_SECRET_ACCESS_KEY=…`, `AWS_DEFAULT_REGION=default` | Identifiants de l’utilisateur **dédié écriture seule** ; lisibles par root sur Nexus et visibles par `docker inspect` le temps de l’envoi. | — | Révoquer la clé dans Contabo. |
| `docker pull amazon/aws-cli:<version>` puis `docker image inspect --format '{{index .RepoDigests 0}}' amazon/aws-cli:<version>` | Image officielle épinglée par digest ; à vérifier sur place (version récente acceptant `--if-none-match`). | — | `docker image rm`. |

`backup.sh` n’inclut pas `offsite*.env` dans les sauvegardes : les identifiants S3 ne partent pas dans l’archive.

### B2. Premier envoi manuel

```bash
deploy/nexus/backup-offsite.sh
```

- **Sécurité** : arrêt bref (≈ 1 min) des services applicatifs Maison ; le clair reste dans `OFFSITE_WORKDIR/local` (700, 3 jeux) pour la reprise 4 h ; seule l’archive `age` sort.
- **Sauvegarde préalable** : c’est elle-même (A2 couvre la veille).
- **Retour arrière** : aucun effet sur les données ; supprimer l’objet depuis le PC avec la clé de rotation si besoin.
- **À vérifier sur place** : message « Encrypted archive uploaded », objet et `.sha256` visibles dans le compartiment, `last-offsite-success` mis à jour.

### B3. Test de la clé privée depuis le PC — condition de validité

La sauvegarde n’est **pas valide** tant que ce test n’a pas réussi :

```bash
# Sur le PC : télécharger l'archive et son empreinte avec la clé de rotation (PC uniquement)
sha256sum -c commandement-<…>.tar.age.sha256
age -d -i /media/<usb>/maison-backup.key commandement-<…>.tar.age | tar -tvf -   # liste courses.dump, identity.dump, SHA256SUMS…
```

Refaire ce test avec la **copie papier** (ressaisie dans un fichier temporaire du PC, supprimé après) au moins une fois.

### B4. Répétition de restauration sur Nexus (sans toucher la production)

La clé part du PC, traverse SSH et reste en mémoire sur Nexus :

```bash
ssh nexus 'cd <racine> && sudo deploy/nexus/restore-service.sh --rehearse /<OFFSITE_WORKDIR>/outbox/commandement-<…>.tar.age' < /media/<usb>/maison-backup.key
# puis, images API/Keycloak présentes : même commande avec --rehearse --with-services
```

- **Sécurité** : projet Compose `commandement-rehearsal-<horodatage>` défini par `deploy/nexus/rehearsal.yml` : aucun port, aucun réseau `proxy`, aucun label Traefik, aucun volume ni fichier de production monté, réseau interne sans sortie ; web, telegram et alexa jamais démarrés ; l’API n’a aucune variable Google ni Telegram (configuration effective affichée, mots de passe masqués). Données déchiffrées (secrets de production) dans un dossier temporaire 700, **supprimé à la sortie, en cas d’erreur ou d’interruption** ; projet et volumes de répétition supprimés.
- **Sauvegarde préalable** : aucune nécessaire (production intacte).
- **Retour arrière** : `docker compose -p commandement-rehearsal-<…> -f deploy/nexus/rehearsal.yml down -v` si une coupure brutale (SIGKILL) a empêché le nettoyage ; `ls /tmp/commandement-restore.*` doit être vide.
- **Attendu** : « Archive decrypted and SHA256SUMS verified », « counts match », et avec `--with-services` : `api /ready 200` et Keycloak prêt.

### B5. Restauration de production — **manuelle uniquement**

`--production` n’est **jamais** appelé par `monitor.sh` ni par un minuteur. Uniquement à la main, après décision d’Antoine :

```bash
git checkout --detach <SHA de source-commit.txt de l'archive>
ssh nexus 'cd <racine> && sudo deploy/nexus/restore-service.sh --production --confirm commandement-<…> --pre-backup /<sauvegardes>/avant-restauration-$(date +%F-%H%M) /<…>/commandement-<…>.tar.age' < /media/<usb>/maison-backup.key
```

- **Sécurité** : écrase les deux bases de production ; refuse sans `--confirm <nom exact de l’archive>` et si le code en place diffère de celui de la sauvegarde. `--restore-private` réinstalle aussi les fichiers privés (nouvelle machine).
- **Sauvegarde préalable obligatoire** : `backup.sh` vers `--pre-backup` avant toute écriture ; le script s’arrête si elle échoue.
- **Retour arrière** : restaurer le jeu `--pre-backup` (non chiffré, local) avec la même méthode, ou `restore-check.sh` pour l’inspecter d’abord. Les services restent arrêtés si les comptes diffèrent.
- **Reprise sur une autre machine (24 h)** : Docker + Compose, clone du dépôt au SHA de l’archive, `--restore-private`, construction des images, réseau Traefik équivalent, puis bascule de l’enregistrement DNS Cloudflare `famille.estarellas.online` vers la nouvelle adresse (Antoine). Procédure détaillée à écrire dans `docs/EXPLOITATION.md` (non fait).

### B6. Minuteurs systemd (sauvegarde 3 h 30 Paris, hors 7 h, 9 h et 17 h 15–17 h 30)

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

- **Sécurité** : root (accès Docker) ; aucune exposition. **Retour arrière** : `systemctl disable --now maison-backup-offsite.timer`. **À vérifier sur place** : fuseau et `systemctl list-timers`.

### B7. Rotation distante depuis le PC (clé de rotation)

Mensuelle, depuis le PC : lister `nexus-maison/`, conserver au moins les 30 dernières nuits et une archive par mois sur 6 mois, supprimer le reste (`aws s3api delete-object`). Jamais depuis Nexus.

---

## C. Alerte Maison (`monitor.sh`)

Contrôle toutes les 5 minutes des seuls conteneurs Maison (postgres, keycloak-db, keycloak, api, web, + alexa/telegram si actifs) et de la fraîcheur de la dernière sauvegarde hors site (> 26 h). Alerte Telegram au seul compte `TELEGRAM_ALERT_USER` (conversation liée dans Maison, mise en cache), **uniquement** au changement (panne, rétablissement), après deux passages identiques (anti-rebond) ; silence pendant la fenêtre de sauvegarde (≤ 45 min). Ne vérifie pas la joignabilité de Nexus (la sonde externe existante le fait) ; ne touche ni Léo ni ses sondes ; ne restaure jamais rien.

| Commande | Sécurité | Retour arrière |
|---|---|---|
| Prérequis : A5 fait (`TELEGRAM_ALERT_USER`), liaison Telegram d’Antoine active, `curl` présent (à vérifier sur place). | Jeton lu dans `.private/nexus/telegram-token`, passé à curl par l’entrée standard (absent de la liste des processus). | — |
| `deploy/nexus/monitor.sh; echo $?` deux fois | Lecture Docker + un message au plus. | — |
| Service/timer `maison-monitor` : `ExecStart=<racine>/deploy/nexus/monitor.sh`, `OnCalendar=*:0/5` | root (Docker). | `systemctl disable --now maison-monitor.timer` ; état dans `.private/nexus/monitor/`. |
| Essai : `dc stop web` puis attendre 10 min → une alerte « panne » ; `dc start web` → une alerte « rétabli » | Coupure volontaire du portail ≈ 10 min : choisir un créneau calme. | `dc start web`. |

---

## Preuves obtenues dans la session cloud du 29/09 (Docker local, données fictives)

- Pile fictive (PostgreSQL 16 épinglé par digest, deux bases avec tables fictives : 1 foyer, 2 membres, 42 articles, 97 historiques, 13 demandes ; 2 realms, 3 utilisateurs, 2 identifiants).
- `backup-offsite.sh --no-upload` : `backup.sh` réel, archive `commandement-20260929T223725Z-de11d3c2.tar.age` + `.sha256`, aucun mot de passe fictif lisible dans l’archive.
- `restore-service.sh --rehearse` (clé sur l’entrée standard) : déchiffrement, `SHA256SUMS` vérifiés, restauration des deux bases dans un projet isolé, comptes identiques (`1|2|42|97|13`, `2|3|2`), aucun reste (dossier déchiffré, conteneur, volume).
- Refus vérifiés, sans reste déchiffré : archive altérée (empreinte), archive altérée sans empreinte (age refuse), mauvaise clé, interruption SIGTERM en cours (dossier présent pendant, supprimé après), `--production` sans `--confirm`, absence de clé.
- `rehearsal.yml --profile services` : configuration effective sans port, Traefik, réseau externe, montage, ni variable Google/Telegram ; réseau `internal: true`.
- `monitor.sh` avec `curl` simulé (aucun appel externe) : panne signalée au 2e passage seulement, aucune répétition, silence en maintenance, rétablissement signalé, chat retrouvé en cache base arrêtée.
- **Non vérifié** : envoi S3 réel vers Contabo, `If-None-Match` chez Contabo, `--with-services` (images API/Keycloak absentes de la session), `--production`, minuteurs systemd, réception Telegram réelle de l’alerte.
