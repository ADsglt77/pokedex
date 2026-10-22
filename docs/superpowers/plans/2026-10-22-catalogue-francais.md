# Catalogue français : plan de construction (livraison 1 sur 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** les cartes françaises au catalogue, à côté des japonaises : une carte seule peut être
française, avec un interrupteur 🇯🇵 / 🇫🇷 dans le Catalogue et la fenêtre d'ajout.

**Architecture :** la langue (`'ja' | 'fr'`) entre dans les clés du catalogue de l'API des données
(nouvelle étape du schéma) ; l'ingestion lit aussi la zone française de Pokécardex ; tout ce qui est
japonais garde ses adresses (routes, réponses, chemins d'images), le français a les siennes
(`/fr/`). Côté site, une carte porte `language: 'fr'` (absent : japonaise) ; le catalogue, les
images, le lien Cardmarket et la liste de souhaits suivent cette langue.

**Tech Stack :** Bun, Elysia, SQLite (`bun:sqlite`), React 19, Vite, TypeScript, `@camply/ui`.

**Spec :** `docs/superpowers/specs/2026-10-22-collections-et-cartes-francaises-design.md`
(livraison 1). Les livraisons 2 (plusieurs cartes par Pokémon, favorite) et 3 (collections de
séries) auront leur plan, écrit une fois celle-ci en place.

## Global Constraints

- Deux dépôts : `C:\Users\adrie\Documents\dev\pokedex-data` (« data ») et
  `C:\Users\adrie\Documents\dev\pokedex` (« site »). Lire le `CLAUDE.md` et les `docs/` de chacun
  avant d'y toucher ; tenir les docs à jour dans la tâche qui change le comportement.
- Code volontairement simple, en-tête français par module, textes en français avec vouvoiement,
  Prettier (pas de point-virgule, guillemets simples, 100 colonnes). Après chaque tâche, dans le
  dépôt touché : data `bun run typecheck`, `bun test`, `bun run lint` (si knip ne démarre pas sur ce
  poste : `../pokedex/node_modules/.bin/knip.exe --directory ../pokedex-data`, et le dire) ; site
  `bun lint`, `bun test`, `bun run build`.
- Commits : un par tâche (ou par étape « Commit »), messages en français dans le style de
  `git log`, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Jamais de
  push.
- Langues : `type CardLanguage = 'ja' | 'fr'` (contrat, copié dans le site). Colonne SQLite `lang`.
  Dans l'adresse du site : `?langue=fr` ; absent = japonais.
- **Le japonais ne change pas d'adresse** : routes `/v1/catalog/species/<n>`, `/v1/catalog/sets`,
  `/v1/catalog/sets/<code>`, réponses `catalog/…`, images `/images/cards/<SET>/<n>-<md|hd>.webp`
  et `/images/sets/<SET>-<md|hd>.webp`. **Le français** : `/v1/catalog/fr/species/<n>`,
  `/v1/catalog/fr/sets`, `/v1/catalog/fr/sets/<code>`, réponses `catalog/fr/…`, images
  `/images/cards/fr/<SET>/<n>-<md|hd>.webp` et `/images/sets/fr/<SET>-<md|hd>.webp`.
- Les formes des réponses du catalogue ne changent pas (`FORMAT` inchangé) ; pour le français,
  « sortie » = la sortie en France (`releaseDateFR` de sa page).
- Pokécardex, zone française : séries à `/series/<code>`, cartes à `/carte/<id>`, menu
  `seriesMenu.blocksByRegion.FR`, logos à `assets/images/logos/<code>.png`. Une page toutes les
  3 s, même User-Agent, jamais de défi anti-robot.
- **Les numéros de cartes et les codes de séries de Pokécardex se télescopent** entre zones
  (vérifié : carte 7091 = Alakazam du Set de base en FR, Regirock SM4A en JP ; codes SVP, SM10,
  XY, SVI… dans les deux).
- **Aucune copie d'image à la demande** (décidé) : toutes sont copiées d'avance par la tâche
  `images` ; une image absente répond 404 (la carte de substitution).
- Les cartes Pokécardex marquées `only_english` (≠ 0) n'entrent pas au catalogue français.
- Rien ne nomme une source dans ce que voit le navigateur (règle « Anonyme ») ; rien dans le
  navigateur sauf le thème.
- Prix d'une carte française : celui du produit Cardmarket (toutes langues), avec la mention
  « Prix toutes langues » là où le prix d'une carte française s'affiche en grand.

## Review Focus

1. Une carte française au même id Pokécardex qu'une japonaise (7091) : les deux coexistent, aucune
   n'écrase l'autre (catalogue, espèces, images, historique repris). → Tâches 1, 3, 6.
2. Une série française au même code qu'une japonaise (SVP) : deux réponses, deux logos, deux
   dossiers d'images distincts ; la page Catalogue japonaise inchangée. → Tâches 3, 4, 5.
3. Les collections et exports existants, sans `language` : restent japonais, s'importent, et le
   serveur accepte encore leur envoi ; une langue inconnue est refusée. → Tâche 8.
4. Le Pokédex public garde la langue d'une carte (sinon une carte française y deviendrait
   japonaise : mauvaise image, mauvais lien). → Tâche 8.
5. Le lien Cardmarket d'une carte française filtre en français (`language=2`), sauf si sa page
   collée fixe déjà la langue. → Tâche 10.

---

### Task 0 : Repérage de la zone française (data, sans code)

**Files :**
- Modify : `pokedex-data/docs/donnees.md` (nouvelle section « La zone française de Pokécardex »)

**Interfaces :**
- Produces : trois faits notés dans `docs/donnees.md`, que les tâches 2, 3, 5 et 7 lisent :
  (a) le champ qui donne le **nom anglais** d'une série française (celui de l'extension chez
  Cardmarket, « Mega Evolution »), ou « aucun » ; (b) la **règle de l'adresse d'un scan** français
  (dossier, nom de fichier, d'après quel champ de la carte) ; (c) la forme de
  `blocksByRegion.FR` (noms des blocs, séries, decks) et les blocs à écarter s'il y en a.

- [ ] **Step 1 : Lire, avec 6 requêtes au plus (3 s d'écart, User-Agent de `lib/net.ts`)**, le
  script de la page (pour la clé, comme `keyOf`), puis déchiffrer : la page `/series/MEG` (récente)
  et `/series/BS` (ancienne). Chercher (a) dans `currentSeries` et dans les entrées de
  `blocksByRegion.FR[].series[]` ; (b) dans le script de la page, la construction de l'adresse
  d'un scan pour la zone « fr » (chaîne `pokecardex-scans`), puis vérifier par une requête `HEAD`
  le scan de la carte MEG au rang 1 (`sets/BS/1.jpg` répond déjà 200, `sets/MEG/1.jpg` répond 404).
- [ ] **Step 2 : Écrire les trois faits dans `docs/donnees.md`**, avec les requêtes faites.
- [ ] **Step 3 : Commit** — `Docs : la zone française de Pokécardex, repérée`

### Task 1 : La langue dans les clés du catalogue (data, schéma)

**Files :**
- Modify : `pokedex-data/src/db.ts` (une étape ajoutée à la fin de `DATA_STEPS`)
- Test : `pokedex-data/tests/schema.test.ts`

**Interfaces :**
- Produces : les tables, toutes avec `lang TEXT NOT NULL` (`'ja'` | `'fr'`) :
  - `sets` : clé `(lang, id)` ; colonnes d'avant, plus `expansion_name TEXT NOT NULL DEFAULT ''`
    (le nom de l'extension chez Cardmarket ; pour une série japonaise, son `name`) ;
  - `cards` : clé `(lang, id)`, `FOREIGN KEY (lang, set_id) REFERENCES sets (lang, id)` ;
  - `card_species` : clé `(lang, card, rank)`, `FOREIGN KEY (lang, card) REFERENCES cards (lang, id)
    ON DELETE CASCADE`, `WITHOUT ROWID` ;
  - `history_imports` : clé `(lang, card)`, `WITHOUT ROWID` ;
  - index `cards_by_set (lang, set_id)` et `cards_by_cardmarket (cardmarket)`.

- [ ] **Step 1 : Écrire le test `la langue entre dans les clés du catalogue, sans rien perdre`** :
  une base menée jusqu'à l'avant-dernière étape (`migrate(db, 'essai', DATA_STEPS.slice(0, -1))`),
  avec une série `SM4A`, la carte 7091 (Regirock), son Pokémon (377) et sa reprise d'historique
  (`history_imports`) ; puis toutes les étapes. Attendus : la série et la carte ont `lang = 'ja'`,
  `expansion_name` = `name`, la carte a toujours son Pokémon et sa reprise ; on insère ensuite une
  série française `SM4A` et une carte française 7091 (Alakazam, Pokémon 65) sans erreur, et
  `SELECT COUNT(*) FROM cards WHERE id = 7091` vaut 2.
- [ ] **Step 2 : Le lancer** : `bun test tests/schema.test.ts` — attendu : échec (colonne `lang`
  inconnue).
- [ ] **Step 3 : Ajouter l'étape.** SQLite ne change pas une clé, et les clés étrangères sont
  actives (`PRAGMA` sans effet dans une transaction) : copier `card_species`, `history_imports`,
  `cards` et `sets` dans des tables sans contraintes (`CREATE TABLE … AS SELECT`), supprimer les
  quatre (enfants d'abord), les recréer avec les clés ci-dessus, recopier avec des listes de colonnes
  explicites (`'ja'` en tête, `expansion_name = name`), supprimer les copies, recréer les deux index.
  Un commentaire SQL en tête dit pourquoi (les cartes françaises, octobre 2026).
- [ ] **Step 4 : Relancer** `bun test` — attendu : tout passe.
- [ ] **Step 5 : Commit** — `Base : la langue dans les clés du catalogue`

### Task 2 : Lire Pokécardex dans une langue (data)

**Files :**
- Modify : `pokedex-data/src/lib/pokecardex.ts`, `pokedex-data/src/contract.ts` (type)
- Test : `pokedex-data/tests/pokecardex.test.ts` (nouveau)

**Interfaces :**
- Produces :
  - `export type CardLanguage = 'ja' | 'fr'` dans `contract.ts` ;
  - `seriesIn(sitemap: string, lang: CardLanguage): string[]` (pur) et
    `seriesCodes(lang: CardLanguage): Promise<string[]>` (remplace `japaneseSeries`) ;
  - `readSeries(lang: CardLanguage, code: string)` et `readCard(lang: CardLanguage, id: number)` :
    `ja` → `/series/jp/<code>`, `/carte/jp/<id>` ; `fr` → `/series/<code>`, `/carte/<id>` ;
  - `menuBlocks(page, lang)` : `blocksByRegion.JP` ou `.FR` ; `asiaExclusive` reste japonais ;
  - `PokecardexCard.only_english: number | null` ; dans `currentSeries`, le champ du nom anglais
    repéré (Tâche 0), s'il existe.

- [ ] **Step 1 : Écrire les tests** `seriesIn` : sur un plan du site qui contient
  `/series/jp/SV2A`, `/series/chn/CS1`, `/series/MEG`, `/series/BS` : `seriesIn(…, 'ja')` vaut
  `['SV2A']`, `seriesIn(…, 'fr')` vaut `['MEG', 'BS']` ; et `menuBlocks` rend les blocs de la région
  demandée.
- [ ] **Step 2 : Les lancer** — attendu : échec (`seriesIn` inconnu).
- [ ] **Step 3 : Implémenter** ; les appelants (`jobs/catalog.ts`, `jobs/history.ts`) passent `'ja'`
  pour l'instant (comportement inchangé).
- [ ] **Step 4 : Relancer tests, typecheck, lint** — attendu : tout passe.
- [ ] **Step 5 : Commit** — `Pokécardex : lire une série ou une carte dans une langue`

### Task 3 : Le catalogue dans les deux langues (data)

**Files :**
- Modify : `pokedex-data/src/jobs/catalog.ts`
- Test : `pokedex-data/tests/catalog.test.ts` (nouveau)

**Interfaces :**
- Consumes : Tâches 1 et 2.
- Produces :
  - `snapshotName(lang: CardLanguage, rest: string)` : `ja` → `catalog/${rest}`, `fr` →
    `catalog/fr/${rest}` (`rest` : `sets`, `sets/<code>`, `species/<n>`) ;
  - `saveCatalog(db)` refait les réponses des deux langues, chacune d'après ses seules lignes ;
    la suppression des réponses de séries disparues ne touche que le préfixe de sa langue ;
  - `seriesWriter(db)` exporté (pour les tests), toutes ses requêtes avec `lang` ; `save(lang,
    code, page, readAt)` écarte les cartes `only_english` en français et note `expansion_name`
    (japonais : `fullName` ; français : le champ de la Tâche 0, sinon `''`) ;
  - `catalog(db)` lit le japonais puis le français (`dueSeries` par langue ; `asiaExclusive` en
    japonais seulement ; blocs du menu par langue) ; libellés de progression « Séries japonaises »
    et « Séries françaises ».

- [ ] **Step 1 : Écrire les tests** :
  - `une série et une carte françaises au même code et au même id que des japonaises coexistent` :
    `save('ja', 'SVP', page JP avec la carte 7091)` puis `save('fr', 'SVP', page FR avec 7091)` ;
    les deux cartes sont en base, chacune avec ses Pokémon ;
  - `une carte only_english n'entre pas au catalogue français` ;
  - `saveCatalog fait des réponses distinctes par langue` : `catalog/sets` ne liste que la série
    japonaise, `catalog/fr/sets` que la française ; `catalog/sets/SVP` et `catalog/fr/sets/SVP`
    ont chacune leur carte ; `catalog/species/377` et `catalog/fr/species/65` existent.
  (Pages construites à la main dans la forme `PokecardexSeries`.)
- [ ] **Step 2 : Les lancer** — attendu : échec.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Relancer tests, typecheck, lint** — attendu : tout passe.
- [ ] **Step 5 : Commit** — `Catalogue : les séries françaises à côté des japonaises`

### Task 4 : Les routes françaises du catalogue (data)

**Files :**
- Modify : `pokedex-data/src/reference.ts`, `pokedex-data/src/contract.ts` (commentaires : « dans
  sa langue », la sortie en France pour le français)
- Test : `pokedex-data/tests/api.test.ts`

**Interfaces :**
- Produces : `GET /v1/catalog/fr/species/:id`, `GET /v1/catalog/fr/sets`,
  `GET /v1/catalog/fr/sets/:id`, servis par `serveSnapshot` avec `snapshotName('fr', …)` ; mêmes
  schémas de paramètres que leurs pendants japonais.

- [ ] **Step 1 : Écrire le test** `les routes françaises servent les réponses françaises, les
  japonaises restent` : avec des réponses `catalog/sets` et `catalog/fr/sets` différentes en base,
  chaque route rend la sienne (200) ; `/v1/catalog/fr/sets/INCONNU` → 404.
- [ ] **Step 2 : Le lancer** — attendu : échec (404 sur la route française).
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Relancer** — attendu : tout passe.
- [ ] **Step 5 : Commit** — `API : les routes du catalogue français`

### Task 5 : Les images françaises, toutes copiées d'avance (data)

**Files :**
- Modify : `pokedex-data/src/images.ts`, `pokedex-data/src/jobs/images.ts`,
  `pokedex-data/src/config/jobs.ts` (commentaire de `images`)
- Test : `pokedex-data/tests/images.test.ts` (nouveau)

**Interfaces :**
- Consumes : Tâche 0 (règle des scans), Tâche 1.
- Produces :
  - `cardScan(lang, set, rank, size)` et `setLogo(lang, set, size)` : chemins de Global
    Constraints ; les autres chemins inchangés ;
  - `UPSTREAMS` : deux entrées françaises (scan selon la Tâche 0 ; logo
    `${ASSETS}/logos/<SET>.png?class=<size>`), leur `plausible` lit `lang = 'fr'` ; les japonaises
    lisent `lang = 'ja'` ;
  - `serveImage` : sert le fichier s'il existe, sinon 404 — plus de copie à la demande (retirer
    `misses`, `copies`, `inTurn`, `MAX_COPIES` et l'option `quick` de `mirror` s'ils ne servent
    plus) ;
  - la tâche `images` copie logos et scans des deux langues (requêtes avec `lang`).

- [ ] **Step 1 : Écrire les tests** :
  - `un chemin français ne mène qu'à une image française` : avec une série `SVP` dans les deux
    langues, `/images/cards/fr/SVP/1-md.webp` et `/images/cards/SVP/1-md.webp` sont deux fichiers
    distincts, chacun plausible seulement si sa langue a la série ;
  - `une image absente répond 404 sans rien télécharger` : `fetch` remplacé par une fonction qui
    échoue ; `serveImage` sur un chemin plausible sans fichier rend 404.
- [ ] **Step 2 : Les lancer** — attendu : échec.
- [ ] **Step 3 : Implémenter**, et mettre à jour `docs/donnees.md` (images copiées d'avance) et
  les commentaires qui parlent de copie à la demande (`grep -rn "demande" src`).
- [ ] **Step 4 : Relancer** — attendu : tout passe.
- [ ] **Step 5 : Commit** — `Images : les françaises, toutes copiées d'avance`

### Task 6 : Historique et prix suivent la langue (data)

**Files :**
- Modify : `pokedex-data/src/jobs/history.ts`, `pokedex-data/src/jobs/prices.ts:119-133`
- Test : `pokedex-data/tests/history.test.ts`

**Interfaces :**
- Produces : `historyTodo(db): { lang: CardLanguage; id: number; cardmarket: number }[]` exporté
  (les cartes à reprendre : `cardmarket != 0`, absentes de `history_imports` pour leur langue, séries
  les plus récentes d'abord) ; `history(db)` lit `readCard(lang, id)` et note `(lang, card)` ; la
  règle « série récente » de `prices.ts` joint `cards` et `sets` sur `(lang, set_id)`.

- [ ] **Step 1 : Écrire le test** `la reprise d'une carte japonaise ne saute pas la française au même
  id` : cartes 7091 en `ja` (déjà dans `history_imports`) et en `fr` → `historyTodo` ne rend que la
  française.
- [ ] **Step 2 : Le lancer** — attendu : échec.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Relancer** — attendu : tout passe.
- [ ] **Step 5 : Commit** — `Historique : la reprise et les prix suivent la langue`

### Task 7 : Les lignes Cardmarket des cartes françaises (data)

**Files :**
- Modify : `pokedex-data/src/reference.ts:74-97` (requêtes de `wantsLineOf`)
- Test : `pokedex-data/tests/wants.test.ts`

**Interfaces :**
- Produces : `expansionNames` lit `sets.expansion_name` (non vide) en joignant sur `(lang, id)` ;
  `wantsLine` inchangée.

- [ ] **Step 1 : Écrire les tests** : une carte française dont la série a `expansion_name = 'Mega
  Evolution'` → `1x Bulbasaur Bind Down (Mega Evolution)` ; une série française sans
  `expansion_name` → `null` ; les lignes japonaises existantes inchangées.
- [ ] **Step 2 : Les lancer** — attendu : échec sur la ligne française.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Relancer** — attendu : tout passe.
- [ ] **Step 5 : Commit** — `Liste de souhaits : les lignes des cartes françaises`

### Task 8 : La langue d'une carte dans la collection (site)

**Files :**
- Modify : `pokedex/src/types.ts` (copie du contrat : `CardLanguage` ; `PokemonCard.language?: 'fr'`,
  absent = japonaise), `pokedex/src/lib/transfer.ts` (`isCard`), `pokedex/server/vitrine.ts`
  (`shownCollection` recopie `language`), `pokedex/docs/collection-et-achats.md`
- Test : `pokedex/tests/import.test.ts`, `pokedex/tests/vitrine.test.ts`

**Interfaces :**
- Produces : `PokemonCard.language?: 'fr'` ; `cardLanguage(card: PokemonCard): CardLanguage`
  (`card.language ?? 'ja'`) dans `pokedex/src/lib/collection.ts`.

- [ ] **Step 1 : Écrire les tests** : `isCard` accepte une carte sans `language` et une avec
  `language: 'fr'`, refuse `language: 'ja'` (une seule écriture du japonais : l'absence) et
  `language: 'de'` ; un ancien export (sans le champ) s'importe tel quel ; `shownCollection` garde
  `language: 'fr'`.
- [ ] **Step 2 : Les lancer** — attendu : échec.
- [ ] **Step 3 : Implémenter**, puis `bun run contracts` (attendu : OK).
- [ ] **Step 4 : Relancer `bun test`** — attendu : tout passe.
- [ ] **Step 5 : Commit** — `Collection : une carte peut être française`

### Task 9 : Le catalogue et les images du site par langue (site)

**Files :**
- Modify : `pokedex/src/lib/card-catalog.ts`, `pokedex/src/lib/card-images.ts`,
  `pokedex/src/pages/catalog/SetLogo.tsx`, appelants (`CatalogPage`, `CatalogPicker`, `CardSheet`,
  `CardFields`, `useCardDraft`, `MissingImages`, `CardDetails`)

**Interfaces :**
- Consumes : Tâches 4, 5, 8.
- Produces :
  - `CatalogSet.language: CardLanguage` ; `CatalogCard.key` : `« SV2A 166 »` en japonais,
    `« fr MEG 1 »` en français ;
  - `catalogSetsUrl(lang)`, `setCardsUrl(set)`, `loadSets(lang)`, `loadSetCards(set)`,
    `loadSpeciesCards(speciesId, lang)` (adresses de Global Constraints, `/api/…`) ;
  - `catalogImage(lang, set, rank)`, `setLogo(lang, set, size)`, `cardImage(reference, lang)` ;
  - `findCardImage(reference, { lang, retry })` (la même promesse par `(lang, reference)`) ;
  - `isCatalogCard(card, listed)` exige aussi `cardLanguage(card) === listed.set.language`.

- [ ] **Step 1 : Implémenter**, appelants en `'ja'` sauf là où la carte porte sa langue
  (`cardLanguage(card)`).
- [ ] **Step 2 : Vérifier** : `bun lint`, `bun test`, `bun run build` ; dans l'aperçu
  (`.claude/launch.json` : data-api, server, dev), le Catalogue et la fenêtre d'ajout japonais
  inchangés (mêmes images, mêmes adresses).
- [ ] **Step 3 : Commit** — `Catalogue : les chargements et les images par langue`

### Task 10 : Le lien Cardmarket d'une carte française (site)

**Files :**
- Modify : `pokedex/src/lib/cardmarket.ts`, `pokedex/src/components/CardmarketLink.tsx`
- Test : `pokedex/tests/input.test.ts`

**Interfaces :**
- Produces : `cardmarketPage(card: Pick<PokemonCard, 'page' | 'cardmarket' | 'language'>)` : filtre
  `language` = `'2'` pour une carte française, `'7'` sinon ; `minCondition=2` inchangé.

- [ ] **Step 1 : Écrire les tests** : carte française par id → `…idProduct=851072&language=2&minCondition=2` ;
  japonaise inchangée (`language=7`) ; page collée qui porte déjà `language=1` → gardée.
- [ ] **Step 2 : Les lancer** — attendu : échec sur la française.
- [ ] **Step 3 : Implémenter**, et mettre à jour `docs/cartes.md` (le filtre français est à faire
  vérifier par l'utilisateur sur cardmarket.com, comme le japonais).
- [ ] **Step 4 : Relancer** — attendu : tout passe.
- [ ] **Step 5 : Commit** — `Cardmarket : les offres en français pour une carte française`

### Task 11 : L'interrupteur 🇯🇵 / 🇫🇷 dans le Catalogue (site)

**Files :**
- Create : `pokedex/src/components/LanguageSwitch.tsx` (+ `.module.css`), deux drapeaux SVG en
  ligne dans ce composant
- Modify : `pokedex/src/styles/theme.css` (jetons des couleurs des drapeaux, deux thèmes),
  `pokedex/src/pages/catalog/CatalogPage.tsx`, `pokedex/src/pages/catalog/CardDetails.tsx`,
  `pokedex/src/lib/filters.ts` (lecture et écriture de `langue`), `pokedex/docs/interface.md`,
  `pokedex/docs/cartes.md`

**Interfaces :**
- Produces : `LanguageSwitch({ value, onChange }: { value: CardLanguage; onChange: (lang:
  CardLanguage) => void })` — un `SegmentedControl` de camply, libellés accessibles « Cartes
  japonaises » / « Cartes françaises » ; `catalogLanguage(params: URLSearchParams): CardLanguage`
  dans `filters.ts` (`langue=fr` → `'fr'`, sinon `'ja'`).

- [ ] **Step 1 : Implémenter.** Le Catalogue lit `langue` dans l'adresse ; changer de langue
  remplace `langue` et retire `set` (l'extension par défaut : la plus récente de la langue) ; textes
  selon la langue (« Toutes les cartes japonaises… » / « françaises… », « sortie au Japon » / « en
  France ») ; « Ajouter à la collection » (`CardDetails`) pose `language: 'fr'` pour une carte
  française ; son `PricePanel` reçoit la langue (Tâche 13).
- [ ] **Step 2 : Vérifier dans l'aperçu**, catalogue français rempli (Tâche 14, ou au moins la
  série MEG) : basculer JP ↔ FR, choisir une extension française, ouvrir une carte, l'ajouter ;
  `?langue=fr&set=MEG` rouvre la même vue ; clavier et lecteur d'écran sur l'interrupteur ; deux
  thèmes ; console sans erreur.
- [ ] **Step 3 : `bun lint`, `bun test`, `bun run build`.**
- [ ] **Step 4 : Commit** — `Catalogue : l'interrupteur des cartes japonaises et françaises`

### Task 12 : La fenêtre d'ajout en deux langues (site)

**Files :**
- Modify : `pokedex/src/pages/pokemon/CardForm.tsx`, `CatalogPicker.tsx`, `CardFields.tsx`,
  `pokedex/src/hooks/useCardDraft.ts`

**Interfaces :**
- Consumes : Tâches 9, 11.
- Produces : `PickerView.language: CardLanguage` (japonais au départ) ; le brouillon garde une
  langue (`fill` la reprend de la carte choisie ; `read` la rend : `language: 'fr'` ou rien) ; la
  saisie à la main a son propre `LanguageSwitch` (la langue de la carte saisie).

- [ ] **Step 1 : Implémenter** ; l'onglet « Cartes japonaises » devient « Catalogue », avec
  l'interrupteur en tête ; les textes de `CatalogPicker` suivent la langue.
- [ ] **Step 2 : Vérifier dans l'aperçu** (compte d'essai local) : choisir une carte française d'un
  Pokémon, l'enregistrer ; sa fiche montre l'image française, le lien Cardmarket en français ;
  modifier une carte japonaise existante : elle reste japonaise.
- [ ] **Step 3 : `bun lint`, `bun test`, `bun run build`.**
- [ ] **Step 4 : Commit** — `Fenêtre d'ajout : choisir ou saisir une carte française`

### Task 13 : « Prix toutes langues » et la liste de souhaits par langue (site)

**Files :**
- Modify : `pokedex/src/components/PricePanel.tsx` (prop `language?: CardLanguage`),
  `pokedex/src/pages/pokemon/CardSheet.tsx`, `pokedex/src/pages/shopping/WantsDialog.tsx`,
  `pokedex/docs/prix.md`

**Interfaces :**
- Produces : `PricePanel` affiche, pour une carte française, la mention « Prix toutes langues »
  près du prix ; `WantsDialog` présente deux blocs, « Cartes japonaises » et « Cartes françaises »,
  chacun avec ses lignes et sa consigne « Modification en masse » (langue japonais / langue
  français).

- [ ] **Step 1 : Implémenter.**
- [ ] **Step 2 : Vérifier dans l'aperçu** : une carte française montre la mention, une japonaise
  non ; la fenêtre « Copier pour Cardmarket » avec une carte de chaque langue montre deux blocs.
- [ ] **Step 3 : `bun lint`, `bun test`, `bun run build`.**
- [ ] **Step 4 : Commit** — `Prix et liste de souhaits : les cartes françaises`

### Task 14 : Remplir et vérifier de bout en bout, puis les docs

**Files :**
- Modify : `pokedex/deploy/nginx.conf.template:9` (`max_size=4g` → `max_size=12g`),
  `pokedex/CLAUDE.md` et `pokedex-data/CLAUDE.md` (retirer « à venir »), READMEs des deux dépôts
  (le catalogue français, la durée des premiers passages), `pokedex-data/docs/donnees.md`

- [ ] **Step 1 : Lancer en local** `bun run ingest catalog` (data) — attendu : « Séries
  japonaises » puis « Séries françaises » (environ 250 pages, 13 min la première fois), sortie 0.
- [ ] **Step 2 : Lancer `bun run ingest images`** (peut être arrêté et relancé : il reprend) au
  moins jusqu'à ce que les scans de MEG et BS soient copiés.
- [ ] **Step 3 : Vérifier dans l'aperçu** les points de Review Focus 1, 2 et 5 sur des données
  réelles (SVP japonais et français côte à côte ; Alakazam BS et Regirock SM4A) ; puis
  `grep -ri pokecardex dist/` après `bun run build` — attendu : rien.
- [ ] **Step 4 : Mettre à jour docs, CLAUDE.md, READMEs, nginx** ; noter dans le README de data
  l'ordre de déploiement : l'API des données d'abord (ses routes japonaises ne changent pas), puis
  le site ; et sur le VPS, `bun run ingest cards` pour le premier remplissage français (catalogue,
  images, historique : plusieurs heures).
- [ ] **Step 5 : Commit** — `Docs : le catalogue français en place`
