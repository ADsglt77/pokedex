# Déploiement

Le VPS, Docker, nginx, les services et les sauvegardes. Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

VPS derrière un tunnel Cloudflare. `Dockerfile` (Bun figé sur sa version mineure, `oven/bun:1.3-alpine`, comme nginx), trois cibles : `build` (Bun lance les tests puis
construit `dist/`), `server` (Bun lance `server/` tel quel, avec `src/` et `tsconfig.json` pour
l'alias `@/` ; `NODE_ENV=production`) et `web` (nginx sert `dist/`). `deploy/nginx.conf` : une
route inconnue reçoit `index.html`, le routage étant côté client ; `/api/` va au service `server`
(son adresse redemandée au DNS de Docker, `resolver` : un serveur redémarré change d'adresse) ;
`/images/` vient du volume `images` (gardé un mois), une image qui y manque va au serveur, qui la
copie (10 par seconde au plus) ; un fichier manquant de `/assets/` répond 404 ; `/assets/` en
cache un an ; compression gzip niveau 6, réponses de l'API comprises (`gzip_proxied` ; les prix du
jour arrivent déjà compressés) ; version de nginx masquée (`server_tokens off`) et en-têtes de
sécurité sur chaque réponse (`deploy/security-headers.conf` : `nosniff`, `Referrer-Policy`,
`X-Frame-Options`, `Permissions-Policy`, la politique de sécurité du contenu : scripts, requêtes et
polices du site seulement, plus les polices que Vite intègre en `data:`, images aussi en https
pour une adresse collée, styles en ligne acceptés ; inclus aussi dans chaque `location` qui pose ses
propres en-têtes, nginx n'héritant pas alors de ceux du serveur). `compose.yaml` (journaux limités à 3 × 10 Mo par service ; `init` pour `server` et `ingest`, qui
transmet l'arrêt) :
- `pokedex` : le site sur `127.0.0.1:${POKEDEX_PORT:-8080}`, que le tunnel publie ;
- `server` : l'API, qui lit la base du volume `db`, y garde le compte et la collection (`app.db`),
  et copie à la demande dans le volume `images` ; ses secrets (`BETTER_AUTH_URL`, l'adresse
  publique en https, et `BETTER_AUTH_SECRET`) viennent du `.env` du clone (ignoré par git) : sans
  eux, docker compose refuse de démarrer. Le compte : à la première visite, avec le code du journal (`docker compose logs server`) ;
  son mot de passe : `docker compose run --rm server bun server/create-user.ts <e-mail>` ;
- `ingest` : `server/ingest.ts --loop`, les tâches à leur rythme (espèces chaque mois, catalogue
  chaque jour, puis prix toutes les 6 h, puis images et sauvegardes chaque jour ; après un échec : 10 min, puis 20, 40…
  jusqu'à 6 h ; une tâche déjà en cours dans un autre processus, lancée à la main, n'est pas
  doublée ; au démarrage, un passage resté « en cours » est noté interrompu), dans les volumes
  `db`, `images` et `backups`. À chaque démarrage, il refait les
  réponses calculées de l'API (leur forme a pu changer avec le code) : le catalogue et les prix
  d'après leurs tables, les espèces en repassant leur tâche (depuis le cache disque de PokéAPI,
  sans requête s'il a moins d'un mois) ; au premier, il reprend
  l'historique de l'ancien volume `prices` (`LEGACY_PRICES`, l'ancien service des prix, retiré)
  avant d'écrire ; si sa vérification échoue, la tâche des prix attend (les autres tournent).

Sauvegardes (`server/jobs/backups.ts`, volume `backups`) : chaque jour, `app.db` (30 gardées) et
`data.db` compressée (7 gardées), copiées par `VACUUM INTO` pendant que le serveur tourne. Elles
sont sur le disque du VPS : à copier ailleurs aussi (README). Les volumes `db` (historique des
prix, votre collection) et `backups` sont irremplaçables, `images` porte un Go de copies : jamais
`docker compose down -v` ; `prices` (l'ancien historique, repris) se supprime à la main quand tout
va bien. `.github/workflows/deploy.yml` : lancé à la main tant que le domaine n'est pas prêt (le
push sur `main` à remettre, voir son en-tête), SSH sur le VPS (action épinglée sur un commit,
empreinte d'hôte `VPS_FINGERPRINT`, exigée : sans elle, le déploiement s'arrête), `git pull --ff-only`, `docker compose build --pull` puis
`up -d --remove-orphans`. Marche à suivre complète, et la liste de mise en ligne : README.

Le serveur et les tâches tournent sans droits d'administrateur (`USER bun`, `Dockerfile` : les
points de montage lui appartiennent ; un volume créé avant, par un conteneur administrateur, se
rend une fois à `bun`, README). Les commandes du README qui copient vers ou depuis un dossier du
VPS passent `--user root` (et rendent `app.db` à `bun` après une restauration). nginx sert le
manifeste de l'app avec son type (`location = /manifest.webmanifest`) et rend complète l'adresse
de l'image d'aperçu (`sub_filter` sur `og:image`, d'après le nom demandé).
