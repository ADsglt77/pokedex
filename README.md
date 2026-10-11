# Pokédex

Pokédex personnel de cartes Pokémon japonaises : chaque Pokémon se débloque en possédant une de ses
illustrations (Art Rare, Special Art Rare…). React + Vite + TypeScript, interface
[`@camply/ui`](https://www.npmjs.com/package/@camply/ui), cartes [TCGdex](https://tcgdex.dev/).

```sh
bun install
bun dev          # serveur de dev Vite
bun run build    # type-check + build
bun lint         # ESLint
bun run format   # Prettier
```

- **Accueil** : progression, réglette par génération, dernières cartes obtenues.
- **Pokédex** : les 1 025 espèces, recherche (nom fr/en/ja ou numéro, raccourci `/`), filtres
  partageables dans l'adresse.
- **Fiche** : carte en grand, statut (possédée / commandée / souhaitée), illustration choisie,
  galerie des candidates, détails de l'espèce.
- **Données** : export / import, raretés suivies, effacement.

Tout est embarqué (index de cartes généré par `bun run data`) : aucun appel réseau à l'exécution
hormis les images. La collection reste dans le navigateur (`localStorage`) : l'export est sa seule
sauvegarde.

## Déploiement (VPS + tunnel Cloudflare)

Le site est statique. L'image Docker le construit avec Bun et le sert avec nginx
(`deploy/nginx.conf` renvoie `index.html` pour les adresses du routage côté client).
`compose.yaml` l'expose sur `127.0.0.1:8080` (variable `POKEDEX_PORT`), joignable seulement par le
tunnel.

**Une fois, sur le VPS**

1. Cloner le dépôt puis lancer le site (dépôt privé : ajouter au VPS une clé de déploiement en
   lecture seule) :
   ```sh
   git clone https://github.com/ADsglt77/pokedex.git
   cd pokedex
   docker compose up -d --build
   ```
2. Publier le site par le tunnel : un nom d'hôte public (par exemple `pokedex.ton-domaine.fr`)
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

**Ensuite, à chaque push sur `main`** (`.github/workflows/deploy.yml`) : GitHub se connecte au VPS
en SSH, fait `git pull` et reconstruit le conteneur ; si la construction échoue, l'ancienne
version reste en ligne. Secrets à créer dans le dépôt (Settings › Secrets and variables ›
Actions) :

| Secret | Valeur |
|---|---|
| `VPS_HOST` | adresse du VPS |
| `VPS_USER` | utilisateur SSH, membre du groupe `docker` |
| `VPS_SSH_KEY` | clé privée dédiée au déploiement (sa clé publique dans `~/.ssh/authorized_keys` du VPS) |
| `VPS_PATH` | dossier du clone, par exemple `/home/moi/pokedex` |
| `VPS_PORT` | port SSH, seulement s'il n'est pas 22 |

Le port SSH doit être joignable depuis GitHub. S'il ne passe que par le tunnel (Cloudflare
Access), ce workflow ne peut pas s'y connecter : il faut alors un runner GitHub auto-hébergé sur
le VPS.
