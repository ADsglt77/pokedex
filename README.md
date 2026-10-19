# Pokédex

Pokédex personnel de cartes Pokémon japonaises : pour chacun des 1 025 Pokémon, on ajoute la
carte que l'on veut (sa référence, d'où son image est retrouvée, et son id Cardmarket pour suivre
son prix) ; le Pokémon se débloque quand on la possède. React + Vite + TypeScript, interface
[`@camply/ui`](https://www.npmjs.com/package/@camply/ui) ; espèces, cartes, images et prix relus
par le serveur de l'app (plus bas).

```sh
bun install
bun dev          # serveur de dev Vite
bun run build    # type-check + build
bun lint         # ESLint, puis knip (code mort : exports, fichiers, dépendances)
bun test         # tests de ce qui coûterait de l'argent (la liste : CLAUDE.md, Principes)
bun run format   # Prettier
```

- **Accueil** : un tableau de bord (progression, « À faire », valeur, budget du mois, liste
  d'achats, commandes, dernières cartes) ; trois étapes pour commencer quand la collection est vide.
- **Recherche** (Ctrl/⌘ K, ou le bouton de la barre) : un Pokémon par son nom ou son numéro, une
  page, une action.
- **Pokédex** : les 1 025 espèces, recherche (nom fr/en/ja ou numéro, raccourci `/`), filtres
  partageables dans l'adresse.
- **Fiche** : la carte du Pokémon, choisie parmi ses cartes japonaises (image, rareté, prix du
  jour, tri par date ou par prix, filtres de rareté et de type) ou saisie à la main, puis corrigée ou retirée ; en grand, son statut
  (commandée / possédée) et son prix payé, son prix Cardmarket et sa courbe, le lien
  vers sa page Cardmarket, les détails de l'espèce.
- **Catalogue** : un grand catalogue de toutes les cartes japonaises, Pokémon, dresseurs et
  énergies, extension par extension (choisie sur son logo japonais), en tuiles serrées, avec une
  recherche et des filtres de rareté et de type ; chaque carte a sa fiche (image en grand, numéro,
  rareté, type, Pokémon, illustrateur, versions, noms anglais et allemand, prix Cardmarket et sa
  courbe) et, pour une carte Pokémon, « Ajouter à la collection » (à acheter ; si le Pokémon a
  déjà sa carte, elle la remplace après confirmation).
- **Valeur** : prix Cardmarket du jour, valeur de la collection (et gain par rapport au prix
  payé), commandes, dépensé en tout, coût pour compléter le Pokédex ; courbes jour par jour (valeur,
  Pokémon débloqués, dépenses) sur 7 jours, 30 jours, 1 an ou tout, avec leurs chiffres.
- **Achats** : liste d'achats (la carte de chaque Pokémon, ni possédée ni commandée),
  assistant « prochaine commande » dans un budget (100 € par mois, 150 € au plus, réglables),
  et « Copier pour Cardmarket » : ses cartes en lignes à coller dans votre liste de souhaits
  Cardmarket (« Ajouter une deck list »), chacune dans sa version exacte, avant son Shopping
  Wizard (langue et état se règlent ensuite par « Modification en masse » ; une carte dont la
  version ou l'extension n'est pas sûre s'ajoute depuis sa page ; le site n'envoie rien à
  Cardmarket) ; registre
  des commandes (Cardmarket, Myutsu, Hikaru…) qui met à jour les statuts, suivi du budget par mois
  et par fournisseur.
- **Comptes** : chacun crée le sien (`/inscription`), un pseudo et un mot de passe, sans e-mail
  (pas de mot de passe oublié) ; le pseudo, le mot de passe et la suppression du compte dans
  Données › Mon compte.
- **Pokédex public** : celui de chaque compte, à son adresse (`/@pseudo`, toujours public), en
  lecture seule : progression, régions, valeur au prix du jour, courbe et classeur. Jamais les prix
  payés, les commandes ni le budget. Le reste du site demande d'être connecté.
- **Thème** : sombre (gris foncé et jaune) ou clair (blanc pastel et rouge), au bouton de la
  barre ; sans choix, celui du système.
- **Données** : la collection et les images à chercher pour les cartes qui n'en ont pas, le compte
  (pseudo, mot de passe), l'adresse du Pokédex public, export / import (achats compris),
  effacement, et l'état des données du serveur (dernière lecture de chaque source, jour des prix,
  tâche en échec ou en retard).

Toutes les données passent par le serveur de l'app (`server/`, Elysia et une base SQLite) : le
navigateur ne parle qu'à lui. Des tâches d'ingestion lisent les sources et remplissent la base :
- `catalog`, chaque jour : le catalogue des cartes japonaises, d'après Pokécardex : ses ≈ 450
  séries japonaises depuis 1996, decks et promos compris, toutes leurs cartes (dresseurs et
  énergies comprises) avec le numéro, les noms, les Pokémon, l'id Cardmarket, la rareté, le type,
  l'illustrateur et les versions de chacune, et le bloc de chaque série (`/api/catalog/species/…`,
  `/api/catalog/sets`). Une page par série, une toutes les 3 s : le premier passage prend une
  vingtaine de minutes ;
- `prices`, toutes les 6 h : les prix d'après les fichiers publics de Cardmarket (le prix du jour
  de toutes ses cartes à l'unité, et l'historique de chacune ; l'app ne demande que ceux de ses
  cartes, `/api/prices/collection`, `/api/histories`),
  et l'extension de chaque carte, pour les lignes de la liste de souhaits (`/api/wants`) ;
- `images`, chaque jour : les images copiées chez nous (`/images/…`) — chez Pokécardex, les
  cartes, le logo japonais de chaque série et les icônes des types et des raretés, hébergés chez
  nous (jamais affichés depuis ses serveurs) ;
  sprites et illustrations des Pokémon chez PokéAPI. Une image qui manque encore est copiée à la
  demande.

Les espèces (PokéAPI) viennent aussi du serveur (tâche `species`, chaque mois ; une espèce sans
nom français ou anglais, ou d'un type inconnu, fait échouer la tâche : les espèces d'avant
restent, l'app ne plante pas sur une nouvelle génération pas encore traduite). Seule une
image à l'adresse collée se charge ailleurs ; pas celles de Cardmarket, qui ne s'affichent que sur
son site.

En développement : `bun run dev:server` (l'API, sur le port 3000) à côté de `bun dev`, qui lui
renvoie `/api` et `/images` ; la base vit dans `.data/`. La remplir une fois :
`bun run ingest species`, `bun run ingest catalog`, puis `bun run ingest prices`. Inutile de lancer `bun run ingest images` (1,5 Go) : le
serveur copie à la demande les images affichées. Pour la connexion, un fichier `.env.local` (ignoré
par git) :

```sh
BETTER_AUTH_URL=http://localhost:5173
BETTER_AUTH_SECRET=…        # openssl rand -base64 32
```

Un visiteur arrive sur la connexion ; `/inscription` crée un compte (pseudo, mot de passe). Pseudo
et mot de passe se changent ensuite dans Données › Mon compte, où le compte se supprime aussi. La
documentation de l'API (Elysia, OpenAPI) est à `http://localhost:5173/api/docs`, en développement
seulement.

Votre collection : le site ne s'ouvre que connecté ; elle est gardée sur le serveur et vous suit
d'un appareil à l'autre : un seul connecté à la fois (se connecter ailleurs déconnecte le
précédent, qui garde ses modifications).

## Déploiement (VPS + tunnel Cloudflare)

### La liste de mise en ligne

- [ ] **Avant tout** : exporter sa collection depuis le site actuel (Données › Exporter).
- [ ] Sur le VPS : Docker, `git` et le tunnel Cloudflare (`cloudflared`).
- [ ] Le clone en SSH, avec une clé de déploiement en lecture seule (étape 1 plus bas).
- [ ] Le fichier `.env` : l'adresse publique en https et la clé des sessions (étape 2).
- [ ] Les mentions légales : l'hébergeur (nom, adresse) et une adresse de contact publique, dans
      `src/config/legal.ts` (sans eux, la page `/mentions-legales` dit « à compléter »).
- [ ] `docker compose up -d --build`, puis le tunnel vers `http://localhost:8080` (étape 3).
- [ ] Votre compte (`/inscription`), puis l'import de l'export d'avant (Données › Importer) :
      connecté, la collection part sur le serveur.
- [ ] Les secrets GitHub du déploiement, `VPS_FINGERPRINT` compris (plus bas).
- [ ] Les sauvegardes copiées hors du VPS chaque nuit (section Sauvegardes).
- [ ] La surveillance : un service gratuit (UptimeRobot, Healthchecks…) qui demande
      `https://votre-domaine/api/health` toutes les 5 minutes et vous écrit s'il ne répond plus
      200 (voir plus bas).
- [ ] Sur téléphone, « Ajouter à l'écran d'accueil » : le site s'ouvre comme une application, même
      sans réseau (après une première ouverture en ligne) ; les modifications partent au retour du
      réseau.

**La surveillance** : `/api/health` répond 200 quand le serveur répond et que chaque tâche
nécessaire a réussi récemment (en deux intervalles au plus : les prix en 12 h, le catalogue et les
sauvegardes en 2 jours, les espèces en 60 jours), 503 sinon, avec la liste des tâches en retard.
Au tout premier démarrage, il répond 503 le temps des premières tâches (le catalogue prend une
vingtaine de minutes ; la sauvegarde suit les prix, sans attendre la copie des images).
Sans surveillance, un trou dans l'historique des prix passerait inaperçu : Cardmarket ne le garde
pas, un jour manqué l'est pour toujours.

**Le journal** : le serveur écrit une ligne par évènement, alignée, à l'heure de Paris : un symbole
de niveau en couleur (✔ réussi, • info, ▲ à surveiller, ✖ refusé), le thème, un message court et
ses détails en `clé=valeur` ; au démarrage, une Poké Ball en pixel art avec les adresses et le
compte (pas les requêtes une à une : seulement ce qui se passe). Sans couleurs
avec `NO_COLOR=1`. Il note les connexions
(réussies ou refusées, avec l'adresse du visiteur), création du compte, pseudo et mot de passe
changés, cartes ajoutées, possédées ou retirées, commandes enregistrées, reçues ou annulées, budget,
exports et imports, visites du Pokédex public, et les erreurs du serveur (avec leur cause). Pour le
suivre : `docker compose logs -f server` (en développement, le terminal de
`bun run dev:server`).

Les services (`pokedex` : le site, nginx, sur `127.0.0.1:8080`, joignable seulement par le
tunnel ; `server` : l'API ; `ingest` : les tâches d'ingestion et les sauvegardes) et leurs
volumes : `docs/deploiement.md`. Pour lancer une tâche à la main (par exemple relire tout le
catalogue), arrêtez d'abord le service `ingest`, qui la relancerait en même temps s'il redémarrait
pendant ce temps :

```sh
docker compose stop ingest
docker compose run --rm ingest bun server/ingest.ts catalog --refresh
docker compose start ingest
```

Ne jamais lancer `docker compose down -v`, qui effacerait les volumes (`db` : le compte, la
collection et l'historique des prix ; `backups` ; `images`).

**Une fois, sur le VPS**

1. Cloner le dépôt **en SSH**. Le dépôt est privé : ajouter au VPS une clé de
   déploiement en lecture seule, qui est une clé SSH. C'est la clé par défaut de l'utilisateur, ou
   celle déclarée pour `github.com` dans `~/.ssh/config`. Un clone HTTPS demanderait un jeton, et le
   `git pull` du déploiement automatique échouerait.
   ```sh
   git clone git@github.com:ADsglt77/pokedex.git
   cd pokedex
   ```
2. Créer, dans le clone, le fichier `.env` des secrets (ignoré par git ; sans lui, docker compose
   refuse de démarrer) : l'adresse publique du site, en https, et la clé qui signe les sessions.
   ```sh
   echo "BETTER_AUTH_URL=https://pokedex.ton-domaine.fr" > .env
   echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .env
   chmod 600 .env
   docker compose up -d --build
   ```
3. Publier le site par le tunnel : un nom d'hôte public (par exemple `pokedex.ton-domaine.fr`)
   vers `http://localhost:8080`. Dans le tableau de bord Zero Trust (Networks › Tunnels › le
   tunnel › Public hostname), ou dans le `config.yml` de cloudflared, avant la règle finale :
   ```yaml
   ingress:
     - hostname: pokedex.ton-domaine.fr
       service: http://localhost:8080
     - service: http_status:404
   ```
   Si cloudflared tourne lui-même dans Docker, mettre les deux conteneurs sur un même réseau et
   viser `http://pokedex:80`.
4. Créer votre compte : `/inscription` (pseudo, mot de passe), comme tout le monde. Gardez bien le
   mot de passe : le site n'envoie pas d'e-mail, il n'y a pas de « mot de passe oublié » ; il se
   change dans Données › Mon compte, en donnant l'actuel.

**Ensuite, à chaque déploiement** (`.github/workflows/deploy.yml`, lancé à la main depuis l'onglet
Actions tant que le domaine n'est pas prêt ; son en-tête dit comment le relancer à chaque push sur
`main`) : GitHub se connecte au VPS en SSH, fait `git pull` et reconstruit le conteneur. La
construction lance d'abord `bun test`, `bun lint` et `nginx -t`, et rafraîchit les images de base ;
si elle échoue, test compris, l'ancienne version reste en ligne. Une fois les conteneurs
redémarrés, le workflow vérifie que le site et son API répondent (en rouge sinon). Secrets à créer
dans le dépôt (Settings › Secrets and variables › Actions) :

| Secret | Valeur |
|---|---|
| `VPS_HOST` | adresse du VPS |
| `VPS_USER` | utilisateur SSH, membre du groupe `docker` |
| `VPS_SSH_KEY` | clé privée dédiée au déploiement (sa clé publique dans `~/.ssh/authorized_keys` du VPS) |
| `VPS_PATH` | dossier du clone, par exemple `/home/moi/pokedex` |
| `VPS_PORT` | port SSH, seulement s'il n'est pas 22 |
| `VPS_FINGERPRINT` | empreinte de la clé d'hôte du VPS, pour ne parler qu'à lui : la sortie de `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub \| cut -d ' ' -f2` (`SHA256:…`). Obligatoire : sans elle, le déploiement s'arrête |

Le port SSH doit être joignable depuis GitHub. S'il ne passe que par le tunnel (Cloudflare
Access), ce workflow ne peut pas s'y connecter : il faut alors un runner GitHub auto-hébergé sur
le VPS.

La clé de déploiement donne un shell à un membre du groupe `docker`, autant dire l'administration
du VPS : réservez-la au déploiement, dans `~/.ssh/authorized_keys`, en tête de sa ligne (la même
commande que le workflow, le dossier du clone à adapter) :
`restrict,command="cd /home/moi/pokedex && git pull --ff-only && sh deploy/deploy.sh"`, et
protégez le workflow par un « Environment » GitHub avec un relecteur obligatoire.

**Revenir à la version d'avant** (un déploiement en rouge, une erreur vue après coup) : les images
d'avant restent une semaine (`deploy/deploy.sh`), la reconstruction est donc rapide.

```sh
git log --oneline -5
git checkout <commit d'avant>
docker compose build && docker compose up -d
```

Puis, une fois `main` corrigé : `git checkout main` et un nouveau déploiement.

## Sauvegardes

Chaque jour, le service `ingest` copie les deux bases dans le volume `backups` :
`app-AAAA-MM-JJ.db` (votre compte et votre collection, 30 jours gardés) et
`data-AAAA-MM-JJ.db.gz` (catalogue, prix et leur historique, 7 jours gardés). Chaque copie est
vérifiée (`PRAGMA quick_check`) et écrite sous un nom provisoire (`tmp-…`) avant de prendre sa
place : une copie en cours n'est jamais prise pour une sauvegarde. Ce volume est sur le même
disque que les bases : copiez-le aussi ailleurs. Pour en sortir les fichiers (dans
`./sauvegardes`, que git ignore, vidé d'abord : il ne garde que ce qu'a le volume ; `--user root` :
les conteneurs tournent sans droits d'administrateur, ce dossier du VPS ne leur appartient pas) :

```sh
rm -rf sauvegardes && mkdir sauvegardes
docker compose run --rm --no-deps --user root -v "$PWD/sauvegardes:/out" ingest sh -c 'cp /backups/app-* /backups/data-* /out/'
```

Chaque nuit, hors du VPS, avec `rclone` (configuré une fois, `rclone config`, vers un stockage à
vous : Backblaze B2, Google Drive, un autre serveur…) : dans la crontab de l'utilisateur du
déploiement (`crontab -e`), ici à 4 h 30, le dossier du clone à adapter. La sauvegarde n'a pas
d'heure fixe (une par jour, à son rythme) : chaque copie emporte celles du volume, la plus récente
datant de moins d'un jour. Le stockage distant garde 90 jours (`rclone delete --min-age 90d`) :

```sh
30 4 * * * cd /home/moi/pokedex && rm -rf sauvegardes && mkdir sauvegardes && docker compose run --rm --no-deps --user root -v "$PWD/sauvegardes:/out" ingest sh -c 'cp /backups/app-* /backups/data-* /out/' && rclone copy sauvegardes distant:pokedex-sauvegardes && rclone delete --min-age 90d distant:pokedex-sauvegardes
```

**Restaurer une sauvegarde** : arrêter le serveur et les tâches, remettre la copie à la place de
la base, sans les fichiers `-wal` et `-shm` de l'ancienne, puis redémarrer. Le compte et la
collection (`app.db`) :

```sh
docker compose stop server ingest
docker compose run --rm --no-deps --user root -v "$PWD/sauvegardes:/restore:ro" server sh -c 'rm -f /data/app.db-wal /data/app.db-shm && cp /restore/app-AAAA-MM-JJ.db /data/app.db && chown bun:bun /data/app.db'
docker compose up -d
```

Les données de référence et l'historique des prix (`data.db`, compressée) :

```sh
docker compose stop server ingest
docker compose run --rm --no-deps --user root -v "$PWD/sauvegardes:/restore:ro" server sh -c 'rm -f /data/data.db-wal /data/data.db-shm && gunzip -c /restore/data-AAAA-MM-JJ.db.gz > /data/data.db && chown bun:bun /data/data.db'
docker compose up -d
```

Après une restauration d'`app.db`, les appareils le voient : chaque version de la collection porte
une empreinte tirée de son contenu (pas seulement son numéro, qui peut revenir), et un appareil qui
avait une version plus récente demande laquelle garder.

Le serveur garde aussi, dans `app.db`, une version remplacée de la collection par heure pendant
30 jours (table `collection_versions`, compressée) : de quoi revenir en arrière après une erreur,
à la main.
