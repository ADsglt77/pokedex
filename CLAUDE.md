# CLAUDE.md

Pokédex personnel de cartes Pokémon **japonaises** : un Pokémon est « débloqué » quand on possède une
de ses pleines cartes dans une rareté suivie (par défaut toutes : SAR, AR, PR, SR, HR, UR, RR…).
React 19 + Vite + TypeScript, UI `@camply/ui`, cartes TCGplayer et TCGdex, espèces PokéAPI, prix
Cardmarket.

## Commandes

Bun est le gestionnaire de paquets (`bun.lock`) — pas npm/pnpm/yarn.

```sh
bun install
bun dev                # serveur Vite (lancé par Bun, pas par Node : `bun --bun vite`)
bun run build          # tsc -b + vite build (pas `bun build`)
bun lint               # ESLint
bun test               # tests de tests/ (logique des achats), relancés par le build Docker
bun run format         # Prettier sur src/, scripts/ et tests/ (les JSON de src/data sont exclus)
bun run data           # régénère src/data (espèces puis cartes), depuis le cache des scripts
bun run data:species   # PokéAPI → species.json, species-details.json ; `--refresh` ignore le cache
bun run data:cards     # TCGplayer + TCGdex → card-index.json ; `--refresh` pour voir les nouvelles cartes
bun run prices         # prix Cardmarket du jour → public/prices (sur le VPS : service `prices`)
```

## Principes

- App **volontairement simple** : pas d'abstraction « au cas où », pas de vérification défensive
  dans les fonctions. On ne contrôle que ce qui vient de l'extérieur : le stockage du navigateur
  et le fichier importé (`lib/transfer.ts`), l'adresse (`lib/filters.ts`), ce que l'utilisateur
  saisit (montants, liens). Factoriser quand une logique sert à deux endroits ou plus.
- Tests : seulement la logique où une erreur coûte de l'argent (`tests/`, `bun test`) : budget,
  registre des commandes, plan de la prochaine commande. Pas de tests d'interface. Le build Docker
  les lance : un test en échec bloque le déploiement.
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
| `src/lib/` | Règles **pures** : `catalog` (données embarquées), `images`, `rarity`, `candidates` (candidates, représentante), `pokedex` (modèle, progression, résumé de la collection), `collection` (modifications), `filters` (adresse, liens filtrés, recherche), `transfer` (export, import, lecture du stockage), `prices` (valeur, coût pour compléter, courbes), `format` ; achats : `wishlist` (préférences, filtres, CSV), `orders` (coût, report sur la collection), `budget` (par mois, par fournisseur), `purchase-planner` (prochaine commande) |
| `src/store/` | Zustand : `collection` (collection + réglages, `localStorage`), `shopping` (liste d'achats, commandes, budget, `localStorage`) et `prices` (`/prices/`) ; `persist` les enregistre et les garde d'accord entre onglets |
| `src/hooks/` | `usePokedex` (modèle partagé par toutes les pages), `useNotify` (toasts + « Annuler »), `usePokedexFilters` |
| `src/components/` | Composants métier partagés par plusieurs pages (carte, tuile, réglette, courbe, réglages d'achat d'une carte…) et les seuls génériques absents de camply (confirmation, en-tête de page, lien externe, champ enregistré en le quittant, `SegmentedField`) ; le reste vient de camply |
| `src/pages/` | Une page par route ; les sous-composants d'une page vivent dans son dossier |
| `tests/` | Tests `bun test` de la logique des achats (`tsconfig.tests.json`) |
| `scripts/` | Construction des données (Bun). `lib/tcgplayer.ts` : la liste des cartes et leur rareté ; `lib/fullArt.ts` : la pleine carte reconnue à l'image ; `lib/tcgdex.ts` : nom japonais, image, Pokémon, id Cardmarket ; `lib/species.ts` : le Pokémon d'après le nom ; `lib/rules.ts` : ce que les sources disent mal (classes vues à l'œil, exclusions, images, espèces) |

Points à connaître :

- L'index (`data:cards`) : toutes les pleines cartes japonaises, déjà classées. Une ligne
  (`CardIndexRow`) porte son code de classe (`rarity: 'AR'`), la base de son image et son id
  Cardmarket ; `lib/catalog.ts` en fait des `PokemonCard`.
  - liste : le catalogue TCGplayer (export de tcgcsv.com ; script côté serveur, User-Agent
    identifié, requêtes une à une et espacées de 100 ms, cache local) : les extensions, et tous
    les decks, coffrets et promos depuis Noir et Blanc (`FULL_ART_SINCE`) ;
  - classe, dans l'ordre (`classOf`, `scripts/cards.ts`) : `FULL_ART_CLASSES` (`lib/rules.ts`, vu
    à l'œil, `null` pour « pas pleine ») ; la rareté, qui suit le code imprimé (son « Ultra Rare »
    est l'or, UR ; `RARITY_CODES` ; pas les UR dorées de Noir et Blanc, `isWindowedGold`) ; les GX
    et V ordinaires en RR, VMAX et VSTAR en RRR (`fullIllustrationClass`) ; jamais une rareté à
    fenêtre (`WINDOWED_RARITIES`) ni un EX, ex ou BREAK ordinaire (`REGULAR_FRAME`) ; sinon
    l'image, classe PR (« pleine carte hors rareté »). Définition validée : comptent les GX, TAG
    TEAM, V, VMAX et VSTAR ordinaires, pas les EX, Méga-EX, ex ni Méga-ex ordinaires ;
  - l'image (`lib/fullArt.ts`) : quatre mesures par vignette TCGplayer (bords de la fenêtre
    d'illustration, fond des attaques), décodée par `jpeg-js`, et une régression logistique
    entraînée à chaque construction sur les cartes que leur rareté classe (le script dit son
    accord avec la rareté, ~99 %). Mesures gardées dans `scripts/.cache/art-measures.json` (la
    première construction télécharge ~15 000 vignettes ; une vignette absente n'est redemandée
    qu'avec `--refresh`). Le script liste les cas douteux (score
    entre 0,5 et 0,75, EX ou ex secret) : les noter dans `FULL_ART_CLASSES`, pleins ou non, puis
    `bun run data:cards`. Une carte à corriger se note de même (id `S-P-227`) ;
  - TCGdex complète chaque carte qu'il a : nom japonais, illustrateur, image, Pokémon (sinon lus
    dans le nom japonais ou anglais, `scripts/lib/species.ts`) et id Cardmarket. Une carte qu'il
    n'a pas garde un id à sa façon (`S4-104`) : s'il la saisit un jour, les statuts suivent ;
  - extensions : celles de TCGdex, plus `TCGPLAYER_SETS` (Noir et Blanc, Shiny Collection, promos…
    et celles dont l'abréviation TCGplayer diffère), plus les autres groupes TCGplayer (decks,
    coffrets), sous leur abréviation (ou `G<groupId>`) et leur nom anglais. Un groupe TCGplayer ne
    sert qu'une fois (« SM1+ » vide chez TCGdex = « SM1p ») ;
  - images : celle de TCGdex ; sinon celle qu'il publie sans la citer, vérifiée à
    `assets.tcgdex.net/ja/<série>/<extension>/<numéro>` (sauf `WRONG_TCGDEX_IMAGES`) ; sinon celle
    de TCGplayer, vérifiée elle aussi. `lib/images.ts` en tire les deux tailles ;
  - le script dit quelles cartes quittent l'index (ce que l'utilisateur en avait noté reste
    enregistré mais ne s'affiche ni ne se compte plus). Les réponses des API restent dans
    `scripts/.cache`, images absentes comprises (un 404 JSON arrête le script ; un 429 ou un 5xx
    n'est jamais gardé). Le cache n'expire pas : `--refresh` redemande tout, et il le faut pour
    voir de nouvelles cartes. Un fichier de `src/data` n'est réécrit que s'il change.
- Prix (`scripts/prices.ts`) : le guide public de Cardmarket, un fichier par jour, relié aux cartes
  par leur id Cardmarket. Il écrit `latest.json` et `history.json` (chaque jour une colonne :
  Cardmarket ne garde pas d'historique ; un historique illisible arrête le script plutôt que d'être
  remplacé). Sans ces fichiers (`bun dev` seul), l'app marche sans prix.
- Collection : un statut par carte (possédée, commandée, souhaitée), le prix payé (`paidPrice`) qui
  le suit, l'illustration choisie par Pokémon. Clés `pokedex-collection.collection` et `.settings`,
  ids `tcgdex:ja:<id>` (et `manual:<uuid>` pour les cartes saisies dans une ancienne version, lues
  dans `customCards`, toujours candidates) : ne pas changer ces formats. Une classe de rareté
  ajoutée n'est suivie que là où aucun réglage n'est enregistré (ailleurs : Données, « Rétablir »).
- Achats (`/achats`), clé `pokedex-collection.shopping` (`ShoppingData`, à part : la collection
  garde son format) :
  - préférence par carte (`accepted` : dans la liste d'achats ; `excluded` : jamais proposée), avec
    priorité, prix maximum, note, lien collé ; indépendante du statut de la carte ;
  - commandes : `applyOrder` (`lib/orders.ts`) reporte chaque enregistrement sur la collection (en
    cours → commandée, reçue → possédée, annulée ou supprimée → l'état d'avant, gardé dans
    `OrderLine.previous`, `previousOf`). Une possession n'est jamais retirée ; le prix payé est le
    prix de revient (port, frais et remboursé répartis au prorata, au centime près). Corriger la
    date de réception corrige la date d'obtention ;
  - budget calculé depuis les commandes : une commande compte une fois, au mois de sa date d'achat,
    remboursé déduit (jamais plus que la commande), rien si annulée. Au-delà du plafond :
    confirmation, jamais de blocage ;
  - l'export contient `shopping` (un export plus ancien, sans lui, s'importe et garde les achats
    en place). Un import demande toujours confirmation ; un fichier abîmé (enregistrement ou bloc
    d'achats illisible) est refusé (`lib/transfer.ts`).
- Deux onglets ouverts restent d'accord : chacun reprend ce que l'autre enregistre (évènement
  `storage`, `store/persist.ts`, pour les trois clés), sans quoi il l'écraserait.
- « Annuler » (`useCollectionAction`) rétablit collection, réglages et achats d'avant, et refuse si
  quelque chose a changé depuis : une modification ultérieure n'est jamais effacée.
- Filtres du Pokédex dans l'adresse : `q`, `generation`, `possession` (`owned`, `missing`),
  `illustration` (`card`, `no-card`), `order=desc` ; un lien filtré se construit avec `pokedexUrl`.
  La recherche passe par `flushSync` (le routeur met l'adresse à jour dans une transition, le champ
  suivrait la frappe en retard) ; la grille, mémoïsée, suit par `useDeferredValue`.
- `noUncheckedIndexedAccess` est actif ; alias `@/` → `src/` (vite.config.ts, tsconfig.base.json
  dont héritent tsconfig.app, .scripts et .tests, et tsconfig.json pour Bun).

## Déploiement

VPS derrière un tunnel Cloudflare. `Dockerfile` : Bun lance les tests puis construit `dist/`, nginx le sert
(`deploy/nginx.conf` : toute route inconnue reçoit `index.html`, le routage étant côté client ;
`/assets/` en cache un an ; `/prices/` toujours revalidé). `compose.yaml` : le site sur
`127.0.0.1:${POKEDEX_PORT:-8080}`, que le tunnel publie, et le service `prices` qui relance
`scripts/prices.ts` toutes les 6 h dans le volume `prices` (l'historique y vit : ne pas supprimer
le volume). `.github/workflows/deploy.yml` : à chaque push sur `main`, SSH sur le VPS (action
épinglée sur un commit, empreinte d'hôte `VPS_FINGERPRINT`), `git pull --ff-only`,
`docker compose build --pull` puis `up -d`. Marche à suivre complète : README.

## Skills du projet (`.claude/skills/`)

`camply-ui`, `tcgdex-api` (écrits pour ce projet), `vercel-react-best-practices`,
`vercel-composition-patterns` (installés via `npx skills`, verrouillés dans `skills-lock.json`).
