# Pokédex

Pokédex personnel de cartes Pokémon : pour chacun des 1 025 Pokémon, on ajoute la carte que l'on
veut (sa référence, d'où son image est retrouvée, et son id Cardmarket pour suivre son prix) ; le
Pokémon se débloque quand on la possède. React + Vite + TypeScript, interface
[`@camply/ui`](https://www.npmjs.com/package/@camply/ui), espèces [PokéAPI](https://pokeapi.co/),
images [TCGdex](https://tcgdex.dev/), prix [Cardmarket](https://www.cardmarket.com/).

```sh
bun install
bun dev          # serveur de dev Vite
bun run build    # type-check + build
bun lint         # ESLint
bun test         # tests de la logique des achats
bun run format   # Prettier
```

- **Accueil** : progression, réglette par génération, dernières cartes obtenues.
- **Pokédex** : les 1 025 espèces, recherche (nom fr/en/ja ou numéro, raccourci `/`), filtres
  partageables dans l'adresse.
- **Fiche** : la carte du Pokémon (à ajouter, corriger ou retirer), en grand, son statut
  (possédée / commandée / souhaitée) et son prix payé, son prix Cardmarket et sa courbe, le lien
  vers sa page Cardmarket, l'achat (à acheter ou exclue, priorité, prix maximum, note), les détails
  de l'espèce.
- **Ajouter depuis Cardmarket** : sur la page d'une carte chez Cardmarket, le favori « Ajouter au
  Pokédex » ouvre l'app avec son id, son nom et l'adresse de la page ; le Pokémon est reconnu
  d'après le nom et l'image retrouvée d'après le code de la carte (« sv2a 166 »), à vérifier ; il
  reste à valider.
- **Valeur** : prix Cardmarket du jour, valeur de la collection (et gain par rapport au prix
  payé), commandes, souhaits, coût pour compléter le Pokédex, courbes de prix au fil des jours.
- **Achats** : liste d'achats (les cartes acceptées, avec priorité et prix maximum),
  assistant « prochaine commande » dans un budget (100 € par mois, 150 € au plus, réglables),
  registre des commandes (Cardmarket, Myutsu, Hikaru…) qui met à jour les statuts, suivi du
  budget par mois et par fournisseur. Export CSV et recherches à coller dans Cardmarket.
- **Données** : le favori Cardmarket à installer (à glisser dans la barre de favoris, ou son code
  à copier), les images à chercher pour les cartes qui n'en ont pas, export / import (achats
  compris), effacement.

Les espèces sont embarquées (`bun run data`, depuis PokéAPI), tout comme le dossier d'images de
chaque extension chez TCGdex (`bun run data:images --refresh` pour les nouvelles extensions) :
aucune API externe appelée par le navigateur, hormis les images (dessins des Pokémon chez PokéAPI,
cartes chez TCGdex ou à l'adresse collée ; pas celles de Cardmarket, qui ne s'affichent que sur
son site). Le favori ne fait que
lire la page Cardmarket ouverte et l'envoyer à l'app d'où il a été installé : installé depuis
`bun dev`, il ouvre `localhost`. Les prix sont des fichiers du site
lui-même (`/prices/`), écrits chaque jour par `bun run prices` d'après les fichiers publics de
Cardmarket : le prix du jour de toutes ses cartes à l'unité, et l'historique de chacune. En
développement, lancer `bun run prices` une fois (le premier passage écrit quelque 60 000 fichiers
dans `prices/`). La collection reste dans le navigateur (`localStorage`) : l'export est sa seule
sauvegarde.

## Déploiement (VPS + tunnel Cloudflare)

Le site est statique. L'image Docker le construit avec Bun et le sert avec nginx
(`deploy/nginx.conf` renvoie `index.html` pour les adresses du routage côté client).
`compose.yaml` l'expose sur `127.0.0.1:8080` (variable `POKEDEX_PORT`), joignable seulement par le
tunnel. Le service `prices` du même fichier relit les prix Cardmarket toutes les 6 h et en garde
l'historique (un fichier par carte, quelques centaines de Mo) dans le volume Docker `prices` : ne
pas lancer `docker compose down -v`, qui l'effacerait.

**Une fois, sur le VPS**

1. Cloner le dépôt **en SSH** puis lancer le site. Le dépôt est privé : ajouter au VPS une clé de
   déploiement en lecture seule, qui est une clé SSH. C'est la clé par défaut de l'utilisateur, ou
   celle déclarée pour `github.com` dans `~/.ssh/config`. Un clone HTTPS demanderait un jeton, et le
   `git pull` du déploiement automatique échouerait.
   ```sh
   git clone git@github.com:ADsglt77/pokedex.git
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
en SSH, fait `git pull` et reconstruit le conteneur. La construction lance d'abord `bun test` et
rafraîchit les images de base ; si elle échoue, test compris, l'ancienne version reste en ligne.
Secrets à créer dans le dépôt (Settings › Secrets and variables › Actions) :

| Secret | Valeur |
|---|---|
| `VPS_HOST` | adresse du VPS |
| `VPS_USER` | utilisateur SSH, membre du groupe `docker` |
| `VPS_SSH_KEY` | clé privée dédiée au déploiement (sa clé publique dans `~/.ssh/authorized_keys` du VPS) |
| `VPS_PATH` | dossier du clone, par exemple `/home/moi/pokedex` |
| `VPS_PORT` | port SSH, seulement s'il n'est pas 22 |
| `VPS_FINGERPRINT` | empreinte de la clé d'hôte du VPS, pour ne parler qu'à lui : la sortie de `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub \| cut -d ' ' -f2` (`SHA256:…`). Sans elle, l'hôte n'est pas vérifié |

Le port SSH doit être joignable depuis GitHub. S'il ne passe que par le tunnel (Cloudflare
Access), ce workflow ne peut pas s'y connecter : il faut alors un runner GitHub auto-hébergé sur
le VPS.
