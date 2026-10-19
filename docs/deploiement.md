# Déploiement

Le VPS, Docker, nginx, les services et les sauvegardes. Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

VPS derrière un tunnel Cloudflare. `Dockerfile` (Bun figé sur sa version mineure, `oven/bun:1.3-alpine`, comme nginx), trois cibles : `build` (Bun lance les tests, ESLint et
knip, puis construit `dist/`), `server` (Bun lance `server/` tel quel, avec `src/` et
`tsconfig.json` pour l'alias `@/` ; `NODE_ENV=production`, `HOST=0.0.0.0` ; son `package.json` vient
de `build` : un test en échec arrête aussi cette image, qu'utilise `ingest` ; seules les
dépendances du serveur, `elysia`, `@elysiajs/openapi` et `better-auth`, sont en `dependencies`,
celles de l'app en `devDependencies`) et `web` (nginx sert `dist/` ; sa configuration est vérifiée
à la construction, `nginx -t` : une faute arrête la construction, l'ancien conteneur reste en
ligne). `deploy/nginx.conf` : une
route inconnue reçoit `index.html`, le routage étant côté client ; `/api/` va au service `server`
(son adresse redemandée au DNS de Docker, `resolver` : un serveur redémarré change d'adresse) ;
`/images/` vient du volume `images` (gardé un an par les navigateurs, `immutable`), une image qui y manque va au serveur, qui la
copie (60 d’un coup, puis 10 par seconde, sans attente, `nodelay` ; le serveur en télécharge 4 à la fois) ; par visiteur (`cf-connecting-ip`, la seule adresse qui le distingue derrière le
tunnel), 2 requêtes par seconde pour les routes publiques coûteuses de l'API (`/api/histories`,
`/api/wants` : 10 d'un coup) et pour la connexion (`/api/auth/` : 20 d'un coup), 429 au-delà ; une
ligne de requête jusqu'à 16 Ko (`large_client_header_buffers` : les 1 025 ids d'une collection) ;
un fichier manquant de `/assets/` répond 404 ; `/assets/` en
cache un an ; compression gzip niveau 6, réponses de l'API comprises (`gzip_proxied` ; les réponses
précalculées arrivent déjà compressées, en Brotli si le navigateur l’accepte), des tampons d’1 Mo
pour les réponses de l’API (`proxy_buffers`) ; version de nginx masquée (`server_tokens off`) et en-têtes de
sécurité sur chaque réponse (`deploy/security-headers.conf` : HSTS un an, `nosniff`, `Referrer-Policy`,
`X-Frame-Options`, `Permissions-Policy`, la politique de sécurité du contenu : scripts, requêtes et
polices du site seulement, plus les polices que Vite intègre en `data:`, images aussi en https
pour une adresse collée, styles en ligne acceptés ; inclus aussi dans chaque `location` qui pose ses
propres en-têtes, nginx n'héritant pas alors de ceux du serveur). `compose.yaml` (journaux limités à 3 × 10 Mo par service ; `init` pour `server` et `ingest`, qui
transmet l'arrêt ; aucun service ne gagne de droits en cours de route, `no-new-privileges`, et ceux
de Bun n'en gardent aucun, `cap_drop: [ALL]` ; `server` est sain tant que `/api/account` répond,
`healthcheck`, que montre `docker compose ps`) :
- `pokedex` : le site sur `127.0.0.1:${POKEDEX_PORT:-8080}`, que le tunnel publie ;
- `server` : l'API, qui lit la base du volume `db`, y garde le compte et la collection (`app.db`),
  et copie à la demande dans le volume `images` ; ses secrets (`BETTER_AUTH_URL`, l'adresse
  publique en https, et `BETTER_AUTH_SECRET`) viennent du `.env` du clone (ignoré par git) : sans
  eux, docker compose refuse de démarrer (les comptes : `docs/compte-et-synchronisation.md`). Son
  journal (`server/journal.ts` :
  connexions, cartes, commandes, exports…) : `docker compose logs -f server` ;
- `ingest` : `server/ingest.ts --loop`, les tâches à leur rythme, dans les volumes `db`, `images`
  et `backups`. Dans l'ordre d'`INGEST_JOBS` (`config/jobs.ts`) : espèces chaque mois, catalogue
  chaque jour (son premier passage prend une vingtaine de minutes), puis prix toutes les 6 h, puis
  sauvegardes chaque jour, et enfin images chaque jour : leur premier passage, environ 1,5 Go,
  prend une heure ou plus (la sauvegarde ne l'attend pas, et le serveur copie en attendant les
  images affichées). Après un échec : 10 min, puis 20, 40… jusqu'à 6 h ; une tâche déjà en cours
  dans un autre processus, lancée à la main, n'est pas doublée ; au démarrage, un passage resté
  « en cours » est noté interrompu. À chaque démarrage, il refait les
  réponses calculées de l'API (leur forme a pu changer avec le code) : le catalogue et les prix
  d'après leurs tables, les espèces en repassant leur tâche (depuis le cache disque de PokéAPI,
  sans requête s'il a moins d'un mois).

Sauvegardes (`server/jobs/backups.ts`, volume `backups`) : chaque jour, `app.db` (30 gardées) et
`data.db` compressée (7 gardées), copiées par `VACUUM INTO` pendant que le serveur tourne,
vérifiées (`PRAGMA quick_check`) et écrites sous un nom provisoire (`tmp-…`) avant de prendre leur
place : une copie hors du VPS qui passerait pendant l'écriture n'emporte jamais un fichier à
moitié écrit. Elles sont sur le disque du VPS : à copier ailleurs aussi (README : la crontab vide
d'abord son dossier de transfert, le stockage distant garde 90 jours ; et la restauration des deux
bases). Les volumes `db` (historique des
prix, votre collection) et `backups` sont irremplaçables, `images` porte 1,5 Go de copies : jamais
`docker compose down -v`. `.github/workflows/deploy.yml` : lancé à la main tant que le domaine n'est pas prêt (le
push sur `main` à remettre, voir son en-tête), SSH sur le VPS (action épinglée sur un commit,
empreinte d'hôte `VPS_FINGERPRINT`, exigée : sans elle, le déploiement s'arrête ; 30 min au plus),
`git pull --ff-only` puis `deploy/deploy.sh` : `docker compose build --pull`, `up -d
--remove-orphans`, puis la page et l'API doivent
répondre dans la minute (sinon le déploiement échoue, en rouge) ; les images d'avant restent une
semaine, pour un retour arrière rapide (README). La clé SSH de déploiement peut être réservée à
cette seule commande (`authorized_keys`, README). Marche à suivre complète, la liste de mise en
ligne et une tâche lancée à la main : README.

Les variables d'environnement :

| Variable | Défaut | Lue par | Rôle |
|---|---|---|---|
| `BETTER_AUTH_URL` | (exigée) | `server` | L'adresse publique du site, en https en production (le serveur refuse de démarrer sinon) ; en développement, celle de Vite |
| `BETTER_AUTH_SECRET` | (exigée en production) | `server` | La clé des sessions, 32 caractères au moins en production (`openssl rand -base64 32`) |
| `PORT` | `3000` | `server` | Le port de l'API (nginx et Vite visent 3000 : à ne changer qu'avec eux) |
| `HOST` | `127.0.0.1` | `server` | L'adresse d'écoute ; `0.0.0.0` dans le conteneur (`Dockerfile`), que nginx joint |
| `DATA_DIR` | `.data` (`/data` dans Docker) | `server`, `ingest` | Les bases SQLite et le cache des téléchargements |
| `IMAGES_DIR` | `<DATA_DIR>/images` (`/images`) | `server`, `ingest` | Les images copiées |
| `BACKUP_DIR` | `<DATA_DIR>/backups` (`/backups`) | `ingest` | Les sauvegardes |
| `POKEDEX_PORT` | `8080` | `compose.yaml` | Le port local du site, que publie le tunnel |
| `NO_COLOR` | aucun | `server`, `ingest` | Un journal sans couleurs |

Le serveur et les tâches tournent sans droits d'administrateur (`USER bun`, `Dockerfile` : les
points de montage lui appartiennent). Les commandes du README qui copient vers ou depuis un dossier du
VPS passent `--user root` (et rendent `app.db` à `bun` après une restauration). nginx sert le
manifeste de l'app avec son type (`location = /manifest.webmanifest`) et rend complète l'adresse
de l'image d'aperçu (`sub_filter` sur `og:image`, d'après le nom demandé).
