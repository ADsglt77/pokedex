# 1. Tests de la logique d'argent, puis construction du site statique (dist/) avec Bun : un test en
#    échec arrête la construction, et l'ancien conteneur reste en ligne.
FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun test && bun run build

# 2. Service : nginx sert dist/. Le tunnel Cloudflare du VPS pointe sur ce conteneur.
FROM nginx:1.28-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
