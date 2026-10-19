# Bun figé sur sa version mineure, comme nginx : `build --pull` prend ses correctifs, jamais une
# nouvelle version de `bun:sqlite`, de `Bun.serve` ou du format de `bun.lock` sans prévenir.

# 1. Tests de la logique d'argent, lint et code mort (ESLint, knip), puis construction du site
#    statique (dist/) avec Bun : un échec arrête la construction, et l'ancien conteneur reste en
#    ligne.
FROM oven/bun:1.3-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun test && bun lint && bun run build

# 2. Le serveur de l'app (service `server`) : Bun lance le code tel quel ; `tsconfig.json` lui
#    donne l'alias `@/` vers `src/`, dont il lit les règles. La base vit dans le volume `db`
#    (`DATA_DIR`), ses sauvegardes dans `backups`. Son `package.json` vient de l'étape 1 : elle
#    passe donc d'abord, et un test en échec arrête aussi cette image.
FROM oven/bun:1.3-alpine AS server
WORKDIR /app
COPY --from=build /app/package.json /app/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY tsconfig.json ./
COPY server server
COPY src src
# `production` : cookies de session sécurisés et limite de tentatives de connexion (Better Auth).
# `HOST` : le serveur écoute toutes les adresses de son conteneur, pour nginx (hors Docker, la
# machine seulement).
ENV NODE_ENV=production HOST=0.0.0.0 DATA_DIR=/data BACKUP_DIR=/backups
# Sans droits d'administrateur (l'utilisateur `bun` de l'image) : une faille du serveur ne donnerait
# pas la main sur le conteneur. Les points de montage lui appartiennent, et un volume neuf en hérite
# (un volume créé avant, par un conteneur administrateur : voir le README).
RUN mkdir -p /data /backups && chown bun:bun /data /backups
USER bun
CMD ["bun", "server/index.ts"]

# 3. Le site : nginx sert dist/, renvoie /api/ au serveur, et les données et les images à l'API
#    des données (avec le token du site). Le tunnel Cloudflare du VPS pointe sur ce conteneur.
FROM nginx:1.28-alpine AS web
# Un gabarit, rempli au démarrage avec le token (`DATA_API_TOKEN`, `compose.yaml`).
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/security-headers.conf /etc/nginx/security-headers.conf
# Une faute dans la configuration arrête la construction : l'ancien conteneur reste en ligne, au
# lieu d'un nginx qui redémarrerait en boucle. Vérifiée remplie d'un token d'essai, comme le fera
# l'image au démarrage (la configuration de l'essai est alors remplacée).
RUN DATA_API_TOKEN=essai envsubst '${DATA_API_TOKEN}' \
      < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf \
    && nginx -t
COPY --from=build /app/dist /usr/share/nginx/html
