# Pokédex

Pokédex personnel de cartes Pokémon japonaises : pour chacun des 1 025 Pokémon, on ajoute la
carte que l'on veut (sa référence, d'où son image est retrouvée, et son id Cardmarket pour suivre
son prix) ; le Pokémon se débloque quand on la possède. React + Vite + TypeScript, interface
[`@camply/ui`](https://www.npmjs.com/package/@camply/ui), espèces [PokéAPI](https://pokeapi.co/),
cartes et images [Pokécardex](https://www.pokecardex.com/) (avec son autorisation), prix
[Cardmarket](https://www.cardmarket.com/).

```sh
bun install
bun dev          # serveur de dev Vite
bun run build    # type-check + build
bun lint         # ESLint
bun test         # tests : achats, prix, import, synchronisation, historique des prix
bun run format   # Prettier
```

- **Accueil** : un tableau de bord (progression, « À faire », valeur, budget du mois, liste
  d'achats, commandes, dernières cartes) ; trois étapes pour commencer quand la collection est vide.
- **Recherche** (Ctrl/⌘ K, ou le bouton de la barre) : un Pokémon par son nom ou son numéro, une
  page, une action.
- **Pokédex** : les 1 025 espèces, recherche (nom fr/en/ja ou numéro, raccourci `/`), filtres
  partageables dans l'adresse.
- **Fiche** : la carte du Pokémon, choisie parmi ses cartes japonaises (image, prix du jour, tri
  par date ou par prix) ou saisie à la main, puis corrigée ou retirée ; en grand, son statut
  (possédée / commandée / souhaitée) et son prix payé, son prix Cardmarket et sa courbe, le lien
  vers sa page Cardmarket, l'achat (dans la liste d'achats ou non, priorité, prix maximum, note), les détails
  de l'espèce.
- **Catalogue** : les cartes japonaises extension par extension ; un clic donne sa carte au
  premier Pokémon qui n'en a pas.
- **Ajouter depuis Cardmarket** : sur la page d'une carte chez Cardmarket, le favori « Ajouter au
  Pokédex » ouvre l'app avec son id, son nom et l'adresse de la page ; le Pokémon est reconnu
  d'après le nom et l'image retrouvée d'après le code de la carte (« SV2A 166 »), à vérifier ; il
  reste à valider.
- **Valeur** : prix Cardmarket du jour, valeur de la collection (et gain par rapport au prix
  payé), commandes, souhaits, coût pour compléter le Pokédex, courbes de prix au fil des jours.
- **Achats** : liste d'achats (les cartes acceptées, avec priorité et prix maximum),
  assistant « prochaine commande » dans un budget (100 € par mois, 150 € au plus, réglables),
  registre des commandes (Cardmarket, Myutsu, Hikaru…) qui met à jour les statuts, suivi du
  budget par mois et par fournisseur. Export CSV et recherches à coller dans Cardmarket.
- **Données** : le favori Cardmarket à installer (à glisser dans la barre de favoris, ou son code
  à copier), les images à chercher pour les cartes qui n'en ont pas, export / import (achats
  compris), effacement, et l'état des données du serveur (dernière lecture de chaque source, jour
  des prix, tâche en échec ou en retard).

Toutes les données passent par le serveur de l'app (`server/`, Elysia et une base SQLite) : le
navigateur ne parle qu'à lui. Des tâches d'ingestion lisent les sources et remplissent la base :
- `catalog`, chaque jour : le catalogue des cartes japonaises, d'après Pokécardex (avec son
  accord) : ses ≈ 450 séries japonaises depuis 1996, decks et promos compris, avec le numéro, le
  nom, les Pokémon et l'id Cardmarket de chaque carte (`/api/catalog`). Une page par série, une
  toutes les 3 s : le premier passage prend une vingtaine de minutes ;
- `prices`, toutes les 6 h : les prix d'après les fichiers publics de Cardmarket (le prix du jour
  de toutes ses cartes à l'unité, et l'historique de chacune ; `/api/prices`) ;
- `images`, chaque jour : les images copiées chez nous (`/images/…`) — cartes chez Pokécardex,
  qui demande qu'elles soient hébergées chez nous, avec un lien vers son site sur chaque page ;
  sprites et illustrations des Pokémon chez PokéAPI. Une image qui manque encore est copiée à la
  demande.

Les espèces (PokéAPI) viennent aussi du serveur (tâche `species`, chaque mois). Seule une
image à l'adresse collée se charge ailleurs ; pas celles de Cardmarket, qui ne s'affichent que sur
son site. Le favori ne fait que lire la page Cardmarket ouverte et l'envoyer à l'app d'où il a été
installé : installé depuis `bun dev`, il ouvre `localhost`.

En développement : `bun run dev:server` (l'API, sur le port 3000) à côté de `bun dev`, qui lui
renvoie `/api` et `/images` ; la base vit dans `.data/`. La remplir une fois :
`bun run ingest species`, `bun run ingest catalog`, puis `bun run ingest prices` (et `bun run ingest legacy-prices ./prices`
pour reprendre un ancien dossier `prices/`). Inutile de lancer `bun run ingest images` (1 Go) : le
serveur copie à la demande les images affichées. Pour la connexion, un fichier `.env.local` (ignoré
par git) :

```sh
BETTER_AUTH_URL=http://localhost:5173
BETTER_AUTH_SECRET=…        # openssl rand -base64 32
```

Au premier lancement, le site n'a pas de compte : toute page mène à `/bienvenue`, où vous créez le
vôtre, le seul, avec le code de première visite que `bun run dev:server` écrit dans son terminal
(il change à chaque démarrage du serveur). Pour changer le mot de passe ensuite :
`bun server/create-user.ts moi@exemple.fr` (demandé au clavier). La documentation de l'API
(Elysia, OpenAPI) est à `http://localhost:5173/api/docs`, en développement seulement.

Votre collection : sans connexion, elle reste dans le navigateur (`localStorage`), et l'export est
sa seule sauvegarde. Connecté (« Se connecter », en bas de la barre latérale, ou en haut à droite sur petit écran), elle est gardée sur le
serveur et vous suit d'un appareil à l'autre : un seul connecté à la fois (se connecter ailleurs
déconnecte le précédent, qui garde ses modifications). Personne d'autre ne peut créer de compte.

## Déploiement (VPS + tunnel Cloudflare)

L'image Docker construit le site avec Bun et le sert avec nginx (`deploy/nginx.conf` renvoie
`index.html` pour les adresses du routage côté client, `/api/` au serveur, et sert les images
copiées). `compose.yaml` l'expose sur `127.0.0.1:8080` (variable `POKEDEX_PORT`), joignable
seulement par le tunnel. À côté :
- le service `server` : l'API, et la copie à la demande d'une image qui manque encore ;
- le service `ingest` : il refait le catalogue des cartes chaque jour (le premier passage, série
  par série, prend une vingtaine de minutes ; la page Catalogue dit en attendant qu'il n'est pas
  disponible), regarde toutes les 6 h si Cardmarket a publié un nouveau guide des prix (il ne le
  télécharge qu'une fois par jour) et en garde l'historique
  dans une base SQLite (volume Docker `db`), puis copie chaque jour les images manquantes (volume
  `images` ; le premier passage, environ 1 Go, prend une heure ou plus, et le serveur copie en
  attendant celles qui s'affichent), et sauvegarde les deux bases chaque jour (volume `backups`).
  À son premier démarrage, il reprend de lui-même l'historique de l'ancien service `prices` (des
  fichiers, dans le volume `prices`), vérifié avant d'être gardé. L'ancien service est retiré :
  le déploiement l'arrête (`--remove-orphans`).

Ne jamais lancer `docker compose down -v`, qui effacerait ces volumes. Une fois sûr que
l'historique est repris (`docker compose logs ingest` : « Vérifié : … cartes »), l'ancien volume
peut partir : `docker volume rm pokedex_prices` (le nom exact : `docker volume ls`).

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
4. Créer votre compte, le seul : ouvrez le site, la première visite le demande, avec le code que
   le serveur écrit dans son journal tant qu'aucun compte n'existe (un visiteur arrivé avant vous
   ne peut donc pas le créer ; le code change à chaque redémarrage du serveur) :
   ```sh
   docker compose logs server | grep "première visite"
   ```
   Pour changer le mot de passe ensuite (demandé deux fois, sans s'afficher ; les sessions ouvertes
   se ferment) :
   ```sh
   docker compose run --rm server bun server/create-user.ts moi@exemple.fr
   ```

**Ensuite, à chaque déploiement** (`.github/workflows/deploy.yml`, lancé à la main depuis l'onglet
Actions tant que le domaine n'est pas prêt ; son en-tête dit comment le relancer à chaque push sur
`main`) : GitHub se connecte au VPS en SSH, fait `git pull` et reconstruit le conteneur. La construction lance d'abord `bun test` et
rafraîchit les images de base ; si elle échoue, test compris, l'ancienne version reste en ligne.
Secrets à créer dans le dépôt (Settings › Secrets and variables › Actions) :

| Secret | Valeur |
|---|---|
| `VPS_HOST` | adresse du VPS |
| `VPS_USER` | utilisateur SSH, membre du groupe `docker` |
| `VPS_SSH_KEY` | clé privée dédiée au déploiement (sa clé publique dans `~/.ssh/authorized_keys` du VPS) |
| `VPS_PATH` | dossier du clone, par exemple `/home/moi/pokedex` |
| `VPS_PORT` | port SSH, seulement s'il n'est pas 22 |
| `VPS_FINGERPRINT` | empreinte de la clé d'hôte du VPS, pour ne parler qu'à lui : la sortie de `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub \| cut -d ' ' -f2` (`SHA256:…`). Sans elle, l'hôte n'est pas vérifié |

Le port SSH doit être joignable depuis GitHub. S'il ne passe que par le tunnel (Cloudflare
Access), ce workflow ne peut pas s'y connecter : il faut alors un runner GitHub auto-hébergé sur
le VPS.

## Sauvegardes

Chaque jour, le service `ingest` copie les deux bases dans le volume `backups` :
`app-AAAA-MM-JJ.db` (votre compte et votre collection, 30 jours gardés) et
`data-AAAA-MM-JJ.db.gz` (catalogue, prix et leur historique, 7 jours gardés). Ce volume est sur le
même disque que les bases : copiez-le aussi ailleurs, par exemple chaque nuit avec `rclone` ou
`rsync` vers un autre serveur. Pour en sortir les fichiers (dans `./sauvegardes`) :

```sh
mkdir -p sauvegardes
docker compose run --rm --no-deps -v "$PWD/sauvegardes:/out" ingest sh -c 'cp /backups/* /out/'
```

Restaurer une base : arrêter le serveur et les tâches, remettre la copie à la place de la base
(décompressée pour `data.db`, avec `gunzip`), sans les fichiers `-wal` et `-shm` de l'ancienne,
puis redémarrer :

```sh
docker compose stop server ingest
docker compose run --rm --no-deps -v "$PWD/sauvegardes:/restore:ro" server sh -c 'rm -f /data/app.db-wal /data/app.db-shm && cp /restore/app-AAAA-MM-JJ.db /data/app.db'
docker compose up -d
```

Le serveur garde aussi, dans `app.db`, une version remplacée de la collection par heure pendant
30 jours (table `collection_versions`, compressée) : de quoi revenir en arrière après une erreur,
à la main.
