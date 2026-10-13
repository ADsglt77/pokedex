# CLAUDE.md

Pokédex personnel de cartes Pokémon **japonaises** : les 1 025 Pokémon, et pour chacun la carte que
l'utilisateur veut, qu'il ajoute lui-même (sa référence, d'où son image est retrouvée, et son id
Cardmarket pour le prix), souvent depuis Cardmarket avec le favori « Ajouter au Pokédex ». Un
Pokémon est « débloqué » quand sa carte est possédée. React 19 + Vite + TypeScript, UI
`@camply/ui`, espèces PokéAPI, images Pokécardex, prix Cardmarket.

## Commandes

Bun est le gestionnaire de paquets (`bun.lock`) — pas npm/pnpm/yarn.

```sh
bun install
bun dev                # serveur Vite (lancé par Bun, pas par Node : `bun --bun vite`)
bun run build          # tsc -b + vite build (pas `bun build`)
bun lint               # ESLint
bun test               # tests de tests/ (logique des achats), relancés par le build Docker
bun run format         # Prettier sur src/, scripts/ et tests/ (les JSON de src/data sont exclus)
bun run data           # PokéAPI → src/data (species.json, species-details.json) ; `--refresh` ignore le cache
bun run prices         # prix Cardmarket du jour → prices/, servi par `bun dev` (sur le VPS : service `prices`)
```

## Principes

- App **volontairement simple** : pas d'abstraction « au cas où », pas de vérification défensive
  dans les fonctions. On ne contrôle que ce qui vient de l'extérieur : le stockage du navigateur
  et le fichier importé (`lib/transfer.ts`), l'adresse (`lib/filters.ts`), ce que l'utilisateur
  saisit (montants, liens, adresse d'image, id Cardmarket). Factoriser quand une logique sert à
  deux endroits ou plus.
- Tests : seulement la logique où une erreur coûte de l'argent (`tests/`, `bun test`) : budget,
  registre des commandes, plan de la prochaine commande. Pas de tests d'interface. Le build Docker
  les lance : un test en échec bloque le déploiement.
- Les cartes viennent de l'utilisateur, une par Pokémon : **aucune** liste de cartes embarquée,
  aucune recherche ou détection de carte (TCGplayer, catalogue, détection des pleines cartes :
  retirés à sa demande). Seule aide, ajoutée à sa demande : l'image, retrouvée chez Pokécardex
  d'après la référence. Pokécardex a donné son autorisation (octobre 2026), en échange d'un lien
  vers son site sous chaque image qui vient de lui. Pas de scraping : l'adresse de l'image se
  déduit de la référence, ses pages (aux données chiffrées) ne sont pas lues. TCGdex et Limitless
  TCG, essayés un temps, ont été retirés : seulement des cartes japonaises. Ne pas réintroduire
  le reste sans demande.
- UI : **`@camply/ui` d'abord** (skill `camply-ui`), thème camply par défaut (sombre, accent cyan).
  Un composant maison seulement s'il est métier ou absent de la lib.
- Périmètre volontairement réduit : pas d'image téléversée (on colle une adresse), pas de
  comparaison ni de fusion à l'import ; aucune API externe appelée par le navigateur. Seules
  exceptions : les images (dessins des Pokémon chez PokéAPI, cartes chez Pokécardex ou à
  l'adresse collée), et les prix, fichiers du site lui-même (`/prices/`).
- Cardmarket : seulement les fichiers publics (guide des prix, liste des produits). Pas de
  scraping, pas d'API (fermée), pas de panier ni de commande à distance. Aucun lien ni adresse
  Cardmarket fabriqué ou deviné : leur format n'a pas pu être vérifié (le site bloque les robots) ;
  l'utilisateur colle lui-même la page d'un produit et son id, ou les prend avec le favori, qui lit
  la page qu'il a ouverte dans son navigateur. Les images de Cardmarket ne s'affichent que sur son
  site (son serveur refuse les autres) : refusées comme image de carte. Pas d'export « Wants » : le
  format d'import de Cardmarket pour les cartes japonaises n'est pas confirmé (un CSV et une liste
  de recherches à copier le remplacent).
- Textes en français (fr-FR pour nombres et dates), vouvoiement.
- Prettier : pas de point-virgule, guillemets simples, 100 colonnes.

## Architecture

| Dossier | Rôle |
|---|---|
| `src/config/` | Générations, couleurs des types, achats (budget par défaut, niveaux de budget, priorités, fournisseurs) : configuration, pas de logique |
| `src/data/` | JSON écrits par `bun run data` : les espèces et leurs détails (chargés à la demande) |
| `src/lib/` | Règles **pures** : `catalog` (espèces, carte d'un id), `cardmarket` (page et id saisis, ce que le favori envoie, code du favori), `card-images` (l'image d'une carte chez Pokécardex d'après sa référence), `pokedex` (modèle : la carte de chaque Pokémon, progression, résumé), `collection` (modifications : statut, prix payé, ajout et retrait d'une carte), `filters` (adresse, liens filtrés, recherche), `transfer` (export, import, lecture du stockage), `prices` (prix d'une carte, valeur, coût pour compléter, courbes), `format` ; achats : `wishlist` (préférences, filtres, CSV), `orders` (coût, report sur la collection), `budget` (par mois, par fournisseur), `purchase-planner` (prochaine commande) |
| `src/store/` | Zustand : `collection` et `shopping` (liste d'achats, commandes, budget), dans `localStorage` ; `prices` (`/prices/`). `persist` les enregistre et les garde d'accord entre onglets |
| `src/hooks/` | `usePokedex` (modèle partagé par toutes les pages), `useNotify` (toasts + « Annuler »), `usePokedexFilters`, `useCardDraft` (saisie d'une carte) |
| `src/components/` | Composants métier partagés par plusieurs pages (carte, champs d'une carte, tuile, réglette, courbe, réglages d'achat d'une carte…) et les seuls génériques absents de camply (confirmation, en-tête de page, lien externe, champ enregistré en le quittant, `SegmentedField`) ; le reste vient de camply |
| `src/pages/` | Une page par route ; les sous-composants d'une page vivent dans son dossier (`pokemon/CardForm` : ajouter ou corriger la carte d'un Pokémon ; `AddCardPage` : `/ajouter`, ouverte par le favori) |
| `tests/` | Tests `bun test` de la logique des achats (`tsconfig.tests.json`) |
| `scripts/` | Bun : `species.ts` (PokéAPI → `src/data`, avec `lib/net.ts` : cache disque, requêtes espacées, et `lib/dataFile.ts`) et `prices.ts` (prix Cardmarket) |

Points à connaître :

- Une carte (`PokemonCard`) : id `manual:<uuid>`, ses Pokémon (`dexIds`), une référence (vide à la
  saisie : le nom de la carte chez Cardmarket, sinon le nom du Pokémon), son image (`image` :
  celle de Pokécardex, en deux tailles, ou l'adresse collée, `small` = `large` ; `null` sans image),
  son id Cardmarket (`cardmarket`) et sa page chez Cardmarket (`page`), tous deux facultatifs.
  Une par Pokémon : on la corrige (« Modifier la carte », même id, son statut et ses achats la
  suivent) ou on la retire (« Retirer la carte » : avec son statut, son prix payé et sa préférence
  d'achat ; impossible tant qu'une commande la contient) avant d'en ajouter une autre. Si une
  ancienne version en a gardé plusieurs, la première compte.
- Favori « Ajouter au Pokédex » (`bookmarklet`, page Données) : un lien `javascript:` à glisser
  dans la barre de favoris (React refuse ces adresses en attribut : il est posé par une `ref`).
  Sur une page produit de Cardmarket, il lit l'id (`input[name="idProduct"]`), le nom et
  l'extension (le `h1` et son `span`) et l'adresse de la page, puis ouvre
  `/ajouter?cardmarket=…&nom=…&extension=…&page=…` sur l'app d'où il a été installé. `/ajouter`
  relit ces paramètres comme une saisie (`readCardmarketCard`), devine le Pokémon d'après le nom
  (`speciesInName`, modifiable) et n'ajoute rien à un Pokémon qui a déjà sa carte. Page vérifiée
  en octobre 2026 : si Cardmarket la change, le favori affiche son message d'aide.
- Images (`lib/card-images.ts`) : la référence finit par le code de l'extension et le numéro,
  comme Cardmarket les écrit (« Bulbizarre (sv2a 166) ») ; sans parenthèses, le code doit avoir un
  chiffre (« SV4a 349 »). `cardImage` en déduit l'adresse chez Pokécardex :
  `pokecardex-scans.b-cdn.net/sets_jp/SV2A/6.jpg?class=md` (code en majuscules sans tiret, SV-P
  → SVP ; numéro sans zéro ; tailles `md` pour la grille, `hd` pour la fiche). Elle n'est pas
  sûre : `findCardImage` vérifie qu'elle se charge, la saisie le dit, et la fiche cite
  Pokécardex sous la carte (`isPokecardexImage`). Un échec est redemandé à l'enregistrement
  (panne passagère), et une image déjà enregistrée reste si Pokécardex ne répond pas. Une image
  enregistrée d'ailleurs (adresse collée, ancienne source) s'affiche toujours, sans crédit. Sans
  adresse collée, l'image suit la référence (cherchée en quittant le champ). Données : « Chercher
  les images » pour les cartes sans image. Pour deviner le Pokémon (`speciesInName`), le « (code
  numéro) » final est ignoré : « Énergie (MEW 207) » n'est pas Mew.
- Prix (`scripts/prices.ts`) : le guide des prix public de Cardmarket et sa liste des produits
  (pour les noms), une fois par jour, seulement les cartes à l'unité (catégorie 51). Il écrit
  `latest.json` (le prix du jour de chaque carte : `[prix, plus bas, moyenne 30 jours]`, par id
  Cardmarket) et `history/<id>.json` (son nom et un prix par jour depuis `from` : Cardmarket ne
  garde pas d'historique ; un historique illisible arrête le script plutôt que d'être remplacé ;
  il n'est réécrit que si le prix du jour change). L'app charge `latest.json` au premier écran
  qui affiche un prix (pas l'accueil ni le Pokédex), et l'historique d'une carte à la demande : la
  courbe, le nom affiché dans le formulaire pour vérifier l'id saisi (au départ du champ). Sans
  ces fichiers, l'app marche sans prix. En développement,
  `prices/` est servi à `/prices/` par un petit middleware (`vite.config.ts`) : dans `public/`,
  ses dizaines de milliers de fichiers bloqueraient Vite, qui ne surveille pas ce dossier.
- Collection : un statut par carte (possédée, commandée, souhaitée), le prix payé (`paidPrice`) qui
  le suit, et les cartes (`customCards`). Clé `pokedex-collection.collection` : ne pas changer son
  format. Ce qu'une ancienne version y gardait en plus (`entries` des illustrations choisies, clé
  `.settings` des raretés suivies, statuts des cartes `tcgdex:ja:…` de l'ancien index) est ignoré.
- Achats (`/achats`), clé `pokedex-collection.shopping` (`ShoppingData`, à part : la collection
  garde son format) :
  - préférence par carte (`accepted` : dans la liste d'achats ; `excluded` : jamais proposée), avec
    priorité, prix maximum, note ; indépendante du statut de la carte (le lien vers Cardmarket
    est la `page` de la carte) ;
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
  `storage`, `store/persist.ts`, pour les deux clés), sans quoi il l'écraserait. Si le navigateur
  refuse de lire ou d'écrire (stockage plein ou bloqué), l'app continue en mémoire et un bandeau
  (`useStorageFailure`, `AppShell`) invite à exporter.
- « Annuler » (`useCollectionAction`) rétablit collection et achats d'avant, et refuse si quelque
  chose a changé depuis : une modification ultérieure n'est jamais effacée.
- Filtres du Pokédex dans l'adresse : `q`, `generation`, `possession` (`owned`, `missing`),
  `illustration` (`card` : avec carte, `no-card` : sans), `order=desc` ; un lien filtré se
  construit avec `pokedexUrl`. La recherche passe par `flushSync` (le routeur met l'adresse à jour
  dans une transition, le champ suivrait la frappe en retard) ; la grille, mémoïsée, suit par
  `useDeferredValue`.
- `noUncheckedIndexedAccess` est actif ; alias `@/` → `src/` (vite.config.ts, tsconfig.base.json
  dont héritent tsconfig.app, .scripts et .tests, et tsconfig.json pour Bun).

## Déploiement

VPS derrière un tunnel Cloudflare. `Dockerfile` : Bun lance les tests puis construit `dist/`,
nginx le sert (`deploy/nginx.conf` : une route inconnue reçoit `index.html`, le routage étant côté
client ; un fichier manquant de `/assets/` ou `/prices/` répond 404 ; `/assets/` en cache un an ;
`/prices/` toujours revalidé, compressé). `compose.yaml` : le site sur
`127.0.0.1:${POKEDEX_PORT:-8080}`, que le tunnel publie, et le service `prices` qui relance
`scripts/prices.ts` toutes les 6 h (10 min après un échec) dans le volume `prices` (l'historique
de chaque carte y vit, un fichier par carte : ne pas supprimer le volume).
`.github/workflows/deploy.yml` : à chaque push sur `main`, SSH sur le VPS (action épinglée sur un
commit, empreinte d'hôte `VPS_FINGERPRINT`), `git pull --ff-only`, `docker compose build --pull`
puis `up -d`. Marche à suivre complète : README.

## Skills du projet (`.claude/skills/`)

`camply-ui` (écrit pour ce projet), `vercel-react-best-practices`, `vercel-composition-patterns`
(installés via `npx skills`, verrouillés dans `skills-lock.json`).
