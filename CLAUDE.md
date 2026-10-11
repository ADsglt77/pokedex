# CLAUDE.md

Pokédex personnel de cartes Pokémon **japonaises** : un Pokémon est « débloqué » quand on possède une
de ses cartes dans une rareté suivie (par défaut SAR, AR, CSR, CHR). React 19 + Vite + TypeScript,
UI `@camply/ui`, cartes TCGdex, espèces PokéAPI, prix Cardmarket.

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
bun run data:cards     # TCGdex → card-index.json (cartes classées, images, ids Cardmarket)
bun run prices         # prix Cardmarket du jour → public/prices (sur le VPS : service `prices`)
```

## Principes

- App **volontairement simple** : pas de tests, pas d'abstraction « au cas où », pas de
  vérification défensive dans les fonctions. On ne contrôle que ce qui vient de l'extérieur :
  le stockage du navigateur et le fichier importé (`lib/transfer.ts`), l'adresse (`lib/filters.ts`).
  Factoriser quand une logique sert à deux endroits ou plus.
- Le calcul se fait à la construction des données, pas dans l'app : l'index arrive classé.
- UI : **`@camply/ui` d'abord** (skill `camply-ui`), thème camply par défaut (sombre, accent cyan).
  Un composant maison seulement s'il est métier ou absent de la lib.
- Périmètre volontairement réduit : pas d'ajout de carte à la main, d'image personnelle, de
  comparaison ni de fusion à l'import ; aucune API externe appelée par le navigateur. Seule exception :
  les prix, fichiers du site lui-même (`/prices/`). Ne pas réintroduire le reste sans demande.
- Textes en français (fr-FR pour nombres et dates), vouvoiement.
- Prettier : pas de point-virgule, guillemets simples, 100 colonnes.

## Architecture

| Dossier | Rôle |
|---|---|
| `src/config/` | Générations, couleurs des types, classes de rareté (configuration, pas de logique) |
| `src/data/` | JSON écrits par `bun run data` : espèces, détails, index des cartes déjà classées |
| `src/lib/` | Règles **pures** : `catalog` (données embarquées), `images`, `rarity`, `candidates` (candidates, représentante), `pokedex` (modèle + progression), `collection` (modifications), `filters` (adresse + recherche), `transfer` (export, import, lecture du stockage), `prices` (valeur, coût pour compléter, courbes), `format` |
| `src/store/` | Zustand : `collection` (collection + réglages, `localStorage`) et `prices` (`/prices/`) |
| `src/hooks/` | `usePokedex` (modèle partagé par toutes les pages), `useNotify` (toasts + « Annuler »), `usePokedexFilters` |
| `src/components/` | Composants métier partagés (carte, tuile, réglette, courbe…) ; le reste vient de camply |
| `src/pages/` | Une page par route ; les sous-composants d'une page vivent dans son dossier |
| `scripts/` | Construction des données (Bun). `lib/rules.ts` : corrections de TCGdex (cartes secrètes, exclusions, espèces) ; `lib/tcgdex.ts` : lecture et classement des cartes |

Points à connaître :

- Une ligne de l'index (`CardIndexRow`) porte déjà son code de classe (`rarity: 'AR'`), `deduced`
  pour une carte secrète classée par sa place dans l'extension (`scripts/lib/deduceSecrets.ts`), la
  base de son image et son id Cardmarket. `lib/catalog.ts` en fait des `PokemonCard`.
- Images (`data:cards`) : celle de l'API TCGdex ; sinon celle que TCGdex publie sans la citer,
  vérifiée à `assets.tcgdex.net/ja/<série>/<extension>/<numéro>` ; sinon celle de TCGplayer, lue
  dans l'export de tcgcsv.com (`scripts/lib/tcgplayer.ts` ; script côté serveur, User-Agent identifié,
  100 ms entre requêtes, cache local, une synchronisation par jour au plus). `lib/images.ts` en tire
  les deux tailles. Les réponses des API restent dans `scripts/.cache` ; un fichier de `src/data`
  n'est réécrit que si son contenu change.
- Prix (`scripts/prices.ts`) : le guide public de Cardmarket, un fichier par jour, relié aux cartes
  par leur id Cardmarket. Il écrit `latest.json` et `history.json` (chaque jour une colonne :
  Cardmarket ne garde pas d'historique). Sans ces fichiers (`bun dev` seul), l'app marche sans prix.
- Collection : un statut par carte (possédée, commandée, souhaitée), le prix payé (`paidPrice`) qui
  le suit, l'illustration choisie par Pokémon. Clés `pokedex-collection.collection` et `.settings`,
  ids `tcgdex:ja:<id>` (et `manual:<uuid>` pour les cartes saisies dans une ancienne version, lues
  dans `customCards`, toujours candidates) : ne pas changer ces formats.
- Deux onglets ouverts restent d'accord : chacun reprend ce que l'autre enregistre (évènement
  `storage` dans `store/collection.ts`), sans quoi il l'écraserait.
- « Annuler » (`useCollectionAction`) rétablit collection et réglages d'avant, et refuse si quelque
  chose a changé depuis : une modification ultérieure n'est jamais effacée.
- Filtres du Pokédex dans l'adresse : `q`, `generation`, `possession` (`owned`, `missing`),
  `illustration` (`card`, `no-card`), `order=desc`.
- `noUncheckedIndexedAccess` est actif ; alias `@/` → `src/` (vite.config.ts, tsconfig.app.json,
  tsconfig.scripts.json, et tsconfig.json pour Bun).

## Déploiement

VPS derrière un tunnel Cloudflare. `Dockerfile` : Bun construit `dist/`, nginx le sert
(`deploy/nginx.conf` : toute route inconnue reçoit `index.html`, le routage étant côté client ;
`/assets/` en cache un an ; `/prices/` toujours revalidé). `compose.yaml` : le site sur
`127.0.0.1:${POKEDEX_PORT:-8080}`, que le tunnel publie, et le service `prices` qui relance
`scripts/prices.ts` toutes les 6 h dans le volume `prices` (l'historique y vit : ne pas supprimer
le volume). `.github/workflows/deploy.yml` : à chaque push sur `main`, SSH sur le VPS,
`git pull --ff-only` puis `docker compose up -d --build`. Marche à suivre complète : README.

## Skills du projet (`.claude/skills/`)

`camply-ui`, `tcgdex-api` (écrits pour ce projet), `vercel-react-best-practices`,
`vercel-composition-patterns` (installés via `npx skills`, verrouillés dans `skills-lock.json`).
