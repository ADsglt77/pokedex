# CLAUDE.md

Pokédex personnel de cartes Pokémon **japonaises** : les 1 025 Pokémon, et pour chacun la carte que
l'utilisateur veut, qu'il choisit lui-même : dans le catalogue des cartes japonaises de chaque
Pokémon, depuis Cardmarket avec le favori « Ajouter au Pokédex », ou à la main (sa référence, d'où
son image est retrouvée, et son id Cardmarket pour le prix). Un Pokémon est « débloqué » quand sa
carte est possédée. React 19 + Vite + TypeScript, UI `@camply/ui`, espèces PokéAPI, catalogue et
images Pokécardex, prix Cardmarket : tout passe par le serveur de l'app (Elysia, SQLite,
`server/`), le navigateur ne parle qu'à lui. Connecté (Better Auth), la
collection est synchronisée entre vos appareils ; sans connexion, elle reste dans le navigateur.

## Commandes

Bun est le gestionnaire de paquets (`bun.lock`) — pas npm/pnpm/yarn.

```sh
bun install
bun dev                # serveur Vite (lancé par Bun, pas par Node : `bun --bun vite`) ; voir « Sous Windows » plus bas
bun run build          # tsc -b + vite build (pas `bun build`)
bun lint               # ESLint
bun test               # tests de tests/ (logique des achats), relancés par le build Docker
bun run format         # Prettier sur src/, server/ et tests/
bun run dev:server     # le serveur de l'app (API, server/index.ts) sur le port 3000 ; `bun dev` lui renvoie /api
bun run ingest catalog # une tâche d'ingestion : catalogue (Pokécardex) → .data/data.db ; `--refresh` relit toutes les séries
bun run ingest prices  # prix du jour (Cardmarket)
bun run ingest legacy-prices ./prices   # une fois : reprise des anciens fichiers de prix dans la base
bun run ingest species # les espèces (PokéAPI) → .data/data.db : la première tâche à lancer
bun server/create-user.ts <e-mail>       # change le mot de passe du compte (ou le crée sans la première visite)
```

## Principes

- App **volontairement simple** : pas d'abstraction « au cas où », pas de vérification défensive
  dans les fonctions. On ne contrôle que ce qui vient de l'extérieur : le stockage du navigateur
  et le fichier importé (`lib/transfer.ts`), l'adresse (`lib/filters.ts`), ce que l'utilisateur
  saisit (montants, liens, adresse d'image, id Cardmarket). Factoriser quand une logique sert à
  deux endroits ou plus.
- Tests : seulement la logique où une erreur coûte de l'argent (`tests/`, `bun test`) : budget,
  registre des commandes, plan de la prochaine commande, import (un montant mal lu fausserait le
  budget), prix d'une carte (le plan le lit : jamais celui d'une autre), synchronisation (une
  erreur écraserait les commandes d'un autre appareil) ; et l'historique des prix (`server/history.ts`,
  irremplaçable : Cardmarket n'en garde pas). Pas de tests d'interface. Le build Docker les lance :
  un test en échec bloque le déploiement.
- Les cartes viennent de l'utilisateur, une par Pokémon, qu'il **choisit** : aucune détection ni
  classement automatique (l'ancien index TCGplayer et la détection des pleines cartes ont été
  retirés à sa demande). Aides, ajoutées à sa demande : le catalogue des cartes japonaises de
  chaque Pokémon (toutes ses cartes Pokémon, sans filtre de rareté) et leur image, de
  **Pokécardex**, la seule source des cartes depuis octobre 2026 (à la demande de l'utilisateur : TCGdex et
  TCGplayer retirés). L'accord de Pokécardex (octobre 2026) : lire tout ce qu'on veut sur son site
  (ses pages chiffrent leurs données : on les déchiffre comme son propre JavaScript, avec sa clé
  relue dans ce JavaScript), utiliser ses images à condition de les **héberger chez nous** (jamais
  affichées depuis ses serveurs), et un crédit avec un lien vers son site, apprécié : sous la carte
  de la fiche, sous l'aperçu de la saisie, en tête de la grille du catalogue et dans le pied de
  page. Seulement des cartes japonaises (pas les françaises de Pokécardex, son choix). Ne pas
  réintroduire le reste sans demande.
- UI : **`@camply/ui` d'abord** (skill `camply-ui`), thème camply par défaut (sombre, accent cyan).
  Un composant maison seulement s'il est métier ou absent de la lib.
- Périmètre volontairement réduit : pas d'image téléversée (on colle une adresse), pas de
  comparaison ni de fusion à l'import. Le navigateur ne parle qu'au site lui-même : son API
  (`/api/…` : catalogue, prix) et les images copiées (`/images/…`) ; seule exception, une image à
  l'adresse collée. Les sources (PokéAPI, Pokécardex, Cardmarket) ne sont lues que par les tâches
  d'ingestion du serveur.
- Sources : on peut lire (scraper) n'importe quel site, ou contourner une protection (données
  chiffrées…), mais **toujours demander d'abord à l'utilisateur**, qui obtient l'accord du site ;
  dire précisément quoi (pages, rythme, méthode). Jamais de CAPTCHA ni de défi anti-robot
  (Cloudflare…), même avec un accord. Sources convenues : PokéAPI, Pokécardex (pages et images),
  les fichiers publics de Cardmarket.
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
| `src/config/` | Générations, couleurs des types, achats (budget par défaut, niveaux de budget, priorités, fournisseurs), tâches d'ingestion (`jobs` : leur rythme, que lisent le serveur et la page Données) : configuration, pas de logique |
| `src/lib/` | Règles **pures** : `species` (espèces, données par le serveur avant le premier affichage ; carte d'un id), `cardmarket` (page et id saisis, ce que le favori envoie, code du favori), `card-code` (le code d'une carte dans sa référence, sa clé ; sans import, `prices.ts` s'en sert), `card-images` (l'image d'une carte chez Pokécardex, d'après sa série et son rang ou d'après sa référence ; d'où vient une image), `card-catalog` (les cartes japonaises d'un Pokémon, la carte d'une référence, l'image retrouvée : `findCardImage`), `pokedex` (modèle : la carte de chaque Pokémon, progression, résumé), `collection` (modifications : statut, prix payé, ajout et retrait d'une carte), `filters` (adresse, liens filtrés, recherche), `transfer` (export, import, CSV, lecture du stockage), `prices` (prix Cardmarket d'une carte, valeur, coût pour compléter, courbes, plus fortes hausses et baisses : `priceMovers`), `format`, `settled` (une promesse que `use()` lit sans attendre), `api` (lecture de l'API, mémoïsée), `auth-client` (client Better Auth), `sync` (la règle de la synchronisation) ; achats : `wishlist` (préférences, filtres, CSV de la liste), `orders` (coût, report sur la collection, doublons, commandes en retard), `budget` (par mois, par fournisseur), `purchase-planner` (prochaine commande) |
| `src/store/` | Zustand : `collection` et `shopping` (liste d'achats, commandes, budget), dans `localStorage` ; `prices` (`/api/prices`) ; `sync` (la collection du compte connecté, `/api/collection`). `persist` les enregistre et les garde d'accord entre onglets |
| `src/hooks/` | `usePokedex` (modèle partagé par toutes les pages), `useNotify` (toasts + « Annuler »), `usePokedexFilters`, `useCardDraft` (saisie d'une carte), `useExportCollection` |
| `src/components/` | Composants métier partagés par plusieurs pages (carte, champs d'une carte, tuile, réglette, courbe, réglages d'achat d'une carte…) et les seuls génériques absents de camply (confirmation, en-tête de page, lien externe, crédit d'une image, champ enregistré en le quittant, `SegmentedField`), le compte dans l'en-tête (`AccountMenu`) et la question d'un conflit (`SyncConflictDialog`) ; le reste vient de camply |
| `src/pages/` | Une page par route ; les sous-composants d'une page vivent dans son dossier (`pokemon/CardForm` : ajouter ou corriger la carte d'un Pokémon ; `AddCardPage` : `/ajouter`, ouverte par le favori ; `LoginPage` : `/connexion` ; `WelcomePage` : `/bienvenue`, la première visite) |
| `tests/` | Tests `bun test` de la logique des achats, de la synchronisation et de l'historique des prix (`tsconfig.tests.json`) |
| `server/` | Bun, le serveur (`tsconfig.server.json`) : `index.ts` (lance le serveur ; écrit le code de première visite), `app.ts` (l'API, Elysia : un plugin par domaine, paramètres et corps validés par leurs schémas, 422 sinon ; 404 sans corps ; documentation OpenAPI à `/api/docs` en développement), `reference.ts` (les données de référence : état des tâches, espèces, catalogue, prix, historique), `db.ts` (SQLite dans `DATA_DIR`, `.data/` en local : `data.db`, les données de référence, et `app.db`, le compte et la collection ; schéma par étapes, `PRAGMA user_version`), `auth.ts` (Better Auth : un seul compte, créé à la première visite, une session ; `/api/auth/*`, `/api/account`, la macro `auth` des routes du compte : session, origine, `no-store`), `collection.ts` (`/api/collection`), `create-user.ts`, `jobs/species.ts`, `ingest.ts` (les tâches d'ingestion, une à la demande ou `--loop`), `jobs/catalog.ts`, `jobs/prices.ts`, `jobs/images.ts`, `jobs/backups.ts`, `images.ts` (les images copiées, dans `IMAGES_DIR` : leur adresse d'origine, la copie, la copie à la demande), `history.ts` (l'historique des prix, une ligne par carte et par année), `snapshots.ts` (les grosses réponses, calculées en fin de tâche et gardées compressées), `legacy-prices.ts` (reprise des anciens fichiers de prix), `lib/net.ts` (cache disque, requêtes identifiées de 2 min au plus, file à concurrence limitée qui attend les requêtes en cours avant de lever une erreur), `lib/pokecardex.ts` (les pages de Pokécardex, déchiffrées ; une toutes les 3 s) |

Points à connaître :

- Une carte (`PokemonCard`) : id `manual:<uuid>`, ses Pokémon (`dexIds`), une référence (vide à la
  saisie : le nom de la carte chez Cardmarket, sinon le nom du Pokémon), son image (`image` :
  celle de Pokécardex en deux tailles (ou de TCGplayer, d'une ancienne version), ou l'adresse
  collée, `small` = `large` ; `null` sans image),
  son id Cardmarket (`cardmarket`) et sa page chez Cardmarket (`page`), tous deux facultatifs ;
  sans page notée, le lien « Voir sur Cardmarket » se fait par l'id (`cardmarketPage`).
  Une par Pokémon : on la corrige (« Modifier la carte », même id, son statut et ses achats la
  suivent) ou on la retire (« Retirer la carte » : avec son statut, son prix payé et sa préférence
  d'achat ; confirmation si elle est possédée ; impossible tant qu'une commande la contient) avant
  d'en ajouter une autre. Si une ancienne version en a gardé plusieurs, la première compte.
  « Souhaitée » (statut) et « À acheter » (liste d'achats) sont indépendants : la fiche le dit.
- Catalogue (tâche `catalog`, `server/jobs/catalog.ts`, une fois par jour → tables `sets`, `cards`,
  `card_species` → `/api/catalog`, `lib/card-catalog.ts`) : les cartes Pokémon japonaises de
  Pokécardex (`server/lib/pokecardex.ts`), ≈ 450 séries de 1996 à aujourd'hui, decks, promos et
  anciennes séries compris (27 Herbizarre japonaises, contre 8 chez TCGdex), sans les exclusivités
  d'autres pays d'Asie (bloc « Asia Exclusive » de son menu, `asiaExclusive`). La liste des séries
  vient de son plan du site (`sitemap_fr.xml`, `/series/jp/<code>`) ; chaque série, de sa page :
  son nom, sa sortie au Japon, et ses cartes (id Pokécardex, numéro imprimé « 001/165 », `sort`,
  nom français, Pokémon `id_pokedex_list`, id Cardmarket). Seules les cartes Pokémon (dresseurs et
  énergies n'ont pas de Pokémon). Ses pages portent leurs données chiffrées
  (`__INITIAL_DATA_ENCRYPTED__`, AES-CBC) : déchiffrées avec la clé que contient son JavaScript,
  relue à chaque passage (son adresse change à chaque mise en ligne), jamais recopiée dans le
  dépôt. Une page toutes les 3 s, User-Agent identifié : le premier passage prend une vingtaine de
  minutes ; ensuite, une série est relue chaque semaine, chaque jour si elle est sortie depuis
  moins de 90 jours (`read_at`), et `--refresh` les relit toutes. Une page en échec n'empêche pas
  les autres (la tâche échoue ensuite, pour être relancée) ; une page soudain vide ne retire rien.
  Une carte qu'une lecture de sa série ne voit plus est retirée (`seen`). Sans serveur, la fenêtre
  d'ajout et la page Catalogue le disent (« pas disponible pour le moment »). Par Pokémon, des plus
  récentes aux plus anciennes : `[série, numéro (sans numéro imprimé : `sort`), id Cardmarket (0 :
  aucun), nom français, numéro de son image (`sort`, 0 : Pokécardex ne l'a pas), Pokémon s'ils
  sont plusieurs]`. La référence d'une carte : « Dracaufeu ex (SV2A 006) », son nom puis le code de
  sa série et son numéro. « Ajouter une carte »
  (`pokemon/CardForm`) s'ouvre sur l'onglet « Cartes japonaises » (`CatalogPicker` : image
  Pokécardex, code, prix du jour, tri par date ou par prix ; ses réglages vivent
  dans `CardForm`, l'onglet caché étant démonté) ; choisir une carte remplit la saisie (`fill` :
  référence « Pikachu ex (SV8 033) » et id, d'où l'image, le prix et le lien Cardmarket) et y mène le focus ; on la vérifie puis l'enregistre (« Enregistrer » attend que la
  carte soit choisie, ou l'onglet de saisie). « Modifier la carte » n'a que la saisie : choisir une autre carte, ce serait
  lui transmettre le statut, le prix payé et les commandes de celle-ci. Le catalogue n'est qu'une
  aide : la carte enregistrée est une carte saisie comme les autres (`manual:<uuid>`).
  L'enregistrement (`useCardDraft.save`) attend le prix et l'image : une seule fois à la fois, la
  fenêtre ne se ferme pas pendant ce temps. Une page Cardmarket qui n'était que celle de l'id de
  départ est oubliée quand l'id change (le lien suit alors le nouvel id). La page Catalogue
  (`/catalogue?set=…`, dans le menu) : une série, cherchée par code ou nom (`Combobox`), les
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
- Images (`lib/card-images.ts`, `server/images.ts`, tâche `images`) : chez Pokécardex,
  `pokecardex-scans.b-cdn.net/sets_jp/<série>/<sort>.jpg?class=md` (son code tel quel, « S8A-G »
  compris ; tailles `md` pour la grille, `hd` pour la fiche) : `pokecardexImage`. Le catalogue
  donne l'adresse exacte de chaque carte ; pour une référence hors du catalogue, `cardImage` la
  déduit du code de la référence (série en majuscules sans tiret, SV-P → SVP ; numéro sans zéro),
  sans certitude. La collection garde les adresses d'origine (son format ne change pas), mais le
  navigateur ne charge que la copie du serveur (condition de Pokécardex) : `localSrc` en donne le
  chemin (`/images/cards/pokecardex/SV2A/6-md.webp`), pour le `src` de `CardArt` et pour
  `findCardImage`. La tâche `images` (chaque jour, après les prix ; deux téléchargements à la
  fois, seulement ce qui manque ; le premier passage, environ 1 Go, prend une heure ou plus) copie
  les sprites et illustrations des 1 025 Pokémon et, pour chaque carte du catalogue, son scan en
  deux tailles, et note s'il existe (`cards.image`) : le catalogue le dit d'avance. Une carte sans
  scan est recherchée chaque semaine. Une image en erreur (panne, réponse qui n'est pas une image)
  n'arrête pas les autres : rien n'est noté pour elle, elle est redemandée au passage suivant, et la
  tâche échoue à la fin (au-delà de 20 erreurs, elle s'arrête : la source est sans doute en panne).
  Une image absente du volume (référence saisie hors du
  catalogue, image pas encore copiée) est copiée à la demande par le serveur (`serveImage` :
  seulement les chemins connus, `upstreamUrl` ; une absence retenue une semaine ; nginx limite à
  10 copies par seconde). Les images de TCGplayer qu'une ancienne version a enregistrées
  s'affichent encore si le volume en a la copie (jamais plus copiées, citées « TCGplayer ») ;
  Données › « Chercher les images » les remplace par celles de Pokécardex, comme il cherche celles
  des cartes sans image. `findCardImage` (`lib/card-catalog.ts`) : l'image du catalogue pour
  cette référence, sinon celle que la référence désigne, si elle se charge (sans réponse en 10 s :
  absente, pour ne pas bloquer l'enregistrement) ; la saisie le dit, et la fiche et l'aperçu citent
  sa source sous la carte (`imageSource`, `ImageCredit`, d'après l'adresse d'origine). Un échec
  est redemandé à l'enregistrement (panne passagère), et une image déjà enregistrée reste si elle
  ne répond pas. Une adresse collée s'affiche telle quelle, sans crédit : la seule image que le
  navigateur va chercher ailleurs. Sans adresse collée, l'image suit la référence (cherchée en
  quittant le champ). Pour deviner le Pokémon (`speciesInName`), le « (code numéro) » final est
  ignoré : « Énergie (MEW 207) » n'est pas Mew. Le code d'une carte (`lib/card-code.ts`) :
  `codeKey` en fait une clé (« SV2A 166 », « S8AG 1 » : série en majuscules sans tiret, numéro sans
  zéro), pour retrouver la carte du catalogue d'une référence.
- Prix (`server/jobs/prices.ts`, tâche `prices`) : le guide des prix public de Cardmarket et sa
  liste des produits (pour les noms), seulement les cartes à l'unité (catégorie 51), dans
  `data.db` : le prix du jour de chaque carte (`cardmarket_prices` : prix, plus bas, moyenne 30
  jours, par id Cardmarket) et son historique (`cardmarket_history` : Cardmarket n'en garde pas ;
  une ligne par carte et par année, à partir de son premier jour avec un prix, `server/history.ts` ;
  relancée le même jour, la tâche remplace le prix du jour). Rien n'est retéléchargé (29 Mo) tant
  que le guide n'a pas changé (`sources` : son `Last-Modified`). En fin de tâche, la réponse de
  `/api/prices` est calculée et gardée compressée (`snapshots`, avec un ETag : 304 si le navigateur
  l'a déjà). L'app la charge au premier écran qui affiche un prix (pas l'accueil ni le Pokédex), et
  l'historique d'une carte à la demande (`/api/prices/<id>`) : la courbe, le nom affiché dans le
  formulaire pour vérifier l'id saisi (au départ du champ). Sans serveur, ou base encore vide,
  l'app marche sans prix. Une réponse manquante (404) n'est pas redemandée ; après une panne
  passagère (réseau, délai, réponse illisible), elle l'est la fois suivante où elle sert, au plus
  une fois par minute (`store/prices.ts`). Une carte sans id Cardmarket, ou dont l'id n'a pas de
  prix ce jour, n'a pas de prix (aucun n'est inventé ; Pokécardex donne l'id de presque toutes).
  L'ancien historique (les fichiers du volume `prices`,
  un par carte) est repris au premier démarrage d'`ingest` (`legacy-prices.ts`), vérifié avant
  d'être gardé : nombre de cartes, somme des prix, échantillon relu tel que l'API le sert.
- État des données (page Données › Données de référence, `ReferenceSection`) : où en est chaque
  tâche d'ingestion, d'après son journal (`/api/status` : dernière réussite, dernier passage, et le
  jour des prix en base), demandé à chaque ouverture de la page. À jour ; en retard (deux
  intervalles sans réussite, `INGEST_JOBS` de `config/jobs.ts`, que suit aussi `ingest.ts`) ; en
  échec (le dernier passage) ; à lancer (jamais passée : la commande est donnée), sauf les images,
  facultatives (le serveur copie à la demande celles affichées). Sans réponse : « l'état des
  données est inconnu ». Dans le formulaire d'une carte, un id Cardmarket n'est pas mis en doute
  tant que les prix manquent tous.
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
  `storage`, `store/persist.ts`, pour les deux clés), sans quoi il l'écraserait ; connectés, ils
  partagent aussi la dernière version échangée avec le serveur. Si le navigateur
  refuse de lire ou d'écrire (stockage plein ou bloqué), l'app continue en mémoire et un bandeau
  (`useStorageFailure`, `AppShell`) invite à exporter.
- Comptes et synchronisation (`server/auth.ts`, `server/collection.ts`, `lib/sync.ts`,
  `store/sync.ts`) : Better Auth, e-mail et mot de passe, **un seul compte**, celui de
  l'utilisateur (les invitations ont été retirées à sa demande, octobre 2026). Tant qu'il n'existe
  pas, c'est la première visite : le serveur écrit dans son journal un code de première visite
  (8 caractères, nouveau à chaque démarrage), `GET /api/account` répond `{ exists: false }` et le
  routeur (créé après cette réponse, `main.tsx` : ses `loader` lisent `accountExists` dès sa
  création) mène toute page à `/bienvenue` (`WelcomePage`, hors de la coquille). On y crée le
  compte avec ce code (en-tête `X-Setup-Code`, vérifié puis consommé au moment de créer le compte,
  `databaseHooks.user.create.before`) ; ensuite, plus aucune inscription, et `/bienvenue` mène à
  `/connexion`. Un visiteur arrivé avant l'utilisateur ne peut donc pas prendre le compte.
  `server/create-user.ts` le crée aussi depuis le serveur (jamais un second) ou change son mot de
  passe (ce qui ferme ses sessions). **Une seule session par compte** : se connecter sur un
  appareil déconnecte les autres (crochet `session.create.after`) ; l'appareil déconnecté garde
  ses modifications et affiche « Reconnectez-vous ». Sessions de 60 jours dans un cookie
  (`__Secure-` en https, SameSite Lax) ; en production, 5 tentatives de connexion ou de création du compte
  par minute et par visiteur (`cf-connecting-ip`). Sans connexion, l'app marche comme avant : la
  collection reste dans le navigateur, le Pokédex est public. Connecté, la collection et les achats
  forment un seul document par compte (une commande modifie les deux), dans `app.db`, numéroté par
  le serveur (`/api/collection` : `PUT` refusé, 409, si l'appareil part d'une version dépassée ; le
  document passe les contrôles d'un import, `readDocument`). Le navigateur garde sa copie (hors
  ligne, l'app marche ; l'envoi part au retour du réseau) et note la dernière version échangée
  (`pokedex-collection.sync` : version et empreinte SHA-256 ; les deux autres clés gardent leur
  format) : il synchronise une seconde après une modification, au retour de la page et du réseau,
  un onglet à la fois (`navigator.locks`). La règle (`decide`, testée) : seul cet appareil a
  changé, il envoie ; seul le serveur, il reprend ; les deux, une fenêtre fait choisir la version à
  garder (`SyncConflictDialog`, avec un export de celle de l'appareil ; jamais de fusion, comme à
  l'import). Avec une seule session, ce cas ne vient plus que d'un appareil déconnecté avec des
  modifications pas encore envoyées, qui se reconnecte : la fenêtre reste le filet de sécurité. À
  la première connexion d'un appareil, celui qui a quelque chose l'envoie (ou le reçoit). Le
  serveur garde une version remplacée par heure, 30 jours (`collection_versions`, à reprendre à la
  main). Se déconnecter vide la copie de ce navigateur (appareil partagé), après avoir proposé
  l'export si un envoi a échoué. « Annuler », l'import, « Effacer » sont des modifications comme
  les autres : connecté, elles valent pour tous les appareils (les textes de la page Données le
  disent). L'en-tête montre l'état (`AccountMenu` : synchronisée, hors ligne, reconnectez-vous, à
  choisir) ; `/connexion` (`LoginPage`) ramène à la
  page d'où l'on venait (`?retour=`, seulement une page du site). Le rappel de sauvegarde ne paraît
  que sans connexion.
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
  dont héritent tsconfig.app, .server et .tests, et tsconfig.json pour Bun).

## Déploiement

VPS derrière un tunnel Cloudflare. `Dockerfile`, trois cibles : `build` (Bun lance les tests puis
construit `dist/`), `server` (Bun lance `server/` tel quel, avec `src/` et `tsconfig.json` pour
l'alias `@/` ; `NODE_ENV=production`) et `web` (nginx sert `dist/`). `deploy/nginx.conf` : une
route inconnue reçoit `index.html`, le routage étant côté client ; `/api/` va au service `server`
(son adresse redemandée au DNS de Docker, `resolver` : un serveur redémarré change d'adresse) ;
`/images/` vient du volume `images` (gardé un mois), une image qui y manque va au serveur, qui la
copie (10 par seconde au plus) ; un fichier manquant de `/assets/` répond 404 ; `/assets/` en
cache un an ; compression gzip niveau 6, réponses de l'API comprises (`gzip_proxied` ; les prix du
jour arrivent déjà compressés). `compose.yaml` :
- `pokedex` : le site sur `127.0.0.1:${POKEDEX_PORT:-8080}`, que le tunnel publie ;
- `server` : l'API, qui lit la base du volume `db`, y garde le compte et la collection (`app.db`),
  et copie à la demande dans le volume `images` ; ses secrets (`BETTER_AUTH_URL`, l'adresse
  publique en https, et `BETTER_AUTH_SECRET`) viennent du `.env` du clone (ignoré par git) : sans
  eux, docker compose refuse de démarrer. Le compte : à la première visite, avec le code du journal (`docker compose logs server`) ;
  son mot de passe : `docker compose run --rm server bun server/create-user.ts <e-mail>` ;
- `ingest` : `server/ingest.ts --loop`, les tâches à leur rythme (espèces chaque mois, catalogue
  chaque jour, puis prix toutes les 6 h, puis images et sauvegardes chaque jour ; après un échec : 10 min, puis 20, 40…
  jusqu'à 6 h), dans les volumes `db`, `images` et `backups`. À chaque démarrage, il refait les
  réponses calculées de l'API (leur forme a pu changer avec le code) : le catalogue et les prix
  d'après leurs tables, les espèces en repassant leur tâche (depuis le cache disque de PokéAPI,
  sans requête s'il a moins d'un mois) ; au premier, il reprend
  l'historique de l'ancien volume `prices` (`LEGACY_PRICES`, l'ancien service des prix, retiré)
  avant d'écrire.

Sauvegardes (`server/jobs/backups.ts`, volume `backups`) : chaque jour, `app.db` (30 gardées) et
`data.db` compressée (7 gardées), copiées par `VACUUM INTO` pendant que le serveur tourne. Elles
sont sur le disque du VPS : à copier ailleurs aussi (README). Les volumes `db` (historique des
prix, votre collection) et `backups` sont irremplaçables, `images` porte un Go de copies : jamais
`docker compose down -v` ; `prices` (l'ancien historique, repris) se supprime à la main quand tout
va bien. `.github/workflows/deploy.yml` : lancé à la main tant que le domaine n'est pas prêt (le
push sur `main` à remettre, voir son en-tête), SSH sur le VPS (action épinglée sur un commit,
empreinte d'hôte `VPS_FINGERPRINT`), `git pull --ff-only`, `docker compose build --pull` puis
`up -d --remove-orphans`. Marche à suivre complète : README.

## Skills du projet (`.claude/skills/`)

`camply-ui` (écrit pour ce projet), `vercel-react-best-practices`, `vercel-composition-patterns`
(installés via `npx skills`, verrouillés dans `skills-lock.json`).
