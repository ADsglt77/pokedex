# CLAUDE.md

Pokédex personnel de cartes Pokémon **japonaises** : les 1 025 Pokémon, et pour chacun la carte que
l'utilisateur veut, qu'il choisit lui-même : dans le catalogue des cartes japonaises de chaque
Pokémon, depuis Cardmarket avec le favori « Ajouter au Pokédex », ou à la main (sa référence, d'où
son image est retrouvée, et son id Cardmarket pour le prix). Un Pokémon est « débloqué » quand sa
carte est possédée. React 19 + Vite + TypeScript, UI `@camply/ui`, espèces PokéAPI, catalogue
TCGdex, images Pokécardex (sinon TCGplayer), prix Cardmarket (sinon TCGplayer).

## Commandes

Bun est le gestionnaire de paquets (`bun.lock`) — pas npm/pnpm/yarn.

```sh
bun install
bun dev                # serveur Vite (lancé par Bun, pas par Node : `bun --bun vite`) ; voir « Sous Windows » plus bas
bun run build          # tsc -b + vite build (pas `bun build`)
bun lint               # ESLint
bun test               # tests de tests/ (logique des achats), relancés par le build Docker
bun run format         # Prettier sur src/, scripts/ et tests/ (les JSON de src/data sont exclus)
bun run data           # src/data : data:species puis data:catalog (sans --refresh : Bun ne le passerait qu'au dernier)
bun run data:species   # PokéAPI → species.json, species-details.json ; `--refresh` ignore le cache
bun run data:catalog   # TCGdex → catalog.json ; `--refresh` pour les nouvelles cartes et les nouveaux id Cardmarket
bun run prices         # prix du jour (Cardmarket, TCGplayer) → prices/, servi par `bun dev` (sur le VPS : service `prices`)
```

## Principes

- App **volontairement simple** : pas d'abstraction « au cas où », pas de vérification défensive
  dans les fonctions. On ne contrôle que ce qui vient de l'extérieur : le stockage du navigateur
  et le fichier importé (`lib/transfer.ts`), l'adresse (`lib/filters.ts`), ce que l'utilisateur
  saisit (montants, liens, adresse d'image, id Cardmarket). Factoriser quand une logique sert à
  deux endroits ou plus.
- Tests : seulement la logique où une erreur coûte de l'argent (`tests/`, `bun test`) : budget,
  registre des commandes, plan de la prochaine commande, import (un montant mal lu fausserait le
  budget), prix d'une carte (le plan le lit : jamais celui d'une autre). Pas de tests d'interface. Le build Docker
  les lance : un test en échec bloque le déploiement.
- Les cartes viennent de l'utilisateur, une par Pokémon, qu'il **choisit** : aucune détection ni
  classement automatique (l'ancien index TCGplayer et la détection des pleines cartes ont été
  retirés à sa demande). Aides, ajoutées à sa demande : le catalogue des cartes japonaises de
  chaque Pokémon (TCGdex : extension, numéro, id Cardmarket ; toutes ses cartes Pokémon, sans
  filtre de rareté), et l'image, retrouvée chez Pokécardex d'après la référence. Pokécardex a
  donné son autorisation (octobre 2026), en échange d'un lien vers son site : sous la carte de la
  fiche, sous l'aperçu de la saisie, en tête de la grille du catalogue et dans le pied de page.
  Pas de scraping : l'adresse de l'image se déduit de la référence, ses pages (aux données
  chiffrées) ne sont pas lues. Quand Pokécardex n'a pas l'image (vieilles séries, decks), celle
  du produit TCGplayer que le catalogue relie à la carte, citée de même (à sa demande, octobre
  2026 : seulement l'image, la liste reste celle de TCGdex), et son prix pour une carte sans prix
  Cardmarket (à sa demande, octobre 2026). Seulement des cartes japonaises
  (images TCGdex et Limitless TCG retirées). Ne pas réintroduire le reste sans demande. En
  attente : l'utilisateur a demandé à Pokécardex l'accès à sa liste de cartes (TCGdex n'en a
  qu'environ la moitié : 11 Herbizarre sur 27).
- UI : **`@camply/ui` d'abord** (skill `camply-ui`), thème camply par défaut (sombre, accent cyan).
  Un composant maison seulement s'il est métier ou absent de la lib.
- Périmètre volontairement réduit : pas d'image téléversée (on colle une adresse), pas de
  comparaison ni de fusion à l'import ; aucune API externe appelée par le navigateur. Seules
  exceptions : les images (dessins des Pokémon chez PokéAPI, cartes chez Pokécardex, TCGplayer ou
  à l'adresse collée), et les prix, fichiers du site lui-même (`/prices/`).
- Cardmarket : seulement les fichiers publics (guide des prix, liste des produits). Pas de
  scraping, pas d'API (fermée), pas de panier ni de commande à distance. Un seul lien Cardmarket
  construit : la page d'un produit par son id (`cardmarketPage` :
  `/fr/Pokemon/Products?idProduct=…`, vérifié par l'utilisateur en octobre 2026, le site bloquant
  les robots ;
  `/Products/Singles?idProduct=` ne marche pas). Aucune autre adresse devinée. La page exacte vient
  du favori, qui lit la page ouverte dans le navigateur, ou d'une adresse collée. Les images de
  Cardmarket ne s'affichent que sur son site (son serveur refuse les autres) : refusées comme image
  de carte. Pas d'export « Wants » : le format d'import de Cardmarket pour les cartes japonaises
  n'est pas confirmé (un CSV et une liste de recherches à copier le remplacent).
- Textes en français (fr-FR pour nombres et dates), vouvoiement. Un Pokémon dont la carte n'est
  pas possédée est « à débloquer » (pas « manquant », « à trouver » ni « à obtenir »).
- Prettier : pas de point-virgule, guillemets simples, 100 colonnes.

## Architecture

| Dossier | Rôle |
|---|---|
| `src/config/` | Générations, couleurs des types, achats (budget par défaut, niveaux de budget, priorités, fournisseurs) : configuration, pas de logique |
| `src/data/` | JSON écrits par `bun run data` : les espèces, leurs détails et le catalogue des cartes japonaises (ces deux derniers chargés à la demande) |
| `src/lib/` | Règles **pures** : `species` (espèces, carte d'un id), `cardmarket` (page et id saisis, ce que le favori envoie, code du favori), `card-code` (le code d'une carte dans sa référence, sa clé ; sans import, `prices.ts` s'en sert), `card-images` (l'image d'une carte chez Pokécardex d'après sa référence, celle de TCGplayer, d'où vient une image), `card-catalog` (les cartes japonaises d'un Pokémon, la carte d'une référence), `pokedex` (modèle : la carte de chaque Pokémon, progression, résumé), `collection` (modifications : statut, prix payé, ajout et retrait d'une carte), `filters` (adresse, liens filtrés, recherche), `transfer` (export, import, CSV, lecture du stockage), `prices` (prix d'une carte, Cardmarket sinon TCGplayer, valeur, coût pour compléter, courbes, plus fortes hausses et baisses : `priceMovers`), `format`, `settled` (une promesse que `use()` lit sans attendre) ; achats : `wishlist` (préférences, filtres, CSV de la liste), `orders` (coût, report sur la collection, doublons, commandes en retard), `budget` (par mois, par fournisseur), `purchase-planner` (prochaine commande) |
| `src/store/` | Zustand : `collection` et `shopping` (liste d'achats, commandes, budget), dans `localStorage` ; `prices` (`/prices/`). `persist` les enregistre et les garde d'accord entre onglets |
| `src/hooks/` | `usePokedex` (modèle partagé par toutes les pages), `useNotify` (toasts + « Annuler »), `usePokedexFilters`, `useCardDraft` (saisie d'une carte) |
| `src/components/` | Composants métier partagés par plusieurs pages (carte, champs d'une carte, tuile, réglette, courbe, réglages d'achat d'une carte…) et les seuls génériques absents de camply (confirmation, en-tête de page, lien externe, crédit d'une image, champ enregistré en le quittant, `SegmentedField`) ; le reste vient de camply |
| `src/pages/` | Une page par route ; les sous-composants d'une page vivent dans son dossier (`pokemon/CardForm` : ajouter ou corriger la carte d'un Pokémon ; `AddCardPage` : `/ajouter`, ouverte par le favori) |
| `tests/` | Tests `bun test` de la logique des achats (`tsconfig.tests.json`) |
| `scripts/` | Bun : `species.ts` (PokéAPI → `src/data`, avec `lib/net.ts` : cache disque, requêtes espacées, et `lib/dataFile.ts`), `catalog.ts` (TCGdex → `src/data`, avec `lib/tcgplayer.ts` : le produit TCGplayer de chaque carte, pour son image) et `prices.ts` (prix Cardmarket et TCGplayer) |

Points à connaître :

- Une carte (`PokemonCard`) : id `manual:<uuid>`, ses Pokémon (`dexIds`), une référence (vide à la
  saisie : le nom de la carte chez Cardmarket, sinon le nom du Pokémon), son image (`image` :
  celle de Pokécardex ou de TCGplayer, en deux tailles, ou l'adresse collée, `small` = `large` ;
  `null` sans image),
  son id Cardmarket (`cardmarket`) et sa page chez Cardmarket (`page`), tous deux facultatifs ;
  sans page notée, le lien « Voir sur Cardmarket » se fait par l'id (`cardmarketPage`).
  Une par Pokémon : on la corrige (« Modifier la carte », même id, son statut et ses achats la
  suivent) ou on la retire (« Retirer la carte » : avec son statut, son prix payé et sa préférence
  d'achat ; confirmation si elle est possédée ; impossible tant qu'une commande la contient) avant
  d'en ajouter une autre. Si une ancienne version en a gardé plusieurs, la première compte.
  « Souhaitée » (statut) et « À acheter » (liste d'achats) sont indépendants : la fiche le dit.
- Catalogue (`scripts/catalog.ts` → `catalog.json`, `lib/card-catalog.ts`) : les cartes Pokémon
  japonaises de TCGdex (une requête GraphQL pour la liste, puis l'id Cardmarket carte par carte,
  gardé en cache : le premier passage prend un quart d'heure). Par Pokémon, des plus récentes aux
  plus anciennes : `[extension, numéro, id Cardmarket (0 : inconnu ou douteux), suffixe, produit
  TCGplayer (0 : aucun), Pokémon s'ils sont plusieurs]`. L'id de TCGdex est vérifié : partagé par
  plusieurs cartes, ou d'un autre Pokémon dans la liste publique des produits de Cardmarket (nom
  anglais, `speciesInName`, attaques ôtées ; en cache, `--refresh` la renouvelle), il est retiré
  (16 en octobre 2026). Le Pokémon vient de TCGdex ; quand il n'en donne pas
  (des ex récentes…), de la correspondance exacte du nom japonais avec `species.json`
  (`speciesOf`) : les cartes sans correspondance sont laissées de côté, et le script les compte.
  Le produit TCGplayer (`scripts/lib/tcgplayer.ts`, export de tcgcsv.com, requêtes une à une, User-
  Agent identifié, cache) : dans le groupe de l'extension (même code, sinon `GROUPS` pour les
  vieilles séries et les decks), le même numéro ; sans numéros (1996-2001), le seul produit du
  Pokémon (« (Lv.13) » et « (Lv.15) » : deux cartes, aucune n'en a). Toujours du même Pokémon et sans ambiguïté, sinon aucun (MC, numéroté deck par deck
  chez TCGplayer, n'en a pas). « Ajouter une carte »
  (`pokemon/CardForm`) s'ouvre sur l'onglet « Cartes japonaises » (`CatalogPicker` : image
  Pokécardex sinon TCGplayer, code, prix du jour, tri par date ou par prix ; ses réglages vivent
  dans `CardForm`, l'onglet caché étant démonté) ; choisir une carte remplit la saisie (`fill` :
  référence « Pikachu ex (SV8 033) », image de secours, id, d'où l'image, le prix et le lien
  Cardmarket) et y mène le focus ; on la vérifie puis l'enregistre (« Enregistrer » attend que la
  carte soit choisie, ou l'onglet de saisie). « Modifier la carte » n'a que la saisie : choisir une autre carte, ce serait
  lui transmettre le statut, le prix payé et les commandes de celle-ci. Le catalogue n'est qu'une
  aide : la carte enregistrée est une carte saisie comme les autres (`manual:<uuid>`).
  L'enregistrement (`useCardDraft.save`) attend le prix et l'image : une seule fois à la fois, la
  fenêtre ne se ferme pas pendant ce temps. Une page Cardmarket qui n'était que celle de l'id de
  départ est oubliée quand l'id change (le lien suit alors le nouvel id). La page Catalogue
  (`/catalogue?set=…`, dans le menu) : une extension, cherchée par code ou nom (`Combobox`), les
  plus récentes ou les plus utiles d'abord (celles qui donnent leur carte au plus de Pokémon qui
  n'en ont pas) ; un clic donne la carte au premier de ses Pokémon sans carte, sans statut,
  possédée ou à acheter (« Ajouter comme »), et le focus passe à la carte suivante.
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
  sûre : `findCardImage` vérifie qu'elle se charge (sans réponse en 10 s : absente, pour ne pas
  bloquer l'enregistrement), la saisie le dit, et la fiche et l'aperçu
  citent sa source sous la carte (`imageSource`, `ImageCredit`). Un échec est redemandé à
  l'enregistrement (panne passagère), et une image déjà enregistrée reste si Pokécardex ne répond
  pas. Sans image chez Pokécardex, celle du produit TCGplayer de la carte du catalogue
  (`tcgplayerImage`, 200 px pour la grille) : dans la grille (`CardArt`, `fallback`, quand
  l'image ne se charge pas), et à l'enregistrement tant que la référence reste celle de la carte
  choisie. Une image enregistrée d'ailleurs (adresse collée, ancienne source) s'affiche toujours,
  sans crédit. Sans adresse collée, l'image suit la référence (cherchée en quittant le champ).
  Données : « Chercher les images » pour les cartes sans image (Pokécardex, sinon TCGplayer
  d'après la référence, `catalogCard`). Pour deviner le Pokémon (`speciesInName`), le « (code
  numéro) » final est ignoré : « Énergie (MEW 207) » n'est pas Mew. Le code d'une carte
  (`lib/card-code.ts`) : `codeKey` en fait une clé (« SV2A 166 », « E1 97 » : extension en
  majuscules sans tiret, numéro sans zéro), pour retrouver la carte du catalogue et son prix
  TCGplayer.
- Prix (`scripts/prices.ts`) : le guide des prix public de Cardmarket et sa liste des produits
  (pour les noms), une fois par jour, seulement les cartes à l'unité (catégorie 51). Il écrit
  `latest.json` (le prix du jour de chaque carte : `[prix, plus bas, moyenne 30 jours]`, par id
  Cardmarket) et `history/<id>.json` (son nom et un prix par jour depuis `from` : Cardmarket ne
  garde pas d'historique ; un historique illisible n'est jamais remplacé : il est laissé tel quel
  et signalé, sans arrêter les autres ; il n'est réécrit que si le prix du jour change). Rien
  n'est retéléchargé (29 Mo) tant que le guide n'a pas changé depuis le dernier passage complet,
  que date `latest.json`, écrit en dernier (le supprimer force un passage). L'app charge
  `latest.json` au premier écran
  qui affiche un prix (pas l'accueil ni le Pokédex), et l'historique d'une carte à la demande : la
  courbe, le nom affiché dans le formulaire pour vérifier l'id saisi (au départ du champ). Sans
  ces fichiers, l'app marche sans prix. Un fichier manquant (404) n'est pas redemandé ; après une
  panne passagère (réseau, délai, réponse illisible), il l'est la fois suivante où il sert, au plus
  une fois par minute (`store/prices.ts`). Pour les cartes du catalogue sans prix Cardmarket :
  sans id (près de 2 000 : séries de 1996 à 2006, decks ; Cardmarket les vend, mais ses fichiers ne
  disent ni l'extension ni le numéro : les relier serait deviner) ou dont l'id n'a pas de prix
  dans le guide du jour (environ 300 : promos SM, MC…), `tcgplayer.json` : le prix de leur produit TCGplayer
  (export de tcgcsv.com, une requête par groupe, ceux que `catalog.json` note pour chaque
  extension), la moins chère de ses impressions (prix du marché, sinon plus basse annonce),
  converti en euros au cours du jour de la BCE, par `codeKey`. Écrit après `latest.json`, qu'il
  lit ; retéléchargé quand tcgcsv (`last-updated.txt`), le catalogue ou `latest.json` ont changé.
  `priceOf` le prend pour une carte sans prix Cardmarket ce jour (pas d'id, ou pas de prix pour
  cet id), d'après le code de sa référence (`source: 'tcgplayer'`, pas de moyenne 30 jours ; la
  courbe reste celle de Cardmarket s'il y a un id) : partout comme un prix Cardmarket (valeur, liste d'achats, plan), toujours signalé
  « TCGplayer » à côté du montant. Une source en échec n'empêche pas l'autre (TCGplayer lit alors
  le `latest.json` d'avant). En développement,
  `prices/` est servi à `/prices/` par un petit middleware (`vite.config.ts`) : dans `public/`,
  ses dizaines de milliers de fichiers bloqueraient Vite, qui ne surveille pas ce dossier.
- Collection : un statut par carte (possédée, commandée, souhaitée), le prix payé (`paidPrice`) qui
  le suit, et les cartes (`customCards`). Clé `pokedex-collection.collection` : ne pas changer son
  format. Ce qu'une ancienne version y gardait en plus (`entries` des illustrations choisies, clé
  `.settings` des raretés suivies, statuts des cartes `tcgdex:ja:…` de l'ancien index) est ignoré.
- Achats (`/achats`), clé `pokedex-collection.shopping` (`ShoppingData`, à part : la collection
  garde son format) :
  - préférence par carte (`accepted` : dans la liste d'achats ; `excluded`, d'une ancienne
    version, compte comme non décidée), avec priorité, prix maximum, note ; indépendante du statut
    de la carte (le lien vers Cardmarket est `cardmarketPage` : la page notée, sinon l'id) ;
  - commandes : `applyOrder` (`lib/orders.ts`) reporte chaque enregistrement sur la collection (en
    cours → commandée, reçue → possédée, annulée ou supprimée → l'état d'avant, gardé dans
    `OrderLine.previous`, `previousOf`). Une possession n'est jamais retirée ; une carte qui quitte
    une commande reçue (ligne retirée, commande annulée ou supprimée) reste possédée, sans la date
    ni le prix payé que la commande lui avait donnés. Le prix payé est le prix de revient (port,
    frais et remboursé répartis au prorata, au centime ; les centimes d'arrondi vont aux lignes
    d'une seule carte, en plusieurs tours, jamais sous 0 €, pour que les prix de revient fassent le
    total). Corriger la date de réception corrige la date d'obtention. Une carte déjà dans une autre
    commande est signalée à la saisie (son prix payé serait remplacé). Une commande en cours depuis
    plus de 28 jours est signalée, aux Achats et à l'accueil (`latePendingOrders`) ; chaque
    commande s'ouvre en détail (coût réel de chaque carte) ; le registre s'exporte en CSV ;
  - budget calculé depuis les commandes : une commande compte une fois, au mois de sa date d'achat,
    remboursé déduit (jamais plus que la commande), rien si annulée. Au-delà du plafond :
    confirmation, jamais de blocage ; le formulaire montre le mois avec la commande en cours de
    saisie. Les réglages de l'assistant (prochaine commande) sont gardés par la page, l'onglet
    caché étant démonté ;
  - l'export contient `shopping` (un export plus ancien, sans lui, s'importe et garde les achats
    en place). Un import demande toujours confirmation ; un fichier abîmé (enregistrement ou bloc
    d'achats illisible : image, priorité, montant en texte, état de commande, date ou jour qui
    n'existe pas, remboursé plus grand que la commande, commande sans id ou en double, texte qui
    n'en est pas un, lien…) est refusé (`lib/transfer.ts`). « Effacer ma
    collection » efface aussi la liste d'achats, qui renverrait à des cartes disparues ; les
    commandes et le budget restent.
- Deux onglets ouverts restent d'accord : chacun reprend ce que l'autre enregistre (évènement
  `storage`, `store/persist.ts`, pour les deux clés), sans quoi il l'écraserait. Si le navigateur
  refuse de lire ou d'écrire (stockage plein ou bloqué), l'app continue en mémoire et un bandeau
  (`useStorageFailure`, `AppShell`) invite à exporter.
- « Annuler » (`useCollectionAction`) rétablit collection et achats d'avant, et refuse si quelque
  chose a changé depuis : une modification ultérieure n'est jamais effacée.
- Filtres du Pokédex dans l'adresse : `q`, `generation`, `possession` (`owned` : débloqués,
  `missing` : à débloquer, `ordered`, `wanted`), `card` (`with` : avec carte, `without` : sans ;
  à compléter : `no-image`, `no-cardmarket`, `no-paid` : possédée sans prix payé), `order=desc` ;
  un lien filtré se
  construit avec `pokedexUrl`. La recherche passe par `flushSync` (le routeur met l'adresse à jour
  dans une transition, le champ suivrait la frappe en retard) ; la grille, mémoïsée, suit par
  `useDeferredValue`.
- Performance (mesurer en production, `bun run build` puis `bun run preview` : `bun dev` est 3 à 4
  fois plus lent) : le Pokédex affiche 1 025 pochettes. Seules celles à l'écran sont dessinées
  (`content-visibility`, de même pour la liste d'achats et le catalogue), les marques de
  possession sont des icônes CSS (masques, pas de SVG : plus de 1 000 sinon), et rien de ce qui
  défile n'a de `backdrop-filter` (flou recalculé à chaque image). Les pages autres que l'accueil,
  le Pokédex et les fiches sont chargées à leur première ouverture (`lazy`, `router.tsx`). Une
  donnée chargée à la demande et lue par `use()` passe par `settled` : sans lui, React retient
  l'affichage environ 300 ms à chaque ouverture (fenêtre d'ajout, catalogue). La fiche d'un
  Pokémon sans carte prépare le catalogue pendant que le navigateur est libre.
- Sous Windows, `bun dev` (Vite lancé par Bun) : après une modification de `vite.config.ts`, le
  serveur redémarre mal et n'écoute plus (le relancer) ; et deux écritures très rapprochées d'un
  même fichier (outil, formateur) peuvent lui échapper : il sert alors l'ancienne version (page
  blanche, « … is not defined ») jusqu'à ce que le fichier soit de nouveau enregistré.
- `noUncheckedIndexedAccess` est actif ; alias `@/` → `src/` (vite.config.ts, tsconfig.base.json
  dont héritent tsconfig.app, .scripts et .tests, et tsconfig.json pour Bun).

## Déploiement

VPS derrière un tunnel Cloudflare. `Dockerfile` : Bun lance les tests puis construit `dist/`,
nginx le sert (`deploy/nginx.conf` : une route inconnue reçoit `index.html`, le routage étant côté
client ; un fichier manquant de `/assets/` ou `/prices/` répond 404 ; `/assets/` en cache un an ;
`/prices/` toujours revalidé ; compression gzip niveau 6, pas 1 : les prix du jour passent de 555 à
462 Ko). `compose.yaml` : le site sur
`127.0.0.1:${POKEDEX_PORT:-8080}`, que le tunnel publie, et le service `prices` qui relance
`scripts/prices.ts` toutes les 6 h (après un échec : 10 min, puis 20, 40… jusqu'à 6 h ; il lit
`scripts/` et `src/` du clone : le catalogue, `card-code.ts`) dans le volume `prices` (l'historique
de chaque carte y vit, un fichier par carte : ne pas supprimer le volume).
`.github/workflows/deploy.yml` : lancé à la main tant que le domaine n'est pas prêt (le push sur
`main` à remettre, voir son en-tête), SSH sur le VPS (action épinglée sur un
commit, empreinte d'hôte `VPS_FINGERPRINT`), `git pull --ff-only`, `docker compose build --pull`
puis `up -d`. Marche à suivre complète : README.

## Skills du projet (`.claude/skills/`)

`camply-ui` (écrit pour ce projet), `vercel-react-best-practices`, `vercel-composition-patterns`
(installés via `npx skills`, verrouillés dans `skills-lock.json`).
