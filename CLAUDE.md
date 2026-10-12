# CLAUDE.md

Pokédex personnel de cartes Pokémon **japonaises** : un Pokémon est « débloqué » quand on possède une
de ses pleines cartes dans une rareté suivie (par défaut toutes : SAR, AR, CSR, CHR, PR, SR, HR…).
React 19 + Vite + TypeScript, UI `@camply/ui`, cartes TCGplayer et TCGdex, espèces PokéAPI, prix
Cardmarket.

## Commandes

Bun est le gestionnaire de paquets (`bun.lock`) — pas npm/pnpm/yarn.

```sh
bun install
bun dev                # serveur Vite
bun run build          # tsc -b + vite build (pas `bun build`)
bun lint               # ESLint
bun test               # tests de tests/ (logique des achats)
bun run format         # Prettier sur src/, scripts/ et tests/ (les JSON de src/data sont exclus)
bun run data           # régénère src/data (espèces puis cartes) ; `--refresh` ignore le cache
bun run data:species   # PokéAPI → species.json, species-details.json
bun run data:cards     # TCGplayer + TCGdex → card-index.json (pleines cartes, images, ids Cardmarket)
bun run prices         # prix Cardmarket du jour → public/prices (sur le VPS : service `prices`)
```

## Principes

- App **volontairement simple** : pas d'abstraction « au cas où », pas de vérification défensive
  dans les fonctions. On ne contrôle que ce qui vient de l'extérieur : le stockage du navigateur
  et le fichier importé (`lib/transfer.ts`), l'adresse (`lib/filters.ts`), ce que l'utilisateur
  saisit (montants, liens). Factoriser quand une logique sert à deux endroits ou plus.
- Tests : seulement la logique où une erreur coûte de l'argent (`tests/`, `bun test`) : budget,
  registre des commandes, plan de la prochaine commande. Pas de tests d'interface.
- Le calcul se fait à la construction des données, pas dans l'app : l'index arrive classé.
- UI : **`@camply/ui` d'abord** (skill `camply-ui`), thème camply par défaut (sombre, accent cyan).
  Un composant maison seulement s'il est métier ou absent de la lib.
- Périmètre volontairement réduit : pas d'ajout de carte à la main, d'image personnelle, de
  comparaison ni de fusion à l'import ; aucune API externe appelée par le navigateur. Seule exception :
  les prix, fichiers du site lui-même (`/prices/`). Ne pas réintroduire le reste sans demande.
- Cardmarket : seulement le guide des prix public. Pas de scraping, pas d'API (fermée), pas de
  panier ni de commande à distance. Aucun lien Cardmarket fabriqué : leur format n'a pas pu être
  vérifié (le site bloque les robots) ; l'utilisateur colle lui-même la page d'un produit. Pas
  d'export « Wants » : le format d'import de Cardmarket pour les cartes japonaises n'est pas
  confirmé (un CSV et une liste de recherches à copier le remplacent).
- Textes en français (fr-FR pour nombres et dates), vouvoiement.
- Prettier : pas de point-virgule, guillemets simples, 100 colonnes.

## Architecture

| Dossier | Rôle |
|---|---|
| `src/config/` | Générations, couleurs des types, classes de rareté, achats (budget par défaut, priorités, fournisseurs) : configuration, pas de logique |
| `src/data/` | JSON écrits par `bun run data` : espèces, détails, index des cartes déjà classées |
| `src/lib/` | Règles **pures** : `catalog` (données embarquées), `images`, `rarity`, `candidates` (candidates, représentante), `pokedex` (modèle + progression), `collection` (modifications), `filters` (adresse + recherche), `transfer` (export, import, lecture du stockage), `prices` (valeur, coût pour compléter, courbes), `format` ; achats : `wishlist` (préférences, filtres, CSV), `orders` (coût, report sur la collection), `budget` (par mois, par fournisseur), `purchase-planner` (prochaine commande) |
| `src/store/` | Zustand : `collection` (collection + réglages, `localStorage`), `shopping` (liste d'achats, commandes, budget, `localStorage`) et `prices` (`/prices/`) |
| `src/hooks/` | `usePokedex` (modèle partagé par toutes les pages), `useNotify` (toasts + « Annuler »), `usePokedexFilters` |
| `src/components/` | Composants métier partagés (carte, tuile, réglette, courbe, champ enregistré en le quittant, réglages d'achat d'une carte…) ; le reste vient de camply |
| `src/pages/` | Une page par route ; les sous-composants d'une page vivent dans son dossier |
| `tests/` | Tests `bun test` de la logique des achats (`tsconfig.tests.json`) |
| `scripts/` | Construction des données (Bun). `lib/tcgplayer.ts` : la liste des cartes et leur rareté ; `lib/tcgdex.ts` : nom japonais, image, Pokémon, id Cardmarket ; `lib/species.ts` : le Pokémon d'après le nom ; `lib/rules.ts` : ce que les sources disent mal (promos, exclusions, images, espèces) |

Points à connaître :

- L'index (`data:cards`) : toutes les pleines cartes japonaises, déjà classées. Une ligne
  (`CardIndexRow`) porte son code de classe (`rarity: 'AR'`), la base de son image et son id
  Cardmarket ; `lib/catalog.ts` en fait des `PokemonCard`.
  - liste et classe : le catalogue TCGplayer (export de tcgcsv.com ; script côté serveur,
    User-Agent identifié, requêtes une à une et espacées de 100 ms, cache local). Sa rareté suit
    le code imprimé (son « Ultra Rare » est l'or, UR ; table `RARITY_CODES`). Pas une pleine carte :
    les UR dorées de Noir et Blanc (`isWindowedGold`) ;
  - promos : aucune rareté ne les signale. `FULL_ART_PROMO_IDS` (classe `PR`) les liste, choisies
    à la vue. Pour en ajouter une : son id (`S-P-227`), puis `bun run data:cards` ;
  - TCGdex complète chaque carte qu'il a : nom japonais, illustrateur, image, Pokémon (sinon lus
    dans le nom japonais ou anglais, `scripts/lib/species.ts`) et id Cardmarket. Une carte qu'il
    n'a pas garde un id à sa façon (`S4-104`) : s'il la saisit un jour, les statuts suivent ;
  - extensions : celles de TCGdex, plus `TCGPLAYER_SETS` (Noir et Blanc, Shiny Collection, promos…
    et celles dont l'abréviation TCGplayer diffère). Un groupe TCGplayer ne sert qu'une fois
    (« SM1+ » vide chez TCGdex = « SM1p ») ;
  - images : celle de TCGdex ; sinon celle qu'il publie sans la citer, vérifiée à
    `assets.tcgdex.net/ja/<série>/<extension>/<numéro>` (sauf `WRONG_TCGDEX_IMAGES`) ; sinon celle
    de TCGplayer, vérifiée elle aussi. `lib/images.ts` en tire les deux tailles ;
  - le script dit quelles cartes quittent l'index (ce que l'utilisateur en avait noté ne s'affiche
    plus). Les réponses des API restent dans `scripts/.cache`, réponses négatives comprises
    (`--refresh` redemande tout) ; un fichier de `src/data` n'est réécrit que s'il change.
- Prix (`scripts/prices.ts`) : le guide public de Cardmarket, un fichier par jour, relié aux cartes
  par leur id Cardmarket. Il écrit `latest.json` et `history.json` (chaque jour une colonne :
  Cardmarket ne garde pas d'historique ; un historique illisible arrête le script plutôt que d'être
  remplacé). Sans ces fichiers (`bun dev` seul), l'app marche sans prix.
- Collection : un statut par carte (possédée, commandée, souhaitée), le prix payé (`paidPrice`) qui
  le suit, l'illustration choisie par Pokémon. Clés `pokedex-collection.collection` et `.settings`,
  ids `tcgdex:ja:<id>` (et `manual:<uuid>` pour les cartes saisies dans une ancienne version, lues
  dans `customCards`, toujours candidates) : ne pas changer ces formats.
- Achats (`/achats`), clé `pokedex-collection.shopping` (`ShoppingData`, à part : la collection
  garde son format) :
  - préférence par carte (`accepted` : dans la liste d'achats ; `excluded` : jamais proposée), avec
    priorité, prix maximum, note, lien collé ; indépendante du statut de la carte ;
  - commandes : `applyOrder` (`lib/orders.ts`) reporte chaque enregistrement sur la collection (en
    cours → commandée, reçue → possédée, annulée ou supprimée → l'état d'avant, gardé dans
    `OrderLine.previous`, `previousOf`). Une possession n'est jamais retirée ; le prix payé est le
    prix de revient (port et frais répartis au prorata, au centime près) ;
  - budget calculé depuis les commandes : une commande compte une fois, au mois de sa date d'achat,
    remboursé déduit, rien si annulée. Au-delà du plafond : confirmation, jamais de blocage ;
  - l'export contient `shopping` (un export plus ancien, sans lui, s'importe et garde les achats
    en place). Un import demande toujours confirmation.
- Deux onglets ouverts restent d'accord : chacun reprend ce que l'autre enregistre (évènement
  `storage` dans `store/collection.ts` et `store/shopping.ts`), sans quoi il l'écraserait.
- « Annuler » (`useCollectionAction`) rétablit collection, réglages et achats d'avant, et refuse si
  quelque chose a changé depuis : une modification ultérieure n'est jamais effacée.
- Filtres du Pokédex dans l'adresse : `q`, `generation`, `possession` (`owned`, `missing`),
  `illustration` (`card`, `no-card`), `order=desc`.
- `noUncheckedIndexedAccess` est actif ; alias `@/` → `src/` (vite.config.ts, tsconfig.app.json,
  tsconfig.scripts.json, tsconfig.tests.json, et tsconfig.json pour Bun).

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
