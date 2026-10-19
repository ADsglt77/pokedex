#!/bin/sh
# Le déploiement sur le VPS, une fois le code à jour (`git pull --ff-only`), lancé par le workflow
# `.github/workflows/deploy.yml` (ou par la clé de déploiement restreinte : README) : reconstruit et
# redémarre les conteneurs, puis vérifie que le site répond.
set -e
cd "$(dirname "$0")/.."

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

# Les images d'avant restent une semaine : un retour arrière se reconstruit vite (README, « Revenir
# à la version d'avant »).
docker image prune -f --filter until=168h
