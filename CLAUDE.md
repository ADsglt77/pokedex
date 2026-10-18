# CLAUDE.md

Pokédex personnel de cartes Pokémon **japonaises** : les 1 025 Pokémon, et pour chacun la carte que
l'utilisateur veut, qu'il choisit lui-même : dans le catalogue des cartes japonaises de chaque
Pokémon, ou à la main (sa référence, d'où son image est retrouvée, et son id Cardmarket pour le
prix). Un Pokémon est « débloqué » quand sa
carte est possédée. React 19 + Vite + TypeScript, UI `@camply/ui`, espèces PokéAPI, catalogue et
images Pokécardex, prix Cardmarket : tout passe par le serveur de l'app (Elysia, SQLite,
`server/`), le navigateur ne parle qu'à lui. Connecté (Better Auth), la
collection est synchronisée entre vos appareils ; sans connexion, on ne voit que le Pokédex
public (`/vitrine`, la page d'accueil d'un visiteur).

## Commandes

Bun est le gestionnaire de paquets (`bun.lock`) — pas npm/pnpm/yarn.

```sh
bun install
bun dev                # serveur Vite (lancé par Bun, pas par Node : `bun --bun vite`) ; voir « Sous Windows » plus bas
bun run build          # tsc -b + vite build (pas `bun build`)
bun lint               # ESLint, puis knip : à lancer après chaque changement
bun run knip           # le code mort seul : exports, fichiers et dépendances sans usage (entrées : knip.json)
bun test               # tests de tests/ (ce qu'ils couvrent : Principes), relancés par le build Docker
bun run format         # Prettier sur src/, server/ et tests/
bun run dev:server     # le serveur de l'app (API, server/index.ts) sur le port 3000 ; `bun dev` lui renvoie /api et /images
bun run ingest catalog # une tâche d'ingestion : catalogue (Pokécardex) → .data/data.db ; `--refresh` relit toutes les séries
bun run ingest prices  # prix du jour (Cardmarket)
bun run ingest legacy-prices ./prices   # une fois : reprise des anciens fichiers de prix dans la base
bun run ingest species # les espèces (PokéAPI) → .data/data.db : la première tâche à lancer
bun run ingest images  # copie les images (≈ 1,5 Go ; inutile en développement : copiées à la demande) ; aussi `backups`
```

## Principes

- App **volontairement simple** : pas d'abstraction « au cas où », pas de vérification défensive
  dans les fonctions. On ne contrôle que ce qui vient de l'extérieur : le stockage du navigateur
  et le fichier importé (`lib/transfer.ts`), l'adresse (`lib/filters.ts`), ce que l'utilisateur
  saisit (montants, liens, adresse d'image, id Cardmarket). Factoriser quand une logique sert à
  deux endroits ou plus.
- Tests : seulement la logique où une erreur coûte de l'argent (`tests/`, `bun test`) : budget
  (et ses seuils), registre des commandes (doublons compris), la liste d'achats que lit le plan
  (jamais une carte possédée ou commandée, une TAG TEAM une fois) et le plan de la prochaine
  commande, import et montants saisis (un montant mal lu fausserait le budget), id Cardmarket
  saisi, le lien vers Cardmarket (ses offres en japonais, Near Mint au moins : une autre langue,
  ce serait une autre carte achetée), prix d'une carte (le plan le lit : jamais celui d'une
  autre), la ligne d'une carte pour la liste de souhaits Cardmarket (une mauvaise version
  achèterait une autre carte : `tests/wants.test.ts`), synchronisation (une erreur écraserait les
  commandes d'un autre appareil ; la garde du serveur, 409 pour un envoi parti d'une version
  dépassée, sur le serveur entier : `tests/collection.test.ts`), retrait d'une carte TAG TEAM (son
  statut et son prix payé restent à ses autres Pokémon) ; ce que montre le Pokédex public (ce qu'il
  laisserait passer serait public) ; et l'historique des prix (`server/history.ts`, irremplaçable :
  Cardmarket n'en garde pas ; sa relecture pour la courbe de la valeur, `historiesOf`). Pas de
  tests d'interface. Le build Docker les lance : un test en échec bloque le déploiement. C'est la
  liste de référence : le README et les commandes y renvoient.
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
- UI : **`@camply/ui` d'abord** (skill `camply-ui`), en deux thèmes (`styles/theme.css`, à sa
  demande, octobre 2026 ; pas de bleu) : **sombre** par défaut, gris foncé neutre et accent jaune ;
  **clair** (`data-camply-theme="light"` sur `<html>`), blanc pastel chaud et accent rouge. Les tons
  restent distincts de l'accent (sombre : danger corail, avertissement orange ; clair : danger
  cramoisi), l'information est violette. La jauge du budget est `info` tant qu'on est dans le budget, et une
  hausse (`Stat` `delta`) est verte (`.camply-stat__good` surchargée dans `global.css`) : l'accent
  y passerait pour une alerte. Le choix (bouton « Thème clair / sombre » de la barre,
  `store/theme.ts`) est gardé dans ce navigateur (`pokedex-collection.theme`, une préférence, pas
  synchronisée) ; sans choix, celui du système, posé avant le premier affichage par
  `public/theme.js` (même règle ; un fichier et pas un script dans la page : la politique de sécurité
  n'accepte que les scripts du site). Les couleurs se changent dans `theme.css`, jamais dans un
  composant (le fond, `--camply-bg`, est aussi la couleur de la barre du navigateur, lue par
  `store/theme.ts` ; ses copies figées, `index.html`, manifeste, `public/theme.js`, y sont
  nommées) ; ce qui diffère d'un thème à l'autre hors camply y a aussi son jeton
  (`--empty-sprite-opacity` : le sprite grisé d'un Pokémon sans carte ; `--link`
  et `--chart-*` : en clair, liens et courbes à l'encre, liens soulignés de rouge, pour que le
  rouge reste la marque et l'action principale, pas une alerte ; le choix d'un `SegmentedControl`
  y est un bouton blanc en relief). Le logo
  est une Poké Ball plate (`Logo`, `AppShell` ; couleurs `--brand-*`, les mêmes dans les deux
  thèmes), la même que l'icône de l'onglet (`public/favicon.svg`). Un composant maison seulement
  s'il est métier ou absent de la lib.
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
  `/Products/Singles?idProduct=` ne marche pas). Aucune autre adresse devinée. Chaque lien vers une
  carte (celui de l'id comme une page collée) porte les filtres des offres choisis par
  l'utilisateur (octobre 2026) : `language=7` (japonais) et `minCondition=2` (Near Mint au
  moins), sauf ceux qu'une page collée fixe déjà. La page exacte vient
  d'une adresse collée (« Page Cardmarket » de la saisie). Les images de
  Cardmarket ne s'affichent que sur son site (son serveur refuse les autres) : refusées comme image
  de carte. Liste de souhaits (« Wants ») : des lignes que l'utilisateur copie (Achats › Prochaine
  commande › « Copier pour Cardmarket ») et colle lui-même dans « Ajouter une deck list » de sa
  liste ; l'app n'envoie rien à Cardmarket. Le format vérifié par l'utilisateur (octobre 2026), la
  version `(V.n)` (dans l'ordre des numéros imprimés, pas des ids), l'extension et les cas sans
  ligne : `docs/prix.md` ; jamais une ligne qui pourrait désigner une autre carte (une carte sans
  ligne s'ajoute depuis sa page). Pas de CSV ni de recherches à copier (retirés à la demande de
  l'utilisateur, octobre 2026).
- Textes en français (fr-FR pour nombres et dates), vouvoiement. Un Pokémon dont la carte n'est
  pas possédée est « à débloquer » (pas « manquant », « à trouver » ni « à obtenir »).
- Prettier : pas de point-virgule, guillemets simples, 100 colonnes.

## Architecture

| Dossier | Rôle |
|---|---|
| `src/config/` | Générations, couleurs des types, achats (« Ajouter comme », budget par défaut, niveaux de budget, fournisseurs, états d'une commande), tâches d'ingestion (`jobs` : leur ordre et leur rythme, que lisent le serveur et la page Données) : configuration, pas de logique |
| `src/lib/` | Règles **pures** : `species` (espèces, données par le serveur avant le premier affichage ; carte d'un id ; les noms des Pokémon d'une carte, `speciesNames`, et de ses autres Pokémon que celui de la page, `otherSpeciesNames`), `cardmarket` (page et id saisis, le lien vers une carte ; la ligne d'une carte pour la liste de souhaits Cardmarket, `wantsLine`, `null` sans ligne sûre, et sa version, `wantsVersion` : le rang de son numéro imprimé parmi les produits de la même carte dans son extension ; le serveur s'en sert : `/api/wants`), `card-code` (le code d'une carte dans sa référence, sa clé ; sans import, le serveur s'en sert : `jobs/catalog.ts`), `card-images` (l'image d'une carte chez Pokécardex, d'après sa série et son rang ou d'après sa référence ; d'où vient une image : `imageSource`), `card-catalog` (les cartes japonaises d'un Pokémon, la carte d'une référence, l'image retrouvée : `findCardImage`), `pokedex` (modèle : la carte de chaque Pokémon, progression, résumé), `collection` (modifications : statut, prix payé, ajout et retrait d'une carte ; l'id d'une carte : `newCardId` ; une carte encore à acheter, ni possédée ni commandée : `isToBuy`), `filters` (adresse, liens : `pokedexUrl`, `shoppingUrl`, la fiche d'un Pokémon `speciesPath` ; recherche), `transfer` (export, import, lecture du stockage), `prices` (prix Cardmarket d'une carte, écart à sa moyenne sur 30 jours : `priceChange`, valeur, coût pour compléter, courbes, plus fortes hausses et baisses : `priceMovers` ; « 3 cartes · payées 120,00 € » : `tallyHint` ; les historiques de la collection relus dans l'ordre de ses cartes : `historiesOf`), `format` (nombres, montants et dates en fr-FR ; une part `formatShare`, « Le Pokédex de … » `pokedexTitle` ; le serveur s'en sert aussi), `chart` (les courbes jour par jour : période de 7 jours au moins `periodWindow`, cumul `runningTotal`, chiffres d'un prix `levelStats`), `settled` (une promesse que `use()` lit sans attendre), `cx` (classes CSS), `focus` (une action qui retire ou déplace son propre bouton d’une liste : le focus va à l’élément suivant, `keepFocusInList` ; un enregistrement refusé : le premier champ en erreur, `focusFirstError` ; un raccourci clavier qui ne s’applique pas, `shortcutBlocked`), `api` (lecture de l'API, mémoïsée, une adresse qui ne reviendra pas oubliée : `forget` ; ce qu'on en tire, calculé une fois par réponse : `derived` ; redemandés à chaque fois, `fetchFresh` : les lignes de la liste de souhaits Cardmarket, `loadWantsLines`, et l'état des tâches du serveur, `loadStatus`), `clipboard` (copier un texte : `copyText`, qui échoue aussi hors https), `jobs` (une tâche d’ingestion en retard : `isOverdue`, que suivent la page Données et `/api/health`), `time` (durées en ms, jours : `addDays`, `daysBetween` ; le serveur s'en sert aussi), `auth-client` (le compte et qui est connecté, en une requête au démarrage : `loadAccount`, que `main.tsx` passe à `startSession` ; l'adresse de connexion qui ramène à la page : `loginPath` ; trop de tentatives : `TOO_MANY_ATTEMPTS` ; sans le client Better Auth, pour un premier chargement léger), `auth` (le client Better Auth, `authClient` : importé seulement par la connexion, la première visite et Données › Mon compte, et chargé à la demande par la déconnexion, `signOut` de `store/sync.ts`), `sync` (la règle de la synchronisation) ; achats : `wishlist` (la liste d'achats : la carte de chaque Pokémon ni possédée ni commandée, une TAG TEAM une fois, `wishlistRows` ; ses filtres), `orders` (les achats d'un nouveau venu `emptyShopping`, coût, report sur la collection, doublons, commandes en cours `pendingCount` et en retard), `budget` (par mois, par fournisseur, niveau d'un mois `budgetLevel`), `purchase-planner` (prochaine commande, d'après la seule liste d'achats : `planPurchase`) |
| `src/store/` | Zustand : `collection` et `shopping` (commandes, budget), dans `localStorage` ; `document` (les deux ensemble : lire, comparer, remplacer) ; `prices` (`/api/prices` ; l'historique d'une carte, `/api/prices/<id>`, et ceux de la collection en une demande, `/api/histories`, la dernière liste seulement, avec les cartes absentes d'une copie du service worker) ; `sync` (le compte connecté, `account`, et sa collection, `/api/collection`) ; `theme` (sombre ou clair, gardé dans ce navigateur, suivi par ses autres onglets). `persist` les enregistre et les garde d'accord entre onglets ; le stockage se lit par `readStored` et s'écrit par `writeStored` (un refus lève le bandeau de la coquille), sauf le choix du thème, une préférence, écrit sans bruit |
| `src/hooks/` | `usePokedex` (modèle partagé par toutes les pages), `useNotify` (toasts + « Annuler »), `usePokedexFilters`, `useCardDraft` (saisie d'une carte), `useExportCollection`, `useMediaQuery`, `useWishlist` (la liste d'achats : Achats et accueil) |
| `src/components/` | Composants métier partagés par plusieurs pages (carte, tuile du catalogue, classeur du Pokédex `PokedexGrid` et sa pochette `PokedexTile` (`linked` faux : sans lien, sur le Pokédex public), réglette `ProgressRuler` (`linked` faux : une image, sur le Pokédex public), liste des régions sur téléphone `RegionList`, courbe des Pokémon débloqués `UnlockedChart`, courbe `PriceChart` et sa période et ses chiffres `ChartParts`…) (lien « Voir sur Cardmarket » : `CardmarketLink` ; bouton d'export avant de remplacer ou d'effacer : `ExportCollectionButton`) et les seuls génériques absents de camply (confirmation, en-tête de page `PageHeader`, bloc de page `Panel` (`titleRef` : son titre, pour y mener le focus), lien externe, montant en euros enregistré en quittant le champ `EuroInput` ou tenu par un formulaire `EuroField`, `SegmentedField`), la coquille (`AppShell` : navigation ; la marque `Logo` (le logo, puis le nom) et le pied de page `SiteCredits`, partagés avec le Pokédex public ; `AppSearch` : la recherche Ctrl/⌘ K), le compte (`AccountMenu` ; la carte des pages de connexion et de première visite, et leur `<main>` : `AuthCard`), la jauge du budget (`BudgetMeter`) et le badge d'un mois au-delà de son budget (`BudgetLevelBadge`), un nombre de tableau qui dit ce qu'il compte quand le tableau devient une liste de fiches (`TableCount`), les statistiques « Dépensé ce mois-ci » et « Liste d’achats » (`ShoppingStats`, accueil et achats) et la valeur des cartes possédées (`CollectionValueStat`, accueil et Valeur), un montant au prix du jour (`PricedValue` : « — » sans prix, une ébauche tant qu’ils arrivent ; sans prix, rien n’est compté « sans prix ») et la question d'un conflit (`SyncConflictDialog`) ; le reste vient de camply |
| `src/pages/` | Une page par route ; les sous-composants d'une page vivent dans son dossier (accueil et Achats : les classes d'un seul composant dans son propre module CSS, celles qu'en partagent plusieurs dans celui de la page, importé sous le nom `page`) (`home/HomePage` : l'accueil, un tableau de bord, et ses panneaux `ProgressPanel` (la progression), `TodoPanel` (« À faire »), `Indicators` (valeur, budget du mois, liste d'achats, commandes), `RecentPanel` (les dernières cartes obtenues ; sans elles, les premières choisies : `Chosen`) et `StartPanel` (une collection vide : par où commencer) ; `pokemon/ImageCredit` : la source de l'image d'une carte ; `pokemon/CardForm` : ajouter ou corriger la carte d'un Pokémon, ses champs `CardFields` et, pour une carte neuve, « Ajouter comme » (à acheter ou possédée, `ADD_AS_LABELS`, comme la page Catalogue) ; `pokemon/PricePanel` : le prix Cardmarket de la fiche et sa courbe, `PriceHistory` ; `LoginPage` : `/connexion` ; `WelcomePage` : `/bienvenue`, la première visite ; `VitrinePage` : `/vitrine`, le Pokédex public ; `data/VitrineSection` : son adresse ; `data/AccountSection` : pseudo et mot de passe ; `shopping/LateOrdersAlert` : les commandes en retard ; `shopping/OrderForm` : enregistrer ou corriger une commande, ses cartes `OrderLines` ; `shopping/WantsDialog` : « Copier pour Cardmarket », les cartes de la prochaine commande en lignes pour la liste de souhaits Cardmarket ; `ErrorPage`, `NotFoundPage`) |
| `tests/` | Tests `bun test` (ce qu'ils couvrent : Principes), un fichier par domaine, et leurs données d'essai (`fixtures.ts` : une carte `card`, une collection, des commandes) ; l'environnement du serveur, posé avant le premier fichier (`setup.ts`, par `bunfig.toml` : `bun test` ne charge un module qu'une fois pour tous les fichiers) : un dossier de données temporaire, jamais `.data`, et un compte d'essai ; vérifiés avec le serveur (`tsconfig.server.json`) |
| `server/` | Bun, le serveur (`tsconfig.server.json`, avec les tests) : `index.ts` (lance le serveur), `app.ts` (l'API, Elysia : un plugin par domaine, paramètres et corps validés par leurs schémas, 422 sinon, 413 au-delà de 5 Mo ; 404 sans corps ; une erreur imprévue est écrite dans le journal, 500 sans corps ; documentation OpenAPI à `/api/docs` en développement), `reference.ts` (les données de référence : état des tâches, espèces, catalogue, prix, historique ; `/api/health` pour une surveillance, 503 si une tâche nécessaire est en retard ; `/api/wants?ids=…`, la ligne de chaque id Cardmarket pour la liste de souhaits, `null` sans ligne sûre ; `/api/histories?ids=…`, l'historique de chaque id Cardmarket, `null` sans historique, 1 025 au plus : la courbe de la valeur en une demande), `db.ts` (SQLite dans `DATA_DIR`, `.data/` en local : `data.db`, les données de référence, et `app.db`, le compte et la collection ; schéma par étapes, `PRAGMA user_version` : à jour, aucun verrou au démarrage ; journal WAL ramené à 64 Mo), `auth.ts` (Better Auth : un seul compte, créé à la première visite avec l'adresse `ACCOUNT_EMAIL`, une session ; `/api/auth/*`, `/api/account`, la macro `auth` des routes du compte : session, origine, `no-store` ; la session d'une requête, dont le cookie renouvelé repart avec la réponse : `sessionOf`), `collection.ts` (`/api/collection` ; un envoi parti d'une version dépassée : 409, corps `null`, l'appareil relit la version du serveur), `vitrine.ts` (le Pokédex public, toujours montré : `/api/vitrine`, avec les prix du jour de ses seules cartes possédées, `readPrices` de `jobs/prices.ts`), `journal.ts` (le journal de l’app dans la sortie du serveur, une ligne alignée par évènement, pas par requête : compte, changements du document synchronisé (`documentChanges`), export et import signalés par le navigateur (`POST /api/journal`, `report` de `lib/api.ts`), visites de la vitrine, erreurs ; la Poké Ball du démarrage, `banner` ; sans couleurs avec `NO_COLOR` ; jamais un mot de passe), `jobs/species.ts`, `ingest.ts` (les tâches d'ingestion, une à la demande ou `--loop`, dans l'ordre d'`INGEST_JOBS` : espèces, catalogue, prix, sauvegardes, images), `jobs/catalog.ts`, `jobs/prices.ts`, `jobs/images.ts`, `jobs/backups.ts`, `images.ts` (les images copiées, dans `IMAGES_DIR` : leur adresse d'origine, la copie, la copie à la demande, son échec au journal), `history.ts` (l'historique des prix, une ligne par carte et par année ; sa lecture, préparée une fois : `historyReader`), `snapshots.ts` (les grosses réponses, calculées en fin de tâche et gardées compressées ; pour toute l'API, le 404 sans corps `notFound` et la comparaison des ETag `matchesEtag`), `legacy-prices.ts` (reprise des anciens fichiers de prix), `lib/net.ts` (cache disque des réponses de PokéAPI, un mois ; requêtes identifiées de 2 min au plus, file à concurrence limitée qui attend les requêtes en cours avant de lever une erreur), `lib/pokecardex.ts` (les pages de Pokécardex, déchiffrées ; une toutes les 3 s) |

Points à connaître :

Le détail de chaque domaine est dans `docs/` : **le lire avant de toucher à ce domaine**, et le
tenir à jour avec le code.

| Domaine | Page | L'essentiel |
|---|---|---|
| Cartes, catalogue, images | [docs/cartes.md](docs/cartes.md) | Une carte par Pokémon (`manual:<uuid>`), choisie par l'utilisateur : catalogue Pokécardex ou saisie ; images copiées chez nous (`/images/…`), jamais affichées depuis Pokécardex |
| Prix, historique, état des données | [docs/prix.md](docs/prix.md) | Guide public Cardmarket du jour ; l'historique n'existe que relevé par le serveur (Cardmarket n'en garde pas) ; aucun prix inventé ; `/api/histories` : la courbe de la valeur en une demande, relue dans l'ordre des cartes ; `/api/status`, `/api/health` ; `/api/wants` : la version suit l'ordre des numéros imprimés (pas des ids), jamais une ligne qui pourrait désigner une autre carte |
| Collection, achats, commandes, budget | [docs/collection-et-achats.md](docs/collection-et-achats.md) | Clés `pokedex-collection.collection` et `.shopping` : ne pas changer leur format ; `applyOrder` ; une possession n'est jamais retirée ; un import demande toujours confirmation |
| Compte, synchronisation, Pokédex public | [docs/compte-et-synchronisation.md](docs/compte-et-synchronisation.md) | Un seul compte, une session ; un document numéroté, `decide` testé, jamais de fusion ; `/vitrine` ne montre jamais un prix payé ni un achat |
| Interface, filtres, performance | [docs/interface.md](docs/interface.md) | Système de design (`global.css`, `theme.css`) ; 1 025 pochettes (`content-visibility`, `settled`) ; filtres dans l'adresse ; courbes jour par jour |
| Déploiement, sauvegardes | [docs/deploiement.md](docs/deploiement.md), README | Docker sur le VPS derrière un tunnel Cloudflare ; conteneurs sans droits d'administrateur ; politique de sécurité du contenu ; **jamais `docker compose down -v`** (les volumes `db` et `backups` sont irremplaçables) |

Pièges du poste de développement :

- Sous Windows, `bun dev` (Vite lancé par Bun) : après une modification de `vite.config.ts`, le
  serveur redémarre mal et n'écoute plus (le relancer) ; et deux écritures très rapprochées d'un
  même fichier (outil, formateur) peuvent lui échapper : il sert alors l'ancienne version (page
  blanche, « … is not defined ») jusqu'à ce que le fichier soit de nouveau enregistré.
- `strict` et `noUncheckedIndexedAccess` sont actifs ; alias `@/` → `src/` (vite.config.ts,
  tsconfig.base.json dont héritent tsconfig.app, .server (le serveur et les tests) et .node
  (`vite.config.ts`), et tsconfig.json pour Bun).

## Skills du projet (`.claude/skills/`)

`camply-ui` (écrit pour ce projet), `vercel-react-best-practices`, `vercel-composition-patterns`
(installés via `npx skills`, verrouillés dans `skills-lock.json`).
