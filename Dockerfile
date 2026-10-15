# 1. Tests de la logique d'argent, puis construction du site statique (dist/) avec Bun : un test en
#    échec arrête la construction, et l'ancien conteneur reste en ligne.
FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun test && bun run build

# 2. Le serveur (API) et les tâches d'ingestion (services `server` et `ingest`) : Bun lance le code
#    tel quel ; `tsconfig.json` lui donne l'alias `@/` vers `src/`, dont il lit les règles et les
#    données. Les bases vivent dans le volume `db` (`DATA_DIR`), les images dans `images`.
FROM oven/bun:1-alpine AS server
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY tsconfig.json ./
COPY server server
COPY src src
# `production` : cookies de session sécurisés et limite de tentatives de connexion (Better Auth).
ENV NODE_ENV=production DATA_DIR=/data IMAGES_DIR=/images BACKUP_DIR=/backups
CMD ["bun", "server/index.ts"]

# 3. Le site : nginx sert dist/ et les images copiées, et renvoie /api/ au serveur. Le tunnel
#    Cloudflare du VPS pointe sur ce conteneur.
FROM nginx:1.28-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
