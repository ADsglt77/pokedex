# CLAUDE.md

Pokédex personnel de cartes Pokémon **japonaises** : un Pokémon est « débloqué » quand on possède une
de ses cartes dans une rareté suivie (par défaut SAR, AR, CSR, CHR). React 19 + Vite + TypeScript,
UI `@camply/ui`, cartes TCGdex, espèces PokéAPI.

## Commandes

Bun est le gestionnaire de paquets (`bun.lock`) — pas npm/pnpm/yarn.

```sh
bun install
bun dev                # serveur Vite
bun run build          # tsc -b + vite build (pas `bun build`)
bun lint               # ESLint
bun run format         # Prettier sur src/ et scripts/ (les JSON de src/data sont exclus)
bun run data           # régénère src/data (espèces puis cartes) ; `--refresh` ignore le cache
bun run data:species   # PokéAPI → species.json, species-details.json
bun run data:cards     # TCGdex → card-index.json (avec l'identifiant Cardmarket de chaque carte)
bun run prices         # prix Cardmarket du jour → public/prices (sur le VPS : service `prices`)
```

Les scripts de données gardent les réponses des API dans `scripts/.cache` (ignoré par git) : on peut
les relancer sans solliciter les API. Un fichier n'est réécrit que si son contenu change.
Images de l'index, dans l'ordre de préférence (`data:cards`) :
1. celle de l'API TCGdex ;
2. celle que TCGdex publie sans la référencer (`image: null`), vérifiée à l'adresse habituelle
   `assets.tcgdex.net/ja/<série>/<extension>/<numéro>` ;
3. celle du catalogue TCGplayer « Pokemon Japan », lue dans l'export quotidien de tcgcsv.com
   (`scripts/lib/tcgplayer.ts`) : extension + numéro, variantes écartées, `SM1p` = `SM1+`. Plus petite
   (320 × 454). Règles de tcgcsv : script côté serveur, User-Agent identifié, 100 ms entre requêtes,
   cache local, une synchronisation par jour au plus.
Rien de cela n'est fait dans le navigateur : le serveur d'images de TCGdex n'envoie pas d'en-tête
CORS sur ses 404. `cardImage()` (`src/lib/tcgdex.ts`) déduit les deux tailles d'une base TCGdex ou
TCGplayer.

## Déploiement

VPS derrière un tunnel Cloudflare. `Dockerfile` : Bun construit `dist/`, nginx le sert
(`deploy/nginx.conf` : toute route inconnue reçoit `index.html`, le routage étant côté client ;
`/assets/` en cache un an ; `/prices/` toujours revalidé). `compose.yaml` : le site sur
`127.0.0.1:${POKEDEX_PORT:-8080}`, que le tunnel publie, et le service `prices` qui relance
`scripts/prices.ts` toutes les 6 h dans le volume `prices` (l'historique y vit : ne pas supprimer
le volume). `.github/workflows/deploy.yml` : à chaque push sur `main`, SSH sur le VPS,
`git pull --ff-only` puis `docker compose up -d --build`. Marche à suivre complète : README.

## Principes

- App **volontairement simple** : pas de tests, pas d'abstraction « au cas où ». Factoriser quand une
  logique sert à deux endroits ou plus.
- UI : **`@camply/ui` d'abord** (skill `camply-ui`), thème camply par défaut (sombre, accent cyan).
  Un composant maison seulement s'il est métier ou absent de la lib.
- TCGdex (scripts de données seulement) : skill `tcgdex-api`, gérer `image == null`.
- Périmètre volontairement réduit : pas d'ajout de carte à la main, d'image personnelle, de
  comparaison ni de fusion à l'import ; aucune API externe appelée par le navigateur. Seule exception :
  les prix, fichiers du site lui-même (`/prices/`). Ne pas réintroduire le reste sans demande.
- Textes en français (fr-FR pour nombres et dates), vouvoiement.
- Prettier : pas de point-virgule, guillemets simples, 100 colonnes.

## Architecture

| Dossier | Rôle |
|---|---|
| `src/config/` | Générations, types, classes de rareté, règles des cartes secrètes (configuration, pas de logique) |
| `src/data/` | JSON générés par `bun run data` : espèces, détails, index des cartes classées |
| `src/lib/` | Règles métier **pures** : `rarity` (classement), `candidates` (tri, représentante), `pokedex` (modèle + progression), `collection` (mises à jour immuables), `filters` (URL + recherche), `transfer` (lecture, export, import), `prices` (valeur, coût pour compléter, historique) |
| `src/store/` | Zustand : `collection` (collection + réglages, `localStorage`) et `prices` (prix du jour et historique, lus sur `/prices/`) |
| `src/hooks/` | `usePokedex` (modèle mémoïsé partagé, source de toutes les pages), `useNotify` (toasts + « Annuler »), `usePokedexFilters` |
| `src/components/` | Composants métier partagés (carte, tuile, réglette…) ; tout le reste vient de `@camply/ui` |
| `src/pages/` | Une page par route ; les sous-composants d'une page vivent dans son dossier |
| `scripts/` | Génération des données (Bun), qui réutilise `src/lib` et `src/config` via l'alias `@/` |

Points à connaître :

- Prix (`scripts/prices.ts`) : le guide des prix public de Cardmarket (un fichier par jour),
  relié aux cartes par l'identifiant Cardmarket que donne TCGdex. Il écrit `latest.json` et
  `history.json` (Cardmarket ne garde pas d'historique : chaque jour ajoute une colonne). Sans ces
  fichiers (`bun dev` sans `bun run prices`), l'app marche, sans prix.
- Le prix payé (`paidPrice`, facultatif) est rangé avec le statut de la carte et la suit d'un
  statut à l'autre ; retirer le statut l'efface.
- Stockage : clés `pokedex-collection.collection` et `.settings`. Ids de carte `tcgdex:ja:<id>` et
  `manual:<uuid>`. Ne pas changer ces formats : ce sont les données de l'utilisateur.
- `customCards` et `imageOverrides` viennent d'anciennes versions : lus, affichés, exportés, mais
  plus modifiables (une carte personnelle reste toujours candidate).
- Deux onglets ouverts restent d'accord : chacun reprend ce que l'autre enregistre (évènement
  `storage` dans `store/collection.ts`), sans quoi il l'écraserait.
- La fiche d'un Pokémon lit son entrée dans `usePokedex()` : grille, accueil et fiche montrent
  exactement les mêmes candidates.
- « Annuler » (`useCollectionAction`) rétablit collection et réglages d'avant, et refuse si quelque
  chose a changé depuis : une modification ultérieure n'est jamais effacée.
- Lecture du stockage et de l'import tolérante (`lib/transfer.ts`) : un enregistrement illisible est
  écarté, une donnée stockée illisible est copiée sous `pokedex-collection.backup.<collection|settings>.<date>`.
- Les filtres du Pokédex vivent dans l'URL (`q`, `generation`, `possession`, `illustration`, `ordre`).
- `noUncheckedIndexedAccess` est actif ; alias `@/` → `src/` (vite.config.ts, tsconfig.app.json,
  tsconfig.scripts.json, et tsconfig.json pour Bun).

## Skills du projet (`.claude/skills/`)

`camply-ui`, `tcgdex-api` (écrits pour ce projet), `vercel-react-best-practices`,
`vercel-composition-patterns` (installés via `npx skills`, verrouillés dans `skills-lock.json`).
