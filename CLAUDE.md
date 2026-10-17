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
bun lint               # ESLint
bun test               # tests de tests/ (achats, prix, saisie, import, cartes, liste de souhaits Cardmarket, synchronisation, historique des prix), relancés par le build Docker
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
- Tests : seulement la logique où une erreur coûte de l'argent (`tests/`, `bun test`) : budget,
  registre des commandes, plan de la prochaine commande, import et montants saisis (un montant mal
  lu fausserait le budget), id Cardmarket saisi, prix d'une carte (le plan le lit : jamais celui
  d'une autre), la ligne d'une carte pour la liste de souhaits Cardmarket (une mauvaise version
  achèterait une autre carte : `tests/wants.test.ts`), synchronisation (une
  erreur écraserait les commandes d'un autre appareil), retrait d'une carte TAG TEAM (son statut et
  son prix payé restent à ses autres Pokémon) ; ce que montre le Pokédex public (ce qu'il
  laisserait passer serait public) ; et l'historique des prix (`server/history.ts`,
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
  composant ; ce qui diffère d'un thème à l'autre hors camply y a aussi son jeton
  (`--empty-sprite-opacity` : le sprite grisé d'un Pokémon sans carte, `--card-glare` ; `--link`
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
  liste, avant le « Shopping Wizard » ; l'app n'envoie rien à Cardmarket. Format vérifié par
  l'utilisateur sur cardmarket.com (octobre 2026) :
  `1x <nom du produit chez Cardmarket, sans crochets, « | » devenu une espace> (V.<n>) (<extension>)`,
  par exemple `1x Charmander Blazing Destruction Steady Firebreathing (V.2) (Pokémon Card 151)` →
  « Salamèche (sv2a 168) ». Sans `(V.n)`, Cardmarket prend la V.1 : la version est écrite dès que
  l'extension a plusieurs produits de la même carte (même `idMetacard`), et seulement alors.
  Cardmarket les numérote dans l'ordre de leur **numéro imprimé**, pas de leur création ni de leurs
  ids (vérifié : S2 037 = V.1 bien que créée après S2 107 ; sv2a 004 = V.1, sv2a 168 = V.2), que
  seul le catalogue Pokécardex connaît : la version n'est donnée que si chaque produit du groupe y
  a un seul numéro, en chiffres, sans ex aequo (son rang par valeur) ; sinon, pas de ligne. Une
  extension écrite sans parenthèses ou inconnue de Cardmarket donne un souhait « toutes versions »
  (message bleu « Informations ») : jamais une telle ligne en connaissance de cause. Ses noms
  d'extension ne sont dans aucun fichier public : celui de la série Pokécardex des cartes du
  catalogue de cette extension, sans les espaces des bords, s'il n'y en a qu'un et qu'aucune autre
  extension ne le porte (sinon, promos, Jumbo, les deux « Beginning Set »…, pas de ligne) ; pas de
  ligne non plus si le nom ou l'extension a une parenthèse (son analyseur la lirait mal). Toujours
  `1x`. Ni la langue ni l'état ne tiennent dans une ligne : après le collage, « Modification en
  masse » (japonais, Near Mint). Une carte sans ligne s'ajoute depuis sa page (`cardmarketPage`,
  « Ajouter à mes souhaits »). Pas de CSV ni de recherches à copier (retirés à la demande de
  l'utilisateur, octobre 2026).
- Textes en français (fr-FR pour nombres et dates), vouvoiement. Un Pokémon dont la carte n'est
  pas possédée est « à débloquer » (pas « manquant », « à trouver » ni « à obtenir »).
- Prettier : pas de point-virgule, guillemets simples, 100 colonnes.

## Architecture

| Dossier | Rôle |
|---|---|
| `src/config/` | Générations, couleurs des types, achats (budget par défaut, niveaux de budget, fournisseurs), tâches d'ingestion (`jobs` : leur rythme, que lisent le serveur et la page Données) : configuration, pas de logique |
| `src/lib/` | Règles **pures** : `species` (espèces, données par le serveur avant le premier affichage ; carte d'un id), `cardmarket` (page et id saisis, le lien vers une carte ; la ligne d'une carte pour la liste de souhaits Cardmarket, `wantsLine`, `null` sans ligne sûre, et sa version, `wantsVersion` : le rang de son numéro imprimé parmi les produits de la même carte dans son extension ; le serveur s'en sert : `/api/wants`), `card-code` (le code d'une carte dans sa référence, sa clé ; sans import, le serveur s'en sert : `jobs/catalog.ts`), `card-images` (l'image d'une carte chez Pokécardex, d'après sa série et son rang ou d'après sa référence ; d'où vient une image), `card-catalog` (les cartes japonaises d'un Pokémon, la carte d'une référence, l'image retrouvée : `findCardImage`), `pokedex` (modèle : la carte de chaque Pokémon, progression, résumé), `collection` (modifications : statut, prix payé, ajout et retrait d'une carte ; l'id d'une carte : `newCardId` ; une carte encore à acheter, et pour un Pokémon pas encore pris : `isToBuy`, `stillWanted`), `filters` (adresse, liens : `pokedexUrl`, `shoppingUrl`, la fiche d'un Pokémon `speciesPath` ; recherche), `transfer` (export, import, lecture du stockage), `prices` (prix Cardmarket d'une carte, écart à sa moyenne sur 30 jours : `priceChange`, valeur, coût pour compléter, courbes, plus fortes hausses et baisses : `priceMovers`), `format`, `chart` (les courbes jour par jour : période de 7 jours au moins `periodWindow`, cumul `runningTotal`, chiffres `seriesStats`, `levelStats`), `settled` (une promesse que `use()` lit sans attendre), `cx` (classes CSS), `focus` (une action qui retire ou déplace son propre bouton d’une liste : le focus va à l’élément suivant, `keepFocusInList` ; un raccourci clavier qui ne s’applique pas, `shortcutBlocked`), `api` (lecture de l'API, mémoïsée ; ce qu'on en tire, calculé une fois par réponse : `derived` ; les lignes de la liste de souhaits Cardmarket, redemandées à chaque fois : `loadWantsLines`), `jobs` (une tâche d’ingestion en retard : `isOverdue`, que suivent la page Données et `/api/health`), `time` (durées en ms, jours : `addDays`, `daysBetween` ; le serveur s'en sert aussi), `auth-client` (client Better Auth ; le compte et qui est connecté, en une requête au démarrage : `loadAccount` ; l'adresse de connexion qui ramène à la page : `loginPath`), `sync` (la règle de la synchronisation) ; achats : `wishlist` (la liste d'achats : la carte de chaque Pokémon ni possédée ni commandée, ses filtres), `orders` (coût, report sur la collection, doublons, commandes en retard), `budget` (par mois, par fournisseur), `purchase-planner` (prochaine commande) |
| `src/store/` | Zustand : `collection` et `shopping` (commandes, budget), dans `localStorage` ; `prices` (`/api/prices`) ; `sync` (le compte connecté, `signedIn`, et sa collection, `/api/collection`) ; `theme` (sombre ou clair, gardé dans ce navigateur, suivi par ses autres onglets). `persist` les enregistre et les garde d'accord entre onglets |
| `src/hooks/` | `usePokedex` (modèle partagé par toutes les pages), `useNotify` (toasts + « Annuler »), `usePokedexFilters`, `useCardDraft` (saisie d'une carte), `useExportCollection`, `useMediaQuery`, `useWishlist` (la liste d'achats : Achats et accueil) |
| `src/components/` | Composants métier partagés par plusieurs pages (carte, tuile du catalogue, classeur du Pokédex `PokedexGrid` et sa pochette `PokedexTile` (`linked` faux : sans lien, sur le Pokédex public), réglette, liste des régions sur téléphone `RegionList`, courbe des Pokémon débloqués `UnlockedChart`, courbe `PriceChart` et sa période et ses chiffres `ChartParts`…) (lien « Voir sur Cardmarket » : `CardmarketLink` ; bouton d'export avant de remplacer ou d'effacer : `ExportCollectionButton`) et les seuls génériques absents de camply (confirmation, en-tête de page `PageHeader`, bloc de page `Panel` (`titleRef` : son titre, pour y mener le focus), lien externe, champ enregistré en le quittant, `SegmentedField`), la coquille (`AppShell` : navigation ; le logo `Logo` et le pied de page `SiteCredits`, partagés avec le Pokédex public ; `AppSearch` : la recherche Ctrl/⌘ K), le compte (`AccountMenu` ; la carte des pages de connexion et de première visite : `AuthCard`, `as` pour la balise du bloc), la jauge du budget (`BudgetMeter`), un nombre de tableau qui dit ce qu'il compte quand le tableau devient une liste de fiches (`TableCount`), les statistiques « Dépensé ce mois-ci » et « Liste d’achats » (`ShoppingStats`, accueil et achats), un montant au prix du jour (`PricedValue` : « — » sans prix, une ébauche tant qu’ils arrivent ; sans prix, rien n’est compté « sans prix ») et la question d'un conflit (`SyncConflictDialog`) ; le reste vient de camply |
| `src/pages/` | Une page par route ; les sous-composants d'une page vivent dans son dossier (`pokemon/ImageCredit` : la source de l'image d'une carte ; `pokemon/CardForm` : ajouter ou corriger la carte d'un Pokémon, ses champs `CardFields` et, pour une carte neuve, « Ajouter comme » (sans statut, possédée ou à acheter : un seul choix, `ADD_AS_LABELS`, comme la page Catalogue) ; `pokemon/PricePanel` : le prix Cardmarket de la fiche et sa courbe, `PriceHistory` ; `LoginPage` : `/connexion` ; `WelcomePage` : `/bienvenue`, la première visite ; `VitrinePage` : `/vitrine`, le Pokédex public ; `data/VitrineSection` : son adresse ; `data/AccountSection` : pseudo et mot de passe ; `shopping/LateOrdersAlert` : les commandes en retard ; `shopping/WantsDialog` : « Copier pour Cardmarket », les cartes de la prochaine commande en lignes pour la liste de souhaits Cardmarket ; `ErrorPage`, `NotFoundPage`) |
| `tests/` | Tests `bun test` de la logique d'argent (achats, prix, saisie, import, lignes de la liste de souhaits Cardmarket : `wants.test.ts`), de la synchronisation, de ce que montre le Pokédex public et de l'historique des prix (`tsconfig.tests.json`) |
| `server/` | Bun, le serveur (`tsconfig.server.json`) : `index.ts` (lance le serveur), `app.ts` (l'API, Elysia : un plugin par domaine, paramètres et corps validés par leurs schémas, 422 sinon ; 404 sans corps ; une erreur imprévue est écrite dans le journal, 500 sans corps ; documentation OpenAPI à `/api/docs` en développement), `reference.ts` (les données de référence : état des tâches, espèces, catalogue, prix, historique ; `/api/health` pour une surveillance, 503 si une tâche nécessaire est en retard ; `/api/wants?ids=…`, la ligne de chaque id Cardmarket pour la liste de souhaits, `null` sans ligne sûre), `db.ts` (SQLite dans `DATA_DIR`, `.data/` en local : `data.db`, les données de référence, et `app.db`, le compte et la collection ; schéma par étapes, `PRAGMA user_version` : à jour, aucun verrou au démarrage ; journal WAL ramené à 64 Mo), `auth.ts` (Better Auth : un seul compte, créé à la première visite, une session ; `/api/auth/*`, `/api/account`, la macro `auth` des routes du compte : session, origine, `no-store`), `collection.ts` (`/api/collection`), `vitrine.ts` (le Pokédex public, toujours montré : `/api/vitrine`), `journal.ts` (le journal de l’app dans la sortie du serveur, une ligne alignée par évènement : heure de Paris, symbole de niveau, thème, message court, détails `clé=valeur` ; la Poké Ball du démarrage en pixel art, demi-blocs en couleurs 24 bits (`banner`) ; pas les requêtes une à une, seulement ce qui se passe ; les erreurs de Better Auth au même format ; `NO_COLOR` sans couleurs : compte, ce qui change dans la collection et les achats, comparé à la version d’avant (`documentChanges`), export et import signalés par le navigateur (`POST /api/journal`, `report` de `lib/api.ts`), visites de la vitrine ; jamais un mot de passe), `jobs/species.ts`, `ingest.ts` (les tâches d'ingestion, une à la demande ou `--loop`), `jobs/catalog.ts`, `jobs/prices.ts`, `jobs/images.ts`, `jobs/backups.ts`, `images.ts` (les images copiées, dans `IMAGES_DIR` : leur adresse d'origine, la copie, la copie à la demande), `history.ts` (l'historique des prix, une ligne par carte et par année), `snapshots.ts` (les grosses réponses, calculées en fin de tâche et gardées compressées ; pour toute l'API, le 404 sans corps `notFound` et la comparaison des ETag `matchesEtag`), `legacy-prices.ts` (reprise des anciens fichiers de prix), `lib/net.ts` (cache disque, requêtes identifiées de 2 min au plus, file à concurrence limitée qui attend les requêtes en cours avant de lever une erreur), `lib/pokecardex.ts` (les pages de Pokécardex, déchiffrées ; une toutes les 3 s) |

Points à connaître :

Le détail de chaque domaine est dans `docs/` : **le lire avant de toucher à ce domaine**, et le
tenir à jour avec le code.

| Domaine | Page | L'essentiel |
|---|---|---|
| Cartes, catalogue, images | [docs/cartes.md](docs/cartes.md) | Une carte par Pokémon (`manual:<uuid>`), choisie par l'utilisateur : catalogue Pokécardex ou saisie ; images copiées chez nous (`/images/…`), jamais affichées depuis Pokécardex |
| Prix, historique, état des données | [docs/prix.md](docs/prix.md) | Guide public Cardmarket du jour ; l'historique n'existe que relevé par le serveur (Cardmarket n'en garde pas) ; aucun prix inventé ; `/api/status`, `/api/health` ; `/api/wants` : la version suit l'ordre des numéros imprimés (pas des ids), jamais une ligne qui pourrait désigner une autre carte |
| Collection, achats, commandes, budget | [docs/collection-et-achats.md](docs/collection-et-achats.md) | Clés `pokedex-collection.collection` et `.shopping` : ne pas changer leur format ; `applyOrder` ; une possession n'est jamais retirée ; un import demande toujours confirmation |
| Compte, synchronisation, Pokédex public | [docs/compte-et-synchronisation.md](docs/compte-et-synchronisation.md) | Un seul compte, une session ; un document numéroté, `decide` testé, jamais de fusion ; `/vitrine` ne montre jamais un prix payé ni un achat |
| Interface, filtres, performance | [docs/interface.md](docs/interface.md) | Système de design (`global.css`, `theme.css`) ; 1 025 pochettes (`content-visibility`, `settled`) ; filtres dans l'adresse ; courbes jour par jour |
| Déploiement, sauvegardes | [docs/deploiement.md](docs/deploiement.md), README | Docker sur le VPS derrière un tunnel Cloudflare ; conteneurs sans droits d'administrateur ; politique de sécurité du contenu ; **jamais `docker compose down -v`** (les volumes `db` et `backups` sont irremplaçables) |

Pièges du poste de développement :

- Sous Windows, `bun dev` (Vite lancé par Bun) : après une modification de `vite.config.ts`, le
  serveur redémarre mal et n'écoute plus (le relancer) ; et deux écritures très rapprochées d'un
  même fichier (outil, formateur) peuvent lui échapper : il sert alors l'ancienne version (page
  blanche, « … is not defined ») jusqu'à ce que le fichier soit de nouveau enregistré.
- `strict` et `noUncheckedIndexedAccess` sont actifs ; alias `@/` → `src/` (vite.config.ts, tsconfig.base.json
  dont héritent tsconfig.app, .server et .tests, et tsconfig.json pour Bun).

## Skills du projet (`.claude/skills/`)

`camply-ui` (écrit pour ce projet), `vercel-react-best-practices`, `vercel-composition-patterns`
(installés via `npx skills`, verrouillés dans `skills-lock.json`).
