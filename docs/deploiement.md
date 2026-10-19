# Déploiement

Le VPS, Docker, nginx, les services et les sauvegardes. Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

VPS derrière un tunnel Cloudflare, à côté de l'API des données (le dépôt `pokedex-data`, ses
propres conteneurs, à installer d'abord : son README). Les deux partagent un réseau Docker,
`pokedex-net`, créé une fois à la main ; l'API n'y publie aucun port : seuls le nginx et le
serveur du site la joignent, à `http://data-api:3001`, avec le token du site (`DATA_API_TOKEN`).

`Dockerfile` (Bun figé sur sa version mineure, `oven/bun:1.3-alpine`, comme nginx), trois cibles :
`build` (Bun lance les tests, ESLint et knip, puis construit `dist/`), `server` (Bun lance
`server/` tel quel, avec `src/` et `tsconfig.json` pour l'alias `@/` ; `NODE_ENV=production`,
`HOST=0.0.0.0` ; son `package.json` vient de `build` : un test en échec arrête aussi cette image ;
seules les dépendances du serveur, `elysia`, `@elysiajs/openapi` et `better-auth`, sont en
`dependencies`, celles de l'app en `devDependencies`) et `web` (nginx sert `dist/` ; sa
configuration est un gabarit, `deploy/nginx.conf.template`, que l'image remplit au démarrage avec
le token, seulement les variables de son environnement, celles de nginx restant telles quelles ;
elle est vérifiée à la construction, remplie d'un token d'essai, `nginx -t` : une faute arrête la
construction, l'ancien conteneur reste en ligne).

`deploy/nginx.conf.template` : une route inconnue reçoit `index.html`, le routage étant côté
client ; les données (`/api/species`, `/api/catalog/…`, `/api/prices/…`, `/api/histories`,
`/api/wants`, `/api/status`, `/api/health`) vont à l'API des données, sous `/v1`, avec le token
(`proxy_set_header Authorization`) et sans les cookies du navigateur ; le reste de `/api/` va au
service `server` (les adresses des deux redemandées au DNS de Docker, `resolver` : un conteneur
redémarré change d'adresse) ; `/images/` vient de l'API des données (`/v1/images/`), gardé sur le
disque de nginx (`proxy_cache`, 4 Go au plus, perdu à la reconstruction du conteneur : l'API
redonne les images sans rien télécharger ; deux demandes d'une image pas encore gardée n'en font
qu'une, `proxy_cache_lock` ; une absence n'est pas gardée) et un an par les navigateurs
(`immutable`) ; par visiteur (`cf-connecting-ip`, la seule adresse qui le distingue derrière le
tunnel), 2 requêtes par seconde pour les routes coûteuses (`/api/histories`, `/api/wants` : 10
d'un coup) et pour la connexion (`/api/auth/` : 20 d'un coup), 429 au-delà ; une ligne de requête
jusqu'à 16 Ko (`large_client_header_buffers` : les 1 025 ids d'une collection) ; un fichier
manquant de `/assets/` répond 404 ; `/assets/` en cache un an ; compression gzip niveau 6,
réponses de l'API comprises (`gzip_proxied` ; les réponses précalculées arrivent déjà compressées,
en gzip), des tampons d'1 Mo pour les réponses de l'API
(`proxy_buffers`) ; version de nginx masquée (`server_tokens off`) et en-têtes de sécurité sur
chaque réponse (`deploy/security-headers.conf` : HSTS un an, `nosniff`, `Referrer-Policy`,
`X-Frame-Options`, `Permissions-Policy`, la politique de sécurité du contenu : scripts, requêtes et
polices du site seulement, plus les polices que Vite intègre en `data:`, images aussi en https
pour une adresse collée, styles en ligne acceptés ; inclus aussi dans chaque `location` qui pose
ses propres en-têtes, nginx n'héritant pas alors de ceux du serveur).

`compose.yaml` (journaux limités à 3 × 10 Mo par service ; `init` pour `server`, qui transmet
l'arrêt ; aucun service ne gagne de droits en cours de route, `no-new-privileges`, et celui de Bun
n'en garde aucun, `cap_drop: [ALL]` ; `server` est sain tant que `/api/account` répond,
`healthcheck`, que montre `docker compose ps`) :
- `pokedex` : le site sur `127.0.0.1:${POKEDEX_PORT:-8080}`, que le tunnel publie ; sur les
  réseaux `default` et `pokedex-net` ; le token de l'API des données (`DATA_API_TOKEN`) ;
- `server` : les comptes et les collections (`app.db`, volume `db`) et leurs sauvegardes (volume
  `backups`) ; sur les réseaux `default` et `pokedex-net` (les prix d'un Pokédex public :
  `DATA_API_URL`) ; ses secrets (`BETTER_AUTH_URL`, l'adresse publique en https,
  `BETTER_AUTH_SECRET`, `DATA_API_TOKEN`) viennent du `.env` du clone (ignoré par git) : sans eux,
  docker compose refuse de démarrer (les comptes : `docs/compte-et-synchronisation.md`). Son
  journal (`server/journal.ts` : connexions, cartes, commandes, exports, sauvegardes…) :
  `docker compose logs -f server`.

Sauvegardes (`server/backups.ts`, volume `backups`) : le serveur copie `app.db` chaque jour (au
démarrage puis chaque heure, celle du jour si elle manque ; 30 gardées), par `VACUUM INTO` pendant
qu'il tourne, vérifiée (`PRAGMA quick_check`) et écrite sous un nom provisoire (`tmp-…`) avant de
prendre sa place : une copie hors du VPS qui passerait pendant l'écriture n'emporte jamais un
fichier à moitié écrit. Elles sont sur le disque du VPS : à copier ailleurs aussi (README). Les
données de référence et leur historique ont les leurs, dans l'API des données. Les volumes `db`
(vos collections) et `backups` sont irremplaçables : jamais `docker compose down -v`.

`.github/workflows/deploy.yml` : lancé à la main tant que le domaine n'est pas prêt (le push sur
`main` à remettre, voir son en-tête), SSH sur le VPS (action épinglée sur un commit, empreinte
d'hôte `VPS_FINGERPRINT`, exigée : sans elle, le déploiement s'arrête ; 30 min au plus),
`git pull --ff-only` puis `deploy/deploy.sh` : `docker compose build --pull`, `up -d
--remove-orphans`, puis la page et l'API du serveur doivent répondre dans la minute (sinon le
déploiement échoue, en rouge) ; les images d'avant restent une semaine, pour un retour arrière
rapide (README). La clé SSH de déploiement peut être réservée à cette seule commande
(`authorized_keys`, README). Marche à suivre complète et liste de mise en ligne : README.

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
| `POKEDEX_PORT` | `8080` | `compose.yaml` | Le port local du site, que publie le tunnel |
| `NO_COLOR` | aucun | `server` | Un journal sans couleurs |

Le serveur tourne sans droits d'administrateur (`USER bun`, `Dockerfile` : les points de montage
lui appartiennent). Les commandes du README qui copient vers ou depuis un dossier du VPS passent
`--user root` (et rendent `app.db` à `bun` après une restauration). nginx sert le manifeste de
l'app avec son type (`location = /manifest.webmanifest`) et rend complète l'adresse de l'image
d'aperçu (`sub_filter` sur `og:image`, d'après le nom demandé).
