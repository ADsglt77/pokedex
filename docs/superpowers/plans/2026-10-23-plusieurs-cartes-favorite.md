# Plusieurs cartes par Pokémon et la favorite : plan de construction (livraison 2 sur 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** un Pokémon peut avoir plusieurs cartes ; le Pokédex montre sa favorite, choisie par
l'utilisateur ; il est débloqué dès qu'une de ses cartes est possédée.

**Architecture :** la collection gagne `favorites` (numéro du Pokémon → id de carte), tenue par les
règles de `src/lib/collection.ts` (la première carte d'un Pokémon devient sa favorite ; ensuite,
seul l'utilisateur en change) et complétée à la lecture d'un document d'avant (`readCollection`) :
aucune migration à lancer, aucun export perdu. Le Pokédex donne pour chaque Pokémon sa favorite,
toutes ses cartes et son état (possédée si l'une l'est). La fiche du Pokémon montre toutes ses
cartes ; ajouter une carte, depuis la fiche ou le catalogue, ne remplace plus rien.

**Tech Stack :** React 19, Vite, TypeScript, `@camply/ui`, zustand ; serveur Bun, Elysia,
`bun:sqlite` ; tests `bun test`.

**Spec :** `docs/superpowers/specs/2026-10-22-collections-et-cartes-francaises-design.md`, sections
« Une carte, ses variantes », « Le Pokédex et la carte favorite », « Les données existantes » et la
livraison 2 de « Ordre de construction ». Les collections de séries (livraison 3) auront leur plan.

## Global Constraints

- Un seul dépôt : `C:\Users\adrie\Documents\dev\pokedex`, branche `plusieurs-cartes` partie de
  `main`. L'API des données ne change pas (pas de `bun run contracts`).
- Lire `CLAUDE.md` et la page du domaine avant d'y toucher (`docs/collection-et-achats.md`,
  `docs/compte-et-synchronisation.md`, `docs/interface.md`, `docs/cartes.md`) ; la tenir à jour
  dans la tâche qui change le comportement.
- Code volontairement simple : aucune vérification défensive, sauf sur ce qui vient de l'extérieur
  (`src/lib/transfer.ts`). En-tête français par module, textes en français avec vouvoiement, un
  Pokémon sans carte possédée est « à débloquer ». Après chaque tâche : `bun lint`, `bun test`,
  `bun run build`, `bun run format`.
- Commits : un par tâche, en français dans le style de `git log`, terminés par
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Jamais de push.
- **Le modèle** : `CollectionData.favorites: Record<number, string>` — clé : numéro du Pokémon (une
  chaîne en JSON), valeur : l'id d'une carte de `customCards` dont `dexIds` contient ce numéro.
  **Invariant** : un Pokémon qui a au moins une carte a exactement une favorite, l'une de ses
  cartes ; un Pokémon sans carte n'en a pas. `schemaVersion` reste `1` (un champ ajouté, les
  documents d'avant se lisent).
- **L'app ne choisit jamais la favorite**, sauf la première carte d'un Pokémon (d'office). Rien
  n'est proposé quand une carte est obtenue.
- **Débloqué** : une de ses cartes est possédée, quelle qu'elle soit ; la favorite ne décide que de
  la carte affichée.
- Une carte n'existe qu'une fois : achetée une fois, comptée une fois (valeur, liste d'achats, coût
  pour compléter, budget). Une Reverse n'est pas une carte à part (rien à faire ici : le catalogue
  n'a qu'une carte par numéro).
- Une carte TAG TEAM peut être la favorite de chacun de ses Pokémon, chacun pour soi.
- La prochaine commande (`planPurchase`) garde « une carte par Pokémon » : toutes les cartes de
  cette livraison sont des cartes du Pokédex. Inchangée.
- Le Pokédex public (`/pseudo`) montre la favorite de chaque Pokémon ; jamais un prix payé, une
  commande ni un statut « commandée » (règle existante, testée).
- Interface : `@camply/ui` d'abord (skill `camply-ui` ; `RadioGroup`/`Radio`, `Badge` et l'icône
  `Star` existent) ; couleurs seulement dans `styles/theme.css`. Pas de tests d'interface.

## Review Focus

1. Un compte enregistré avant cette livraison (document sans `favorites`) : son Pokédex, ses fiches
   et son Pokédex public s'affichent comme avant, chaque Pokémon avec sa carte, sans rien faire ;
   le premier envoi enregistre les favorites. → Tâche 2 (route du Pokédex public sur un document
   d'avant).
2. Retirer la favorite d'un Pokémon qui a d'autres cartes, puis « Annuler » : la carte et la
   favorite reviennent telles quelles. → Tâche 1 (les règles ne modifient pas ce qu'elles
   reçoivent, `setFavorite` et `removeCard` avec nouvelle favorite compris).
3. Un Pokémon débloqué par une carte qui n'est pas sa favorite : pochette en couleur avec la marque
   « possédée », absent du coût pour compléter ; sa favorite non possédée reste dans la liste
   d'achats. → Tâche 3.
4. La même carte du catalogue ajoutée deux fois au même Pokémon (fiche ou catalogue) : jamais de
   doublon. → Tâches 4 et 5 (interface : vérifié à la main par le contrôleur).
5. Un fichier retouché dont une favorite désigne une carte d'un autre Pokémon ou une carte absente :
   refusé, la règle dite en clair, sans planter la lecture. → Tâche 2.

---

### Task 1 : La favorite dans la collection (modèle et règles)

**Files :**
- Modify : `src/types.ts` (`CollectionData.favorites` ; le commentaire de `customCards` : plus
  « une par Pokémon »), `src/lib/collection.ts`, `src/store/collection.ts`, `tests/fixtures.ts`,
  `docs/collection-et-achats.md`
- Test : `tests/cards.test.ts` (son en-tête dit aussi la favorite)

**Interfaces :**
- Produces (`src/lib/collection.ts`) :
  - `emptyCollection()` → `favorites: {}`.
  - `completeFavorites(favorites: Record<number, string>, cards: Iterable<PokemonCard>): Record<number, string>`
    — une nouvelle table : chaque Pokémon de ces cartes qui n'a pas de favorite reçoit la première
    d'entre elles qui le porte ; les favorites déjà là ne changent pas.
  - `saveCard(data, card, now)` — ajoute ou corrige (même id) ;
    `favorites = completeFavorites(data.favorites, [card])`.
  - `setFavorite(data: CollectionData, speciesId: number, cardId: string, now: string): CollectionData`.
  - `removeCard(data, cardId, speciesId, now, favorite?: string)` — détache ou supprime comme
    aujourd'hui ; si `cardId` était la favorite de `speciesId` : `favorite` la remplace (l'appelant
    la donne quand le Pokémon garde d'autres cartes), sans autre carte la favorite de `speciesId`
    disparaît. Les favorites des autres Pokémon d'une TAG TEAM ne changent pas.
- Produces (store) : `setFavorite(speciesId: number, cardId: string) => void` ;
  `removeCard(cardId: string, speciesId: number, favorite?: string) => void`.
- Produces (`tests/fixtures.ts`) : `withCards(data: CollectionData, ...cards: PokemonCard[]): CollectionData`
  — `customCards` de ces cartes, dans l'ordre, et `favorites = completeFavorites({}, cards)`.

- [ ] **Step 1 : Écrire les tests** (`describe('la carte favorite')`, avec `withCards`) :
  - `la première carte d’un Pokémon devient sa favorite ; une deuxième ne la change pas` :
    `saveCard` de `a` [25] puis de `b` [25] → `favorites` vaut `{ 25: 'a' }`.
  - `une carte TAG TEAM devient la favorite de ceux de ses Pokémon qui n’en ont pas` : `a` [25],
    puis `saveCard` de `tag` [25, 644] → `{ 25: 'a', 644: 'tag' }`.
  - `corriger une carte (même id) garde les favorites`.
  - `changer la favorite d’un Pokémon ne touche pas aux autres` : `tag` favorite de 25 et 644,
    `setFavorite(data, 25, 'a', NOW)` → `{ 25: 'a', 644: 'tag' }`, `updatedAt` vaut `NOW`.
  - `retirer la favorite : celle désignée la remplace` : `a`, `b` [25], `a` favorite ;
    `removeCard(data, 'a', 25, NOW, 'b')` → `{ 25: 'b' }`, `customCards.a` absente.
  - `retirer une autre carte garde la favorite`.
  - `retirer la dernière carte d’un Pokémon : il n’a plus de favorite` → `favorites` sans clé 25.
  - `une TAG TEAM retirée d’un Pokémon reste la favorite des autres` : `tag` favorite de 25 et 644,
    `a` [25] ; `removeCard(data, 'tag', 25, NOW, 'a')` → `{ 25: 'a', 644: 'tag' }`, `tag.dexIds`
    vaut `[644]`.
  - Dans `les règles ne modifient pas ce qu’elles reçoivent`, ajouter `setFavorite(…)` et
    `removeCard(…, 'b')` (favorite remplacée).
  - `withCard` du fichier passe par `withCards`.
- [ ] **Step 2 : Les lancer** (`bun test tests/cards.test.ts`) — attendu : échec (`setFavorite`
  inconnue, `favorites` absent).
- [ ] **Step 3 : Implémenter** les signatures ci-dessus ; `cardSpecies` reste (la fenêtre d'ajout
  s'en sert encore, tâche 4).
- [ ] **Step 4 : Relancer** `bun test`, `bun lint`, `bun run build` — attendu : tout passe.
- [ ] **Step 5 : Docs** : `docs/collection-et-achats.md` dit `favorites`, l'invariant, qui la
  choisit (la première carte d'office, ensuite l'utilisateur), et le retrait d'une favorite.
- [ ] **Step 6 : Commit** — `Collection : plusieurs cartes par Pokémon, une favorite`

### Task 2 : Les favorites lues, contrôlées, montrées

**Files :**
- Modify : `src/lib/transfer.ts` (`readCollection`, `documentProblem`), `server/vitrine.ts`
  (`shownCollection` ; la route lit la collection par `readCollection`),
  `docs/collection-et-achats.md`, `docs/compte-et-synchronisation.md`
- Test : `tests/import.test.ts`, `tests/vitrine.test.ts`, `tests/collection.test.ts`

**Interfaces :**
- Consumes : `completeFavorites`, `withCards` (tâche 1).
- Produces :
  - `readCollection(value)` rend toujours `favorites` : `value.favorites` si c'est un objet (sinon
    `{}`), complétée par `completeFavorites` avec les cartes de `value.customCards` qui sont des
    objets à `dexIds` tableau. Une carte abîmée n'en donne pas : `documentProblem` la refuse
    ensuite, la lecture ne plante jamais. Un document d'avant reçoit ainsi pour chaque Pokémon sa
    première carte (celle que le Pokédex montrait), comme un fichier dont il manque des favorites.
  - `documentProblem`, après le contrôle des cartes : une favorite dont la valeur n'est pas l'id
    d'une carte de `customCards` portant ce numéro →
    `` `la carte favorite du Pokémon n° ${key} n’est pas une de ses cartes` ``.
  - `shownCollection` recopie `favorites`, entrée par entrée.
  - `GET /api/vitrine/<pseudo>` : `shownCollection(readCollection(JSON.parse(row.collection))!)`
    (un document enregistré avant cette livraison n'a pas `favorites`).

- [ ] **Step 1 : Écrire les tests** :
  - import, `un export d’avant les favorites s’importe : chaque Pokémon a pour favorite sa première
    carte` : `a` [25], `b` [25, 4], `c` [7], sans clé `favorites` → `{ 25: 'a', 4: 'b', 7: 'c' }`,
    cartes et statuts inchangés.
  - import, `une favorite manquante est complétée, celles notées restent` : `{ 25: 'b' }` avec `a`,
    `b` [25] et `c` [7] → `{ 25: 'b', 7: 'c' }`.
  - import, `une favorite qui n’est pas une carte de son Pokémon est refusée` : `{ 25: 'c' }` (`c`
    est de 7), `{ 25: 'zz' }`, `{ x: 'a' }` → refusés, le problème contient « favorite ».
  - import, `une carte abîmée dans un document d’avant est refusée, sans planter la lecture` :
    `dexIds: 'x'`, sans `favorites` → `readImport` rend un problème, ne lève pas.
  - Les documents d'essai qui ont des cartes prennent leurs favorites (`withCards`) : sans elles,
    « se réimporte tel quel » et « accepté tel quel » ne tiendraient plus.
  - vitrine, `les favorites restent : le Pokédex public montre la favorite de chaque Pokémon`.
  - `tests/collection.test.ts` (Pokédex public), `un Pokédex enregistré avant les favorites est montré
    avec la première carte de chaque Pokémon` : écrire directement dans la table `collections` un
    document sans `favorites` (carte `a` [25], possédée), puis `GET /api/vitrine/<pseudo>` →
    `collection.favorites` vaut `{ 25: 'a' }`.
- [ ] **Step 2 : Les lancer** — attendu : échec.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Relancer** `bun test`, `bun lint`, `bun run build` — attendu : tout passe.
- [ ] **Step 5 : Docs** : champs gardés par `readCollection` (avec `favorites`), complétion d'un
  document d'avant, règle de `documentProblem` ; le Pokédex public montre les favorites et relit un
  document d'avant.
- [ ] **Step 6 : Commit** — `Collection : les favorites lues, contrôlées et montrées`

### Task 3 : Le Pokédex de plusieurs cartes

**Files :**
- Modify : `src/lib/pokedex.ts` (`PokedexEntry`, `buildPokedex`), `src/lib/filters.ts`
  (`filterEntries`), `src/lib/wishlist.ts`, `src/lib/prices.ts` (`completionCost`),
  `src/components/PokedexTile.tsx`, `src/pages/home/TodoPanel.tsx`,
  `src/pages/pokemon/PokemonPage.tsx` (`PossessionStatement` seulement),
  `docs/collection-et-achats.md`, `docs/interface.md`
- Create : `tests/pokedex.test.ts` (en-tête : le Pokédex de plusieurs cartes, la favorite montrée,
  débloqué par n'importe laquelle de ses cartes possédée)
- Test : `tests/prices.test.ts`, `tests/purchase-planner.test.ts` (son aide `entry` et la liste
  d'achats)

**Interfaces :**
- Consumes : `CollectionData.favorites` (tâche 1).
- Produces :

```ts
export interface PokedexEntry {
  species: PokemonSpecies
  /** Sa favorite, la carte que montre le Pokédex ; `null` tant qu'il n'a pas de carte. */
  card: CardView | null
  /** Toutes ses cartes, dans l'ordre d'ajout, la favorite comprise. */
  cards: CardView[]
  /** Où il en est : `owned` si une de ses cartes est possédée, sinon `ordered` si une est commandée. */
  status: CardStatus | null
  /** Débloqué : une de ses cartes est possédée (`status === 'owned'`). */
  unlocked: boolean
}
```

  - `buildPokedex` reprend toujours une entrée inchangée (même favorite, mêmes cartes aux mêmes
    statuts) : les pochettes mémoïsées ne se redessinent pas.
  - `cardNeeds(view: CardView, filter: 'no-image' | 'no-cardmarket' | 'no-paid'): boolean`
    (`src/lib/filters.ts`). `filterEntries` : possession `ordered` → `status === 'ordered'` ;
    `with` / `without` → le Pokémon a des cartes ou non ; les trois autres → une de ses cartes
    `cardNeeds`.
  - `wishlistRows` : toutes les cartes de tous les Pokémon, ni possédées ni commandées, chacune une
    fois (une TAG TEAM une fois).
  - `completionCost` : pour chaque Pokémon à `status === null`, le prix de sa favorite ; `noCard`
    sans carte ; une même carte comptée une fois. Un Pokémon débloqué, ou dont une carte est
    commandée, ne compte pas.
  - `PokedexTile` et `PossessionStatement` lisent `entry.status`, plus la favorite.
  - `TodoPanel` : « Pokémon sans carte » compte des Pokémon ; les trois autres, les cartes
    distinctes qui `cardNeeds`, parmi toutes celles du Pokédex.

- [ ] **Step 1 : Écrire les tests** (collections faites avec `withCards`, `setFavorite`,
  `setCardStatus`) :
  - `la favorite est la carte montrée ; toutes ses cartes sont là, dans l’ordre d’ajout` : `a`,
    `b` [25], favorite `b` → `card.card.id` vaut `'b'`, les ids de `cards` `['a', 'b']`.
  - `débloqué dès qu’une de ses cartes est possédée, même pas sa favorite` : `a` favorite sans
    statut, `b` possédée → `unlocked` vrai, `status` `'owned'`, `progress.unlocked` 1.
  - `aucune possédée, une commandée : à débloquer, commandée` → `status` `'ordered'`, `unlocked`
    faux.
  - `une carte TAG TEAM : favorite de l’un, une carte de plus pour l’autre` : `a` [25], `tag`
    [25, 644] → 25 : favorite `a`, cartes `['a', 'tag']` ; 644 : favorite `tag`.
  - `un Pokémon débloqué une fois, au jour de sa première carte obtenue` (`unlockEvents`) : deux
    cartes possédées, obtenues deux jours différents → un évènement, au premier jour.
  - prix, `coût pour compléter : la favorite d’un Pokémon à débloquer, rien pour un Pokémon
    débloqué par une autre carte ni pour celui dont une carte est commandée` : `value` égale au seul
    prix de la favorite attendue.
  - liste d'achats, `toutes les cartes à acheter d’un Pokémon, pas seulement sa favorite` : `a`
    sans statut, `b` possédée, `c` sans statut, toutes de 25 → lignes `['a', 'c']`. L'aide `entry`
    rend `cards`, `status` et `unlocked`.
- [ ] **Step 2 : Les lancer** — attendu : échec.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Relancer** `bun test`, `bun lint`, `bun run build` — attendu : tout passe.
- [ ] **Step 5 : Docs** : liste d'achats (toutes les cartes voulues), coût pour compléter (la
  favorite des Pokémon à débloquer), « débloqué », sens des filtres du Pokédex et des « À faire ».
- [ ] **Step 6 : Commit** — `Pokédex : la favorite montrée, débloqué par n'importe quelle carte`

### Task 4 : La fiche du Pokémon : toutes ses cartes, la favorite au choix

**Files :**
- Create : `src/pages/pokemon/CardList.tsx`, `src/pages/pokemon/CardList.module.css`
- Modify : `src/pages/pokemon/PokemonPage.tsx`, `src/pages/pokemon/CardSheet.tsx`,
  `src/pages/pokemon/CardActions.tsx`, `src/pages/pokemon/CardForm.tsx`,
  `src/components/ConfirmDialog.tsx` (`confirmDisabled?: boolean`), `src/lib/collection.ts`
  (`cardSpecies` retirée), `src/lib/pokedex.ts` (`unlockedWithout`), `docs/interface.md`,
  `README.md` (« Fiche »)
- Test : aucun (interface) ; le contrôleur vérifie dans le navigateur.

**Interfaces :**
- Consumes : `PokedexEntry.cards` et `.status` (tâche 3) ; store `setFavorite`,
  `removeCard(cardId, speciesId, favorite?)` (tâche 1).
- Produces : `CardList({ entry, shownId, onShow }: { entry: PokedexEntry; shownId: string; onShow: (cardId: string) => void })` ;
  `unlockedWithout(entry: PokedexEntry, cardId: string): boolean` (une autre de ses cartes est
  possédée).

- [ ] **Step 1 : La page.** `SpeciesPage` a pour clé le numéro du Pokémon (rien ne passe d'une
  fiche à l'autre). La carte montrée : celle choisie dans la liste, sinon la favorite ; une carte
  qui apparaît (ajoutée, ou rétablie par « Annuler ») devient la carte montrée ; une carte montrée
  qui disparaît laisse la place à la favorite (le focus va au titre de la fiche, comme
  aujourd'hui). `CardStage` et `CardSheet` montrent la carte montrée ; `SpeciesAbout` montre le
  dessin quand le Pokémon n'a aucune carte.
- [ ] **Step 2 : `CardList`**, sous la phrase de possession, dès une carte : un bouton par carte
  (petite image `CardArt` ou dessin de l'espèce, référence, drapeau), `aria-pressed` sur la carte
  montrée ; la favorite marquée d'une `Star` et dite « favorite » dans son nom accessible ; puis
  « Ajouter une carte » (`Plus`), qui ouvre `CardFormWindow` (`card={null}`).
- [ ] **Step 3 : `CardSheet`** : un badge « Favorite » (`Star`) dans le titre quand la carte montrée
  est la favorite du Pokémon.
- [ ] **Step 4 : `CardActions`** (reçoit `entry`) :
  - « Mettre en favorite » (`Star`), quand la carte n'est pas la favorite de ce Pokémon →
    `setFavorite`, annoncé « Carte {référence} mise en favorite de {nom}. » avec « Annuler ».
  - « Retirer la carte », favorite d'un Pokémon qui a d'autres cartes : toujours une confirmation,
    « Retirer la carte favorite ? », avec un `RadioGroup` « Nouvelle favorite de {nom} » (ses autres
    cartes : référence et statut), rien de coché, confirmer impossible avant un choix ; possédée,
    elle dit aussi ce qui part. Sinon, comme aujourd'hui.
  - Les phrases « {nom} ne sera plus débloqué » (quitter « possédée », retirer une carte possédée)
    seulement pour les Pokémon qui le perdraient (`unlockedWithout`) ; « vous pourrez lui choisir
    une autre carte » disparaît. L'aide sous les boutons (carte d'un seul Pokémon, hors commande) :
    « La retirer efface son statut et son prix payé. »
- [ ] **Step 5 : `CardForm`** : une carte choisie dans le catalogue (référence inchangée) va à tous
  ses Pokémon (`picked.dexIds`), une saisie à la main à ce Pokémon ; `cardSpecies` disparaît. Si la
  carte choisie est déjà l'une des siennes (`isCatalogCard` sur `entry.cards`), « Ajouter » est
  désactivé et la fenêtre dit « {nom} a déjà cette carte. »
- [ ] **Step 6 : Vérifier** `bun lint`, `bun test`, `bun run build` — attendu : tout passe ; puis
  docs (`docs/interface.md` : la fiche ; `README.md` : « Fiche »).
- [ ] **Step 7 : Commit** — `Fiche d'un Pokémon : toutes ses cartes, la favorite au choix`

### Task 5 : Le catalogue ajoute une carte sans rien remplacer

**Files :**
- Modify : `src/pages/catalog/CardDetails.tsx` (`useCollectionPlace`, `placeText`,
  `AddToCollection`), `docs/cartes.md`, `README.md` (« Catalogue », « Achats »), `CLAUDE.md`
  (première phrase)
- Test : aucun (interface).

**Interfaces :**
- Consumes : `PokedexEntry.cards` (tâche 3), `addCard` (favorite d'office par `saveCard`).
- Produces : `useCollectionPlace(card)` → `{ mine: CardView | null; holders: number[] }` : `mine`,
  la carte de la collection qui est celle-ci (`isCatalogCard`) parmi toutes les cartes de ses
  Pokémon ; `holders`, ceux de ses Pokémon qui ont déjà des cartes.

- [ ] **Step 1 : Implémenter.** `placeText` : `mine` → « Dans votre collection, {statut}. » ; aucun
  `holders` → « Pas encore dans votre collection. » ; sinon « {noms} {a/ont} déjà des cartes :
  celle-ci s’y ajoute, à acheter, sans changer leur favorite. » `AddToCollection` : plus de
  confirmation ni de remplacement, jamais retenu par une commande ; annoncé « Carte {référence}
  ajoutée à {noms}, à acheter. »
- [ ] **Step 2 : Vérifier** `bun lint` (knip : les imports devenus inutiles partent), `bun test`,
  `bun run build` — attendu : tout passe.
- [ ] **Step 3 : Docs** : `docs/cartes.md` (l'ajout depuis le catalogue) ; `README.md` (Catalogue :
  plus de remplacement ; Achats : toutes les cartes voulues) ; `CLAUDE.md`, première phrase :
  « pour chacun des 1 025 Pokémon, les cartes que l'utilisateur choisit, dont une favorite que
  montre le Pokédex ».
- [ ] **Step 4 : Commit** — `Catalogue : ajouter une carte sans remplacer celles du Pokémon`

### Après les tâches

Revue de toute la branche, puis vérification de bout en bout par le contrôleur dans le navigateur
(`bun dev`, `bun run dev:server`, API des données) : un compte d'avant garde ses cartes, chacune
favorite ; une deuxième carte ajoutée à Pikachu (fiche et catalogue) ; la favorite changée, visible
au Pokédex ; la favorite retirée avec le choix de la suivante, puis « Annuler » ; un Pokémon débloqué
par une carte non favorite ; le Pokédex public.
