# Déploiement

Le VPS, Docker, nginx, les services et les sauvegardes. Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

VPS publié directement par Caddy, à côté de l'API des données (le dépôt `pokedex-data`, ses propres
conteneurs, à installer d'abord : son README). Caddy écoute publiquement sur 80 et 443, gère le
certificat de `pokecodex.fr`, puis relaie vers `127.0.0.1:8080`. Le port du site reste donc local au
VPS. Les deux applications partagent un réseau Docker, `pokedex-net`, créé une fois à la main ;
l'API n'y publie aucun port : seuls le nginx et le serveur du site la joignent, à
`http://data-api:3001`, avec le token du site (`DATA_API_TOKEN`).

Qui fait quoi (le détail est dans l'en-tête de chaque fichier) :

| Fichier | Rôle |
|---|---|
| `Dockerfile` | Trois images, Bun et nginx figés sur leur version mineure : `build` (tests, ESLint, knip, puis `dist/` : un échec arrête le déploiement, l'ancien conteneur reste en ligne), `server` (Bun lance `server/` tel quel, avec `src/` et `tsconfig.json` pour l'alias `@/`, sans droits d'administrateur), `web` (nginx sert `dist/`). Seules les dépendances du serveur sont en `dependencies`, celles de l'app en `devDependencies` |
| `deploy/Caddyfile` | Le point d'entrée public : HTTPS automatique pour `pokecodex.fr`, redirection de `www` (avec le même HSTS que le site), puis relais vers le port local 8080, l'adresse du visiteur dans `x-forwarded-for` (la sienne seule : celle reçue du public est ignorée). Aucun journal des requêtes |
| `deploy/nginx.conf.template` | nginx : les routes du client (`index.html`), les données et `/images/` à l'API des données (sous `/v1`, avec le token, sans les cookies ; les images gardées sur son disque), le reste de `/api/` au serveur, les limites par visiteur (`x-forwarded-for`, posé par Caddy ; au-delà, 429 : les images, 20 par seconde et 1 100 d'un coup, de quoi charger tout le Pokédex ; le Pokédex public, 2 par seconde et 20 d'un coup ; le catalogue et les prix, 10 par seconde et 300 d'un coup ; les historiques et les lignes Cardmarket, 2 et 10 ; le compte, 2 et 20), la compression et les caches. Aucun journal des requêtes (ses erreurs, dans la sortie du conteneur, n'ont pas l'adresse du visiteur). Les pages en UTF-8 (`charset`) ; un fichier de la racine qui n'existe pas (`/favicon.ico`, `/sitemap.xml`) : 404, pas l'app ; hors des pages publiques (l'accueil, `/connexion`, `/inscription`, `/mentions-legales`), `X-Robots-Tag: noindex` (`map $robots`), avec `public/robots.txt` qui écarte `/api/`. Un gabarit, rempli du token au démarrage, vérifié à la construction (`nginx -t`) |
| `deploy/security-headers.conf` | Les en-têtes de sécurité de chaque réponse (HSTS sous-domaines compris, `Cross-Origin-Opener-Policy`, politique de sécurité du contenu…) ; `/images/` y ajoute `Cross-Origin-Resource-Policy: same-origin` (un autre site n'affiche pas ses images) |
| `compose.yaml` | Les services : `pokedex` (le site, sur `127.0.0.1:${POKEDEX_PORT:-8080}`, derrière Caddy) et `server` (volumes `db` et `backups`, secrets du `.env` : les comptes, `docs/compte-et-synchronisation.md`), tous deux sur `pokedex-net` ; journaux limités, aucun privilège gagné. Le journal du serveur : `docker compose logs -f server` |
| `server/backups.ts` | La copie quotidienne d'`app.db` (30 gardées, vérifiées, écrites sous un nom provisoire) : à copier aussi hors du VPS (README) |
| `.github/workflows/deploy.yml`, `deploy/deploy.sh` | Le déploiement (lancé à la main pour l'instant : son en-tête) : SSH sur le VPS (`VPS_FINGERPRINT` exigée), `git pull --ff-only`, `docker compose build --pull` puis `up -d` ; le site et l'API doivent répondre dans la minute ; les images d'avant restent une semaine (retour arrière : README) |

Les volumes `db` (les collections) et `backups` sont irremplaçables : **jamais
`docker compose down -v`**. Les données de référence et leur historique sont sauvegardés par l'API
des données. Marche à suivre complète et liste de mise en ligne : README.

Les variables d'environnement :

| Variable | Défaut | Lue par | Rôle |
|---|---|---|---|
| `BETTER_AUTH_URL` | (exigée) | `server` | L'adresse publique du site, en https en production (le serveur refuse de démarrer sinon) ; en développement, celle de Vite |
| `BETTER_AUTH_SECRET` | (exigée en production) | `server` | La clé des sessions, 32 caractères au moins en production (`openssl rand -base64 32`) |
| `DATA_API_TOKEN` | (exigée par `compose.yaml`) | `pokedex`, `server`, Vite | Le token du site pour l'API des données (le même que dans son `API_TOKENS`) |
| `DATA_API_URL` | `http://127.0.0.1:3001` (`http://data-api:3001` dans Docker) | `server` | L'adresse de l'API des données |
| `PORT` | `3000` | `server` | Le port du serveur (nginx et Vite visent 3000 : à ne changer qu'avec eux) |
| `HOST` | `127.0.0.1` | `server` | L'adresse d'écoute ; `0.0.0.0` dans le conteneur (`Dockerfile`), que nginx joint |
| `DATA_DIR` | `.data` (`/data` dans Docker) | `server` | La base SQLite |
| `BACKUP_DIR` | `<DATA_DIR>/backups` (`/backups`) | `server` | Les sauvegardes |
| `POKEDEX_PORT` | `8080` | `compose.yaml` | Le port local du site, que joint Caddy |
| `NO_COLOR` | aucun | `server` | Un journal sans couleurs |

Le serveur tourne sans droits d'administrateur (`USER bun`, `Dockerfile` : les points de montage
lui appartiennent). Les commandes du README qui copient vers ou depuis un dossier du VPS passent
`--user root` (et rendent `app.db` à `bun` après une restauration). nginx sert le manifeste de
l'app avec son type (`location = /manifest.webmanifest`) et rend complète l'adresse de l'image
d'aperçu (`sub_filter` sur `og:image`, d'après le nom demandé), sans perdre la date de la page
(`sub_filter_last_modified` : un navigateur qui la revalide reçoit un 304).
