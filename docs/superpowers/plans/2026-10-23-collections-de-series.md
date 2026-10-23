# Collections de séries : plan de construction (livraison 3 sur 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** collectionner des extensions entières, en japonais ou en français : une page
Collections (le Pokédex en premier, puis une tuile par extension commencée), la page d'une
extension (toutes ses cartes, obtenues en couleur, manquantes en grisé), leurs cartes manquantes
dans les achats, leur progression à l'accueil et sur le Pokédex public.

**Architecture :** une collection d'extension (`SeriesCollection`) est gardée dans le document du
compte avec ses cases, une carte du compte chacune (`customCards`) : les cartes déjà dans le compte
sont reprises, les autres créées marquées `seriesOnly` (pas encore des cartes de leurs Pokémon).
Possédée une fois, une case devient pour de bon une carte de ses Pokémon. Tout ce qui lit la
collection (Pokédex, liste d'achats, prochaine commande, valeur, Pokédex public) la lit dans le
document, sans charger le catalogue ; seuls le début d'une collection et sa page lisent le
catalogue de l'extension.

**Tech Stack :** React 19, Vite, TypeScript, `@camply/ui`, zustand, react-router ; serveur Bun,
Elysia, `bun:sqlite` ; tests `bun test`.

**Spec :** `docs/superpowers/specs/2026-10-22-collections-et-cartes-francaises-design.md`, sections
« Les collections de séries », « L'interface (option C) », « Une carte, ses variantes », et la
livraison 3 de « Ordre de construction ». La livraison 2 (plusieurs cartes par Pokémon, favorite)
est dans `main`.

## Global Constraints

- Un seul dépôt : `C:\Users\adrie\Documents\dev\pokedex`, branche `collections-de-series` partie de
  `main`. L'API des données ne change pas (les extensions et leurs cartes : `/api/catalog/sets`,
  `/api/catalog/sets/<code>`, et `/fr/` pour les françaises, déjà là).
- Lire `CLAUDE.md` et la page du domaine avant d'y toucher (`docs/collection-et-achats.md`,
  `docs/compte-et-synchronisation.md`, `docs/interface.md`, `docs/cartes.md`) ; la tenir à jour
  dans la tâche qui change le comportement. Code volontairement simple (contrôles seulement sur
  l'extérieur : `src/lib/transfer.ts`), en-tête français par module, textes en français avec
  vouvoiement. Après chaque tâche : `bun lint`, `bun test`, `bun run build`, `bun run format`.
- Commits : un par tâche, en français, terminés par
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Jamais de push.
- **Le modèle** (`src/types.ts`) :
  - `SeriesCollection { set: string; language?: 'fr'; name: string; startedAt: string; cards: string[] }`
    — `set` : le code de l'extension au catalogue (« M6A ») ; `language` absente : japonaise (comme
    `PokemonCard.language`) ; `name` : son nom au catalogue, gardé pour l'afficher partout sans le
    recharger ; `cards` : ses cases dans l'ordre de l'extension, l'id d'une carte de `customCards`
    chacune.
  - `CollectionData.series: SeriesCollection[]`, dans l'ordre où elles ont été commencées.
  - `PokemonCard.seriesOnly?: true` — une case d'extension pas encore obtenue : pas encore une carte
    de ses Pokémon (ni au Pokédex, ni sur leur fiche, jamais favorite). Possédée une fois (statut,
    réception d'une commande), le champ disparaît pour de bon et la carte devient favorite de ceux
    de ses Pokémon qui n'en ont pas.
  - `PokemonCard.dexIds` peut être vide : un dresseur ou une énergie (une carte d'extension).
- **Une collection d'extension = toutes ses cartes dans une langue** (Pokémon, dresseurs, énergies,
  secrètes), une case par carte : une Reverse est la même case. Plusieurs collections, japonaises
  et françaises mélangées ; jamais deux fois la même extension dans la même langue.
- **Une carte n'existe qu'une fois** : une carte déjà dans le compte, de même langue et de même code
  (extension et numéro) ou de même id Cardmarket, est reprise comme la case correspondante.
- Une case est débloquée quand elle est possédée. Commencer une extension ne remplit pas le Pokédex.
- Les cases manquantes vont dans la liste d'achats ; le budget, la prochaine commande et les
  commandes couvrent tout. **La prochaine commande** : la règle « une carte par Pokémon » ne vaut
  que pour les cartes du Pokédex ; une carte `seriesOnly` en est libre.
- **Supprimer une collection** : les cartes possédées restent (et donc au Pokédex) ; une carte
  commandée, ou dans une commande, reste, comme carte seule (sans `seriesOnly`) ; les autres cases
  disparaissent. Une carte de l'extension ajoutée seule (sans `seriesOnly`) ne bouge pas.
- Une carte qui est une case d'une collection se retire depuis sa collection, jamais depuis la
  fiche d'un Pokémon.
- Interface (option C) : menu Accueil, **Collections**, Catalogue, Achats, Valeur, Réglages (le
  Pokédex s'ouvre depuis Collections ; son adresse `/pokedex` ne change pas). Le mot de l'app pour
  une série est « extension » (comme au Catalogue). L'état de l'interrupteur de langue vit dans
  l'adresse (`?langue=fr`, japonais par défaut). Drapeaux : `LanguageFlag`. `@camply/ui` d'abord ;
  couleurs seulement dans `styles/theme.css`. Pas de tests d'interface.
- Le Pokédex public (`/pseudo`) montre le Pokédex et les collections d'extensions ; jamais un prix
  payé, une commande ni un statut « commandée ».

## Review Focus

1. Commencer une extension dont des cartes sont déjà dans le compte (cartes du Pokédex, TAG TEAM,
   même code en japonais et en français) : reprises, jamais en double ; une japonaise n'est jamais
   prise pour la case française. → Tâche 1.
2. Une case obtenue par le bouton « Je possède » ou par la réception d'une commande devient une
   carte de son Pokémon (favorite s'il n'en a pas) et n'en repart plus. → Tâche 1.
3. Supprimer une collection qui a des cartes possédées, commandées ou dans une commande annulée :
   rien de possédé ni du registre des commandes ne se perd. → Tâche 1.
4. Un dresseur ou une énergie (aucun Pokémon) possédé ou voulu : aucune page ne plante (accueil,
   valeur, liste d'achats, commandes). → Tâche 3 (vérifié au navigateur par le contrôleur).
5. Une grosse collection (plusieurs extensions, un millier de cartes) : prix demandés par paquets
   (longueur d'adresse), journal du serveur d'une ligne par collection commencée. → Tâches 2 et 3.

---

### Task 1 : Les collections d'extensions dans la collection (modèle et règles)

**Files :**
- Modify : `src/types.ts`, `src/lib/collection.ts`, `src/lib/orders.ts` (`applyOrder`),
  `src/lib/card-catalog.ts` (`sameCard`, `seriesSlot`), `src/store/collection.ts`,
  `docs/collection-et-achats.md`
- Create : `src/lib/series.ts` (en-tête : les collections d'extensions), `tests/series.test.ts`

**Interfaces :**
- Produces (types) : le modèle des Global Constraints ; `emptyCollection()` → `series: []`.
- Produces (`src/lib/card-catalog.ts`) :
  - `sameCard(a: PokemonCard, b: PokemonCard): boolean` — même langue (`cardLanguage`) et même code
    dans la référence (`referenceCode`/`codeKey`, comme `isCatalogCard`), ou même id Cardmarket.
  - `seriesSlot(card: SetCard): PokemonCard` — `{ id: newCardId(), dexIds, reference, image,
    cardmarket?, ...languageField(card), seriesOnly: true }`.
- Produces (`src/lib/collection.ts`) :
  - `completeFavorites` ignore les cartes `seriesOnly`.
  - `obtain(data: CollectionData, cardIds: Iterable<string>): CollectionData` — ces cartes, si
    elles sont `seriesOnly`, le perdent et complètent les favorites (sans toucher `updatedAt`).
  - `setCardStatus(…, 'owned', …)` passe par `obtain`.
- Produces (`src/lib/orders.ts`) : `applyOrder` passe par `obtain` pour les cartes qu'une commande
  reçue rend possédées.
- Produces (`src/lib/series.ts`) :
  - `findSeries(data: CollectionData, set: string, language: CardLanguage): SeriesCollection | null`.
  - `startSeries(data, start: { set: string; language: CardLanguage; name: string }, slots: PokemonCard[], now): CollectionData`
    — pour chaque case, dans l'ordre, une carte du compte qui est la même (`sameCard`) prend sa
    place (son id dans `cards`, inchangée) ; sinon la case est ajoutée à `customCards`. La
    collection est ajoutée à la fin de `series` (`startedAt: now`).
  - `removeSeries(data, set: string, language: CardLanguage, orders: readonly Order[], now): CollectionData`
    — la règle « Supprimer une collection » des Global Constraints (`isInAnOrder` pour « dans une
    commande ») ; une carte gardée qui perd `seriesOnly` complète les favorites.
  - `seriesProgress(data: CollectionData, series: SeriesCollection, prices: PriceFile | null)`
    → `{ owned: number; total: number; value: number; toComplete: number; unpriced: number }` :
    `owned`/`total` ses cases possédées sur toutes ; `value` le prix du marché de ses cases
    possédées ; `toComplete` celui de ses cases ni possédées ni commandées, `unpriced` celles
    d'entre elles sans prix (`marketPrice`, `src/lib/prices.ts`).
- Produces (store) : `startSeries(start, slots)`, `removeSeries(set, language)` (les commandes du
  magasin des achats).

- [ ] **Step 1 : Écrire les tests** (`tests/series.test.ts`) :
  - `commencer une extension : une case par carte, dans l’ordre, aucune au Pokédex` — 3 cases
    (dont un dresseur, `dexIds: []`) → `series[0].cards` dans l'ordre, cartes `seriesOnly`,
    `buildPokedex` sans elles, `favorites` inchangées.
  - `une carte déjà dans le compte est reprise comme sa case, par son code ou son id Cardmarket` —
    deux cartes existantes (même code ; même id Cardmarket, autre code) → leurs ids dans `cards`,
    aucune carte en plus, leurs statuts intacts.
  - `une carte japonaise n’est jamais la case d’une extension française de même code`.
  - `possédée, une case devient une carte de son Pokémon, favorite s’il n’en a pas` — via
    `setCardStatus(…, 'owned')` : `seriesOnly` disparu, favorite posée ; un Pokémon qui a déjà sa
    favorite la garde ; un dresseur possédé ne donne aucune favorite ; la quitter (« sans statut »)
    ne lui rend pas `seriesOnly`.
  - `reçue dans une commande, une case devient une carte de son Pokémon` — via `applyOrder`.
  - `supprimer une collection : possédées et commandées restent, le registre ne perd rien` —
    possédée gardée ; commandée gardée sans `seriesOnly`, favorite complétée ; une case d'une
    commande annulée gardée ; une case sans statut supprimée ; une carte ajoutée seule de
    l'extension inchangée ; la collection retirée de `series`.
  - `la progression d’une collection : chaque carte une fois` — `owned`, `total`, `value`,
    `toComplete` (une commandée n'y est pas), `unpriced`.
  - Dans `tests/cards.test.ts`, « les règles ne modifient pas ce qu’elles reçoivent » : ajouter
    `startSeries`, `removeSeries`, `obtain`.
- [ ] **Step 2 : Les lancer** — attendu : échec.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Relancer** `bun test`, `bun lint`, `bun run build` — attendu : tout passe (les
  documents relus perdent `series` jusqu'à la tâche 2 : comme à la livraison 2, des tests
  d'aller-retour « tel quel » peuvent rougir ; les nommer dans le rapport, la tâche 2 les répare).
- [ ] **Step 5 : Docs** : `docs/collection-et-achats.md` (les collections d'extensions, `seriesOnly`,
  début, obtention, suppression).
- [ ] **Step 6 : Commit** — `Collection : les collections d'extensions`

### Task 2 : Les collections lues, contrôlées, montrées, journalisées

**Files :**
- Modify : `src/lib/transfer.ts` (`readCollection`, `isCard`, `documentProblem`),
  `server/vitrine.ts` (`shownCollection`), `server/journal.ts` (`documentChanges`),
  `docs/collection-et-achats.md`, `docs/compte-et-synchronisation.md`
- Test : `tests/import.test.ts`, `tests/vitrine.test.ts`, `tests/journal.test.ts`

**Interfaces :**
- Consumes : le modèle de la tâche 1.
- Produces :
  - `readCollection` rend `series` (`value.series` si c'est un tableau, sinon `[]`).
  - `isCard` accepte `dexIds` vide, et `seriesOnly` absent ou `true`.
  - `documentProblem`, après les cartes et les favorites : chaque collection a `set`, `name` en
    texte, `language` absente ou `'fr'`, `startedAt` lisible, `cards` un tableau d'ids distincts de
    `customCards` ; deux collections de même extension et même langue refusées ; une carte
    `seriesOnly` dans aucune collection refusée ; une favorite sur une carte `seriesOnly` refusée.
    Messages en clair, dans le style des autres (« la collection « {name} » est abîmée », « deux
    collections de l’extension {set} », « la carte « {référence} » n’est dans aucune collection »).
  - `shownCollection` recopie `series` (champ par champ) et `seriesOnly`.
  - `documentChanges` : une collection commencée = une ligne « Collection commencée » (son nom et
    son nombre de cartes), une supprimée = « Collection supprimée » ; les cartes ajoutées ou
    retirées avec elle n'ont pas chacune leur ligne.

- [ ] **Step 1 : Écrire les tests** : un export d'avant (sans `series`) s'importe avec `series: []` ;
  un dresseur (`dexIds: []`) d'une collection est accepté ; une carte `seriesOnly` hors collection,
  une case d'id inconnu, deux collections de même extension et langue, une favorite `seriesOnly`
  sont refusés ; `seriesOnly: false` refusé ; le Pokédex public garde les collections et
  `seriesOnly`, et toujours aucun statut « commandée » ; commencer une collection de 3 cartes donne
  une ligne au journal, pas quatre.
- [ ] **Step 2 : Les lancer** — attendu : échec.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Relancer** `bun test`, `bun lint`, `bun run build` — attendu : tout passe, les
  tests d'aller-retour éventuellement rougis par la tâche 1 compris.
- [ ] **Step 5 : Docs** (champs lus, règles, Pokédex public, journal).
- [ ] **Step 6 : Commit** — `Collection : les collections d'extensions lues, contrôlées et montrées`

### Task 3 : Les chiffres et les achats avec les collections

**Files :**
- Modify : `src/lib/pokedex.ts` (`buildPokedex`, `summarize`), `src/lib/wishlist.ts`,
  `src/hooks/useWishlist.ts`, `src/lib/purchase-planner.ts`, `src/store/prices.ts`,
  `src/pages/home/RecentPanel.tsx`, `src/pages/value/ValuePage.tsx`,
  `src/pages/value/ValueTables.tsx`, `src/pages/shopping/CardLine.tsx`,
  `src/pages/shopping/WishCard.tsx`, `src/components/CardArt.tsx` (si un Pokémon y est requis),
  `docs/collection-et-achats.md`
- Test : `tests/pokedex.test.ts`, `tests/purchase-planner.test.ts`

**Interfaces :**
- Consumes : tâches 1 et 2.
- Produces :
  - `buildPokedex` ignore les cartes `seriesOnly` ; `summarize(data).cards` compte les cartes du
    Pokédex (sans les `seriesOnly`).
  - `wishlistRows(collection: CollectionData, prices: PriceFile | null): WishRow[]` — toutes les
    cartes du compte ni possédées ni commandées (cases d'extensions et dresseurs compris), chacune
    une fois ; `WishRow.series: SeriesCollection | null` (la collection dont elle est une case).
    `filterWishlist` : une carte sans Pokémon n'a pas de génération (exclue d'un filtre de
    génération), se cherche par sa référence, et vient après les autres au tri par numéro.
  - `planPurchase` : la règle « une carte par Pokémon » (« Pokémon déjà prévu ») ne s'applique pas
    à une carte `seriesOnly`, ni ne la compte.
  - `requestPrices` (`src/store/prices.ts`) demande les prix par paquets de 200 ids au plus.
  - Une carte sans Pokémon (`dexIds` vide) s'affiche partout sans planter : dernières cartes de
    l'accueil, tables de la valeur, liste d'achats, lignes de commande (son image, ou une image
    neutre ; pas de lien vers une fiche de Pokémon) ; la ligne d'une case d'extension dit son
    extension.

- [ ] **Step 1 : Écrire les tests** : une case `seriesOnly` n'est pas une carte de son Pokémon ;
  possédée (`obtain`), elle l'est ; la liste d'achats contient les cases manquantes et un dresseur,
  pas les possédées ni les commandées, chacune une fois ; la prochaine commande prend deux cases
  d'extension du même Pokémon, et une case avec une carte du Pokédex du même Pokémon, mais une
  seule de deux cartes du Pokédex du même Pokémon.
- [ ] **Step 2 : Les lancer** — attendu : échec.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Relancer** `bun test`, `bun lint`, `bun run build` — attendu : tout passe.
- [ ] **Step 5 : Docs** (liste d'achats, prochaine commande, prix par paquets).
- [ ] **Step 6 : Commit** — `Achats et valeur : les cartes des collections d'extensions`

### Task 4 : La page Collections et le début d'une collection

**Files :**
- Create : `src/pages/collections/CollectionsPage.tsx` (+ son CSS)
- Modify : `src/router.tsx` (`/collections`), `src/components/AppShell.tsx` (le menu),
  `src/pages/catalog/SetPicker.tsx` (son bouton réglable), `src/pages/catalog/CatalogPage.tsx`
  (« Commencer la collection »), `docs/interface.md`, `README.md`
- Test : aucun (interface) ; le contrôleur vérifie au navigateur.

**Interfaces :**
- Consumes : `findSeries`, `seriesProgress`, `seriesSlot`, store `startSeries` (tâche 1) ;
  `loadSets`, `loadSetCards`, `SetPicker`, `LanguageSwitch`, `catalogLanguage`/`catalogParams`.
- Produces : `seriesPath(set: string, language: CardLanguage): string` →
  `/collections/<set>` (`?langue=fr` pour une française), dans `src/lib/filters.ts` ;
  `startCollection(set: SetSummary): Promise<void>` (charge ses cartes, `startSeries` avec
  `seriesSlot`, annonce avec « Annuler »).

- [ ] **Step 1 : Le menu** : l'entrée « Pokédex » devient « Collections » (`/collections`), active
  aussi sur `/pokedex` et `/pokemon/…`.
- [ ] **Step 2 : La page Collections** (`/collections`, titre « Collections ») : la tuile du Pokédex
  d'abord (progression sur 1 025, lien `/pokedex`), puis une tuile par collection, dans l'ordre où
  elles ont été commencées : drapeau, logo et nom de l'extension, progression (« 87 / 230 »,
  `ProgressRuler` ou `Progress` de camply), valeur ; lien vers sa page. « Nouvelle collection »
  ouvre le choix d'une extension avec l'interrupteur 🇯🇵 / 🇫🇷 en haut ; une extension déjà
  commencée y est marquée « Commencée » et mène à sa page.
- [ ] **Step 3 : Commencer** : choisir une extension charge ses cartes, commence la collection,
  l'annonce (« Collection {nom} commencée : {n} cartes. », « Annuler ») et ouvre sa page. Sans
  catalogue (API muette) : un message, rien de commencé.
- [ ] **Step 4 : Le Catalogue** : sur l'extension affichée, « Commencer la collection » (ou « Voir
  ma collection » si elle l'est).
- [ ] **Step 5 : Vérifier** `bun lint`, `bun test`, `bun run build` ; docs (`docs/interface.md`,
  `README.md`).
- [ ] **Step 6 : Commit** — `Collections : la page et le début d'une collection`

### Task 5 : La page d'une collection

**Files :**
- Create : `src/pages/collections/SeriesPage.tsx` (+ CSS, et un composant de grille réutilisable
  par le Pokédex public, tâche 6)
- Modify : `src/router.tsx` (`/collections/:set`), `src/pages/pokemon/CardActions.tsx` (une case
  d'extension ne se retire pas d'ici), `docs/interface.md`
- Test : aucun (interface) ; le contrôleur vérifie au navigateur.

**Interfaces :**
- Consumes : `findSeries`, `seriesProgress`, store `setCardStatus`, `setPaidPrice`,
  `removeSeries` ; `seriesPath`.
- Produces : `SeriesGrid({ collection, series, linked }: { collection: CollectionData; series: SeriesCollection; linked: boolean })`
  — les cases dans l'ordre, possédées en couleur, manquantes en grisé (`CardArt` `locked`), la
  marque de statut ; réutilisée en lecture seule par le Pokédex public (`linked` faux).

- [ ] **Step 1 : La page** (`/collections/<set>`, `?langue=fr`) : en haut, drapeau, logo, nom,
  progression, valeur, coût pour la compléter (et le nombre de cases sans prix) ; dessous, toutes
  ses cartes (`SeriesGrid`). Une collection inconnue : la page introuvable.
- [ ] **Step 2 : Une carte** : la choisir ouvre sa fenêtre : image, référence, drapeau, ses
  Pokémon (liens), statut (« Je possède cette carte », « Marquer comme commandée » ; quitter
  « possédée » demande confirmation, comme sur la fiche), prix payé, prix Cardmarket
  (`PricePanel`). Chaque action est annoncée avec « Annuler ».
- [ ] **Step 3 : Supprimer la collection** : confirmation qui dit ce qui reste (possédées, au
  Pokédex ; commandées et dans une commande, comme cartes seules) et ce qui part ; puis retour à
  `/collections`, annoncé avec « Annuler ».
- [ ] **Step 4 : La fiche d'un Pokémon** : une carte qui est une case d'une collection n'a pas
  « Retirer la carte » actif ; l'aide dit « Elle fait partie de votre collection {nom} : elle se
  retire avec elle. »
- [ ] **Step 5 : Vérifier** `bun lint`, `bun test`, `bun run build` ; docs.
- [ ] **Step 6 : Commit** — `Collections : la page d'une collection`

### Task 6 : L'accueil, le Pokédex public, les docs

**Files :**
- Modify : `src/pages/home/ProgressPanel.tsx` (ou un panneau voisin), `src/pages/VitrinePage.tsx`,
  `docs/interface.md`, `docs/compte-et-synchronisation.md`, `README.md`, `CLAUDE.md`
- Test : aucun (interface).

**Interfaces :**
- Consumes : `seriesProgress`, `SeriesGrid`, `seriesPath`.

- [ ] **Step 1 : L'accueil** : la progression de chaque collection sous celle du Pokédex (drapeau,
  nom, « 87 / 230 », lien vers sa page) ; rien de plus sans collection.
- [ ] **Step 2 : Le Pokédex public** : après le Pokédex, ses collections d'extensions : pour
  chacune, drapeau, nom, progression et `SeriesGrid` en lecture seule (`linked` faux). Jamais un
  prix payé, une commande ni « commandée ».
- [ ] **Step 3 : Docs** : `docs/interface.md`, `docs/compte-et-synchronisation.md` (Pokédex
  public), `README.md` (Collections), `CLAUDE.md` (première phrase : les collections
  d'extensions ; rester court).
- [ ] **Step 4 : Vérifier** `bun lint`, `bun test`, `bun run build`.
- [ ] **Step 5 : Commit** — `Accueil et Pokédex public : les collections d'extensions`

### Après les tâches

Revue de toute la branche, puis vérification de bout en bout par le contrôleur au navigateur :
commencer une extension japonaise et une française (cartes déjà possédées reprises), marquer une
case possédée (elle rejoint son Pokémon), un dresseur possédé (accueil, valeur), la liste d'achats
et la prochaine commande (deux cases du même Pokémon), supprimer une collection puis « Annuler »,
l'accueil, le Pokédex public.
