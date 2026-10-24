#!/bin/sh
# Le déploiement sur le VPS, une fois le code à jour (`git pull --ff-only`), lancé par le workflow
# `.github/workflows/deploy.yml` (ou par la clé de déploiement restreinte : README) : vérifie que
# l'API des données a ses cartes françaises, reconstruit et redémarre les conteneurs, puis vérifie
# que le site répond, en local puis à son adresse publique.
set -e
cd "$(dirname "$0")/.."

# Les cartes françaises sont-elles prêtes à l'API des données ? Avant de toucher au site : un échec
# ici (en rouge) laisse l'ancien site en ligne. Un site déployé avant montrerait « Catalogue
# indisponible » et des pochettes de substitution pour tout le français : l'API ne copie aucune
# image à la demande, une image absente est un 404. Demandé à l'ancien site, dont nginx renvoie
# ces routes à l'API (il n'y en a pas au tout premier déploiement : rien à vérifier alors) :
# le catalogue, puis le scan de la dernière carte de sa série la plus récente. Une réussite ne dit
# pas que la tâche `cards` a fini, seulement que le site n'en est pas vide (README, « Mettre à
# jour un VPS en place »). `SKIP_FRENCH_CHECK=1 sh deploy/deploy.sh`, à la main sur le VPS,
# saute ce contrôle (la clé restreinte du déploiement automatique n'en reçoit aucune variable).
french_ready() {
  sets=$(curl -fsS --compressed "$live/api/catalog/fr/sets") || return 1
  code=$(printf '%s' "$sets" | sed -n 's/.*"sets":\[\["\([^"]*\)".*/\1/p')
  rank=$(curl -fsS --compressed "$live/api/catalog/fr/sets/$code" | grep -o '"image":[1-9][0-9]*' | tail -1 | cut -d: -f2)
  curl -fsS -o /dev/null "$live/images/cards/fr/$code/$rank-md.webp"
}
if [ -z "$SKIP_FRENCH_CHECK" ] && [ -n "$(docker compose ps -q pokedex)" ]; then
  live="http://$(docker compose port pokedex 80)"
  if ! french_ready; then
    echo "L'API des données n'a pas fini ses cartes françaises (catalogue ou images) : le site d'avant reste en ligne."
    echo "Attendre les étapes Catalogue et Images de la tâche \`cards\` (README, « Mettre à jour un VPS en place »), puis relancer."
    echo "Pour déployer quand même, à la main sur le VPS : SKIP_FRENCH_CHECK=1 sh deploy/deploy.sh"
    exit 1
  fi
fi

# `--pull` : les images de base (nginx, bun) reçoivent leurs correctifs ; `--remove-orphans` :
# un service retiré de compose.yaml est arrêté.
docker compose build --pull
docker compose up -d --remove-orphans

# Le site répond-il ? La page, puis l'API (nginx, puis Bun) : sinon le déploiement échoue, en rouge,
# au lieu d'un site en panne sans que personne ne le voie.
site="http://$(docker compose port pokedex 80)"
ok=
for attempt in $(seq 1 30); do
  if curl -fsS -o /dev/null "$site/" && curl -fsS -o /dev/null "$site/api/account"; then
    ok=1
    break
  fi
  sleep 2
done
if [ -z "$ok" ]; then
  echo "Le site ne répond pas après le déploiement (voir docker compose logs)."
  docker compose ps
  exit 1
fi

# Puis par son adresse publique, à travers Caddy (son certificat, son relais vers le port local) :
# un Caddyfile cassé ou un certificat périmé font aussi échouer le déploiement. `--resolve` : le
# nom est joint sur ce VPS même (127.0.0.1, où écoute Caddy), sans dépendre du routage vers sa
# propre adresse publique (pare-feu sortant, DNS interne) : seule une vraie panne de Caddy échoue.
if ! curl -fsS --resolve pokecodex.fr:443:127.0.0.1 -o /dev/null https://pokecodex.fr/api/account; then
  echo "Caddy ne répond pas à https://pokecodex.fr (voir : systemctl status caddy, son Caddyfile et son certificat)."
  exit 1
fi

# Les images d'avant et le cache de leur construction restent une semaine : un retour arrière se
# reconstruit vite (README, « Revenir à la version d'avant ») ; plus vieux, ils remplissaient le
# disque.
docker image prune -f --filter until=168h
docker builder prune -f --filter until=168h
