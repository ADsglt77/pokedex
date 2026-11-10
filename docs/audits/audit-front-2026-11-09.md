# Audit du frontend React de pokedex — 9 novembre 2026

**Périmètre** : `pokedex/src`, le site React (UX/UI, mobile, accessibilité, performances,
composants, états, navigation).

**Méthode**
- Parcours réel avec Playwright sur le site local : vos serveurs de développement déjà lancés, et
  un compte de test créé dans la D1 locale.
- Largeurs 1440, 1280 et 390 px ; thèmes clair et sombre ; contraste élevé ; mouvement réduit ;
  clavier.
- Pannes de l'API simulées en bloquant les requêtes dans Playwright.
- Poids mesuré sur une construction locale (`vite build`, dans `dist/`, ignoré par git) et sur la
  page de connexion en ligne (4G lente simulée, CPU ×4).
- Relecture du code par deux agents en lecture seule ; chacun de leurs constats repris ici a été
  revérifié à la ligne citée.

**Grille de lecture** : `docs/interface.md`, le skill `camply-ui`, la skill `frontend-design`.

**Aucun fichier des dépôts modifié.** Les constats de `docs/audit-2026-11.md` déjà traités ne sont
pas repris ; un constat encore présent est cité par son id.

## En bref

- **Le socle est solide.**
  - Le focus est visible partout, le lien d'évitement marche et les nombres de résultats sont
    annoncés.
  - Le mouvement réduit est respecté (animations à 0 ms) et les deux thèmes sont cohérents.
  - Les pannes du catalogue et des prix ont leurs états, et chaque route a un titre d'onglet.
  - Aucune couleur hors de `theme.css` ; seules deux classes internes de camply sont surchargées,
    commentées ; knip ne trouve aucun code mort.
- **À corriger d'abord** :
  - Sur téléphone, la page Catalogue défile de côté (518 px de trop) : une ligne CSS.
  - L'ajout d'une carte depuis le catalogue noie le seul vrai choix (« Ajouter comme ») sous
    quatre champs techniques.
  - Sur téléphone, une session fermée ou des modifications pas encore enregistrées ne se signalent
    que par une icône orange de 16 px.
  - Un appui à côté de la fenêtre d'une carte la ferme et perd la saisie en cours (A11Y-02).
- **Ensuite, la cohérence** :
  - le vocabulaire (« À acheter » contre « Non possédée ») ;
  - la date des prix, absente de la fiche ;
  - cinq présentations différentes de « le serveur ne répond pas » ;
  - deux pages « introuvable » ;
  - le contraste élevé de Windows, où barres de progression, page active et filtre choisi
    disparaissent.
- **Direction visuelle** : quatre pages s'ouvrent sur la même rangée de quatre `Stat` en cartes
  identiques, et les cartes Pokémon, ce qui fait l'identité du site, passent sous la ligne de
  flottaison. Proposition au § « Direction visuelle ».

## Constats

Chaque constat donne : où (fichier:ligne), la preuve (vue dans le navigateur, ou ligne relue), l'effet, et
une proposition qui respecte camply (composant ou prop de camply d'abord, couleurs seulement dans
`theme.css`, classe interne seulement en dernier recours et commentée).

### Élevés

#### MOB-01 — Catalogue : sur téléphone, toute la page défile de côté (518 px de trop)
- **Où** : `src/pages/catalog/CatalogPage.module.css:43` (`.tools { display: grid; gap: … }`).
- **Preuve** : à 390 px, `scrollWidth − clientWidth = 518` ; le champ de recherche sort de l'écran.
  `.tools` n'a pas de colonne déclarée : sa colonne implicite (`auto`) prend la largeur des rangées
  de raretés et de types qui défilent, soit 873 px.
- **Effet** : sur téléphone, la page entière glisse de côté au moindre geste ; la recherche est
  coupée.
- **Proposition** : `grid-template-columns: minmax(0, 1fr);` sur `.tools`. Les rangées gardent leur
  défilement propre. La fenêtre d'ajout (`CardFilters`) ne déborde pas.

#### UX-01 — Ajouter une carte depuis le catalogue : le seul vrai choix est sous quatre champs techniques
- **Où** : `src/pages/pokemon/CardForm.tsx:220` (« Ajouter comme ») et `CardFields.tsx`.
- **Preuve** : après un clic sur une carte du catalogue, la fenêtre passe à l'onglet « La carte
  choisie ». Elle y montre tout le formulaire de saisie : Référence, Adresse de l'image, Id
  Cardmarket, Page Cardmarket, avec leurs aides. « Ajouter comme » (À acheter / Possédée) n'arrive
  qu'en bas (contenu de 782 px pour 698 visibles à 1440 × 900 ; bien plus bas sur téléphone).
- **Effet** : le geste principal de l'app (choisir une carte, dire si on l'a) passe par un écran
  de saisie fait pour le cas rare (carte hors catalogue). On risque d'enregistrer « À acheter » une
  carte qu'on possède, faute d'avoir vu le choix.
- **Proposition** :
  - Pour une carte du catalogue, un résumé : image, référence et drapeau, prix du jour, puis
    « Ajouter comme » en premier.
  - Les quatre champs repliés sous « Modifier les détails » (`Accordion` ou `Spoiler` de camply).
  - L'onglet « Saisie à la main » garde le formulaire complet.

#### NAV-01 — Sur téléphone, une session fermée ou des modifications non enregistrées : une icône orange de 16 px
- **Où** : `src/components/AccountMenu.tsx:118` (libellé `visually-hidden` en mode compact),
  `:193-211` (`useSaveStatusToasts` ne prévient que pour `reloaded` et `refused`) ;
  `src/main.tsx:71` (`ToastProvider position="bottom-left"`).
- **Preuve** :
  - J'ai fait refuser l'envoi de la collection dans Playwright. Sur ordinateur, seul le libellé
    « Hors ligne » en pied de barre latérale le dit, et le toast « Carte ajoutée… », posé en bas à
    gauche, le recouvre pendant 12 s.
  - Le nouvel essai attend 30 s, puis 60, 120… (`store/account.ts:188`).
  - Sous 64rem, il ne reste que l'icône.
  - La session tombe aussi dès qu'on se connecte sur un autre appareil (« un seul à la fois »).
- **Effet** : on continue de cocher des cartes sans savoir que rien n'est enregistré. Sur mobile,
  un onglet fermé par le système perd tout, car `beforeunload` n'y est pas fiable.
- **Proposition** :
  - Dans `Shell`, un `Banner` de camply (`tone="warn"`) quand l'état vaut `offline` ou `expired`,
    avec son action : « Réessayer maintenant » (appelle `save`) ou « Se reconnecter ».
  - Toasts en `bottom-right` sur ordinateur, pour ne plus couvrir le pied de la barre latérale.

### Moyens

#### UX-02 — « Ajouter comme : À acheter », un statut retiré partout ailleurs
- **Où** : `src/config/shopping.ts:10` (`none: 'À acheter'`).
- **Preuve** : `lib/format.ts:169` dit que « À acheter » n'est plus un statut (retiré à votre
  demande). Partout ailleurs, l'absence de statut se dit « Non possédée ».
- **Proposition** : « Non possédée » ; ou, plus simple, un `Switch` « Je la possède déjà »,
  éteint par défaut. Le message reste « Carte ajoutée à Pikachu, possédée. »

#### UX-03 — La fiche d'une carte ne date pas son prix
- **Où** : `src/components/PricePanel.tsx:69-80` (`Stat` « Prix du marché »).
- **Preuve** :
  - Valeur écrit « Prix du marché Cardmarket du 28 octobre 2026 », la fiche n'écrit que
    « 1,50 € ».
  - Avec les prix locaux, arrêtés au 28 octobre, la fiche affiche « il y a 30 jours 6,99 € »
    (30 jours avant le 28 octobre). La courbe « 30 jours », qui va jusqu'au 9 novembre, ne dépasse
    pourtant pas 1,94 €.
- **Effet** : des chiffres qui semblent se contredire dès que le relevé des prix prend du retard,
  et rien pour le voir.
- **Proposition** : la date de la réponse des prix (`PriceFile.date`, déjà dans `store/prices.ts`)
  dans le `hint`, au moins quand ce n'est pas aujourd'hui : « au 28 oct. ».

#### NAV-02 — Compte et Réglages difficiles à reconnaître
- **Où** :
  - `src/components/AccountMenu.tsx:16-28` : le bouton porte l'état (« Enregistrée », icône de
    nuage).
  - `src/components/AppShell.tsx:75`, `:218` et `AppSearch.tsx:43` : icône `Database`.
  - `src/router.tsx:114` : adresse `/donnees`.
- **Preuve** : le pseudo n'apparaît qu'en ouvrant le menu, qui ne propose que « Se déconnecter ».
  Sur téléphone, la barre du haut aligne quatre icônes sans texte : loupe, cylindre, lune, nuage.
- **Proposition** :
  - `Settings` (dans `@camply/ui/icons`) pour Réglages.
  - `/reglages`, avec `/donnees` redirigée pour garder les liens.
  - Le bouton du compte : `Avatar` aux initiales du pseudo et une pastille d'état.
  - Le menu : pseudo, « Voir mon Pokédex public », « Mon compte » (Réglages), la phrase d'état,
    « Se déconnecter ».

#### ETAT-01 — « Le serveur ne répond pas » : cinq présentations, « Réessayer » par endroits seulement
- **Où** :
  - `VitrinePage.tsx:139` : `Unavailable` sans `retry`.
  - `PokedexUnavailable.tsx:14-19` : un wrapper d'`EmptyState` absent de la liste du skill.
  - `CatalogPicker.tsx:66-71` et `ValuePage.tsx:214-219` : un simple `<p className="muted">`.
  - `ValuePage.tsx:87` : une `Alert`.
  - `PricePanel.tsx` (`noPriceText`) : sans bouton, vu dans le navigateur en bloquant
    `/api/prices`.
- **Effet** : sur le Pokédex public ou une fiche, « réessayez » sans bouton : il faut recharger
  toute la page. Le texte et le délai annoncé (« dans un instant », « dans quelques minutes »,
  « plus tard ») changent d'une page à l'autre.
- **Proposition** :
  - `Unavailable` partout, avec `useRetry` : `useRetry(vitrineUrl(pseudo))` dans `VitrineContent`,
    et de même pour le `CatalogPicker`, l'historique de Valeur et les prix d'une fiche.
  - `PokedexUnavailable` devient un `Unavailable`.
  - Une seule formule de délai.

#### ETAT-02 — Deux pages « introuvable »
- **Où** : `NotFoundPage.tsx:16-26` et `VitrinePage.tsx:111-128` (`Missing`).
- **Preuve** : `/pokemon/9999` affiche « Cette page n’est pas dans le classeur », dans la coquille.
  `/pokemon` (le mot est réservé aux pseudos, il tombe donc sur `:pseudo`) affiche « Rien à cette
  adresse », hors de la coquille, sans navigation.
- **Proposition** : un seul contenu (`EmptyState`, « Revenir à l’accueil »), exporté de
  `NotFoundPage` et repris par `Missing`.

#### ETAT-03 — Hors ligne, ouvrir une page jamais visitée recharge l'app vers l'écran d'erreur du navigateur
- **Où** : `src/main.tsx:28-37` (`vite:preloadError` → `location.reload()` quelle que soit la
  cause).
- **Preuve** : dans le code construit (`dist/client/assets/react-*.js`), l'aide de préchargement
  de Vite finit par `return e().catch(i)`, où `i` émet `vite:preloadError`. Un import refusé faute
  de réseau déclenche donc le même rechargement qu'un fichier disparu après un déploiement. Pas
  reproduit dans le navigateur : l'évènement n'existe qu'en construction.
- **Effet** : sans réseau, un clic sur Achats, Valeur, Catalogue, Collections ou Réglages (pages
  chargées à la demande) remplace l'app par l'écran « pas de connexion » du navigateur.
- **Proposition** : `if (!navigator.onLine) return` en tête du gestionnaire ; `ErrorPage` peut
  alors dire « vérifiez la connexion ».

#### A11Y-01 — Contraste élevé de Windows : barres de progression, page active et filtre choisi disparaissent
- **Où** : seul `PossessionMark.module.css` a une règle `forced-colors` (A11Y-04 de l'audit).
- **Preuve** : `forced-colors: active` émulé sur le Pokédex.
  - La réglette des régions et la barre « Progression » de la barre latérale sont invisibles
    (`Progress` de camply, sans nom accessible).
  - « Collections » (`aria-current="page"`) ne se distingue plus des autres entrées.
  - Le filtre « Tous » (`aria-pressed="true"`) ressemble aux autres.
- **Critère** : WCAG 1.4.11 (contraste des éléments non textuels) et 1.4.1 (l'état ne passe que
  par la couleur).
- **Proposition** :
  - Dans `global.css`, sous `@media (forced-colors: active)` :
    `[aria-current='page'], [aria-pressed='true'] { outline: 2px solid Highlight; }`.
  - La règle du remplissage de `Progress` (`background: Highlight`) est à demander à camply.
  - En attendant, la réglette de l'app (`ProgressRuler.module.css`) peut l'avoir elle-même.

#### UX-04 — Raretés : icônes seules, synonymes en double, et un « Sans rareté » qui ressemble à un crayon
- **Où** : `src/components/CardFilters.tsx` et les tuiles du catalogue (`CatalogTile`). Les noms
  viennent de Pokécardex (`lib/card-catalog.ts:60`).
- **Preuve** :
  - Pour Pikachu, dans la fenêtre d'ajout : « Commune » (●) et « C », « Unco » (◆) et « U »,
    « Promo » et « PROMO » sont des filtres distincts.
  - « Sans rareté » est une barre oblique, dessinée aussi sous chaque carte qui n'en a pas (134 des
    176 cartes de M6A). Elle se lit comme une icône « modifier ».
- **Proposition** :
  - Une table d'équivalence des synonymes : de préférence dans `pokedex-data`, à l'ingestion ;
    sinon dans `card-catalog.ts`.
  - Rien sous une carte sans rareté.
  - Un `Tooltip` de camply sur chaque filtre-icône (le nom accessible y est déjà).

#### NAV-03 — Fiche d'une carte du Catalogue : ses Pokémon ne sont pas des liens
- **Où** : `src/pages/catalog/CardDetails.tsx:182-186` (`formatList` des noms).
  `SeriesCard.tsx:35`, dans la même mise en page (`CardLayout`), emploie `<SpeciesLinks>`.
- **Proposition** : déplacer `SpeciesLinks` (`SeriesCard.tsx:64-72`) dans `components/` et
  l'employer aux deux endroits (deux usages, on factorise).

#### MOB-02 — Champs en 14 px : iOS zoome la page à chaque saisie
- **Où** : `.camply-field-control` (camply) : `font-size: 14px` mesuré sur la connexion, la
  recherche du Pokédex, le prix payé et Réglages.
- **Effet** : sur iPhone, Safari agrandit la page à chaque focus dans un champ de moins de 16 px,
  puis la laisse agrandie.
- **Proposition** : à corriger dans camply : `font-size: max(16px, 1em)` sous
  `@media (pointer: coarse)`. Rien côté app, ce serait une classe interne. À confirmer sur un
  iPhone réel.

### Faibles

- **UX-05 — Accueil vide : deux appels principaux rouges.**
  - Où : `HomePage.tsx:40` (« Ouvrir le Pokédex », en tête) et `StartPanel.tsx:32` (« Choisir dans
    le catalogue »).
  - Pourtant la doc demande « un seul appel principal ».
  - Le panneau Progression, à la hauteur de « Pour commencer », garde un grand vide.
  - Proposition : tant qu'aucune carte n'est choisie, le bouton de tête en `variant="secondary"` ;
    l'appel principal est celui de l'étape 1.
- **UX-06 — Page d'une collection d'extension.**
  - Où : `SeriesPage.tsx:64-74`, `:199`.
  - Pas de fil d'Ariane, alors que la fiche d'un Pokémon en a un.
  - Pas de filtre « Toutes / Possédées / Manquantes » sur 176 à 400 cartes grisées, alors que le
    Pokédex public en a un.
  - « Supprimer la collection », en rouge, est la seule action de l'en-tête.
  - Proposition :
    - `Breadcrumbs` « Collections › 30th Celebration ».
    - Un `SegmentedControl` qui masque les cases (`hidden`), comme le Pokédex public.
    - La suppression en bas de page, ou dans un `DropdownMenu` « … ».
- **UX-07 — Fiche d'un Pokémon à 1 280 px : deux panneaux trop étroits.**
  - Où : `CardSheet.module.css:22` (`@container (min-width: 38rem)`).
  - Chaque panneau fait environ 290 px :
    - le titre se coupe en « Carte Raichu (MC / 226) » ;
    - « Marquer comme commandée » passe sur deux lignes.
  - Le titre du panneau répète la ligne de la liste des cartes juste au-dessus (référence, drapeau,
    « Favorite »).
  - Proposition : un seuil vers 46rem, et un titre « Statut » ou « Ma carte ».
- **UX-08 — « Pour compléter le Pokédex : 0,00 € ».**
  - Où : `ValuePage.tsx:112-124`.
  - Le cas : aucun Pokémon chiffré (0 chiffré, 1 023 sans carte).
  - Proposition : « — », comme quand les prix manquent, avec « 1 023 Pokémon sans carte ».
- **UX-09 — Pokédex sans cartes : 49 000 px de haut sur ordinateur, 74 000 sur téléphone.**
  - Les pochettes font 159 × 272 px. Le sprite de 96 px y est réduit à 71 px : une échelle non
    entière, qui brouille le pixel art, en gris pâle.
  - On voit une rangée et demie au premier écran.
  - Proposition :
    - le sprite en 2× entier, avec `image-rendering: pixelated` ;
    - ou une pochette compacte pour un Pokémon sans carte ;
    - sur téléphone, « Choisir par extension » en `IconButton` dans la barre d'outils.
- **UX-10 — Recherche Ctrl K.**
  - Où : `AppSearch.tsx:28-44`.
  - « salameche » trouve Salamèche, mais « reglages » ne trouve pas Réglages. Les pages n'ont
    pas de `keywords` : « compte », « pseudo », « mot de passe » ou « thème » ne trouvent rien.
  - Les libellés diffèrent de la navigation (« Valeur de la collection », « Catalogue par
    extension »).
  - « Importer » est rangé dans « Pages », « Exporter » dans « Actions ».
  - Proposition : `keywords: searchForm(label)` plus quelques synonymes ; les libellés de la
    navigation ; les deux dans « Actions ».
- **UX-11 — Inscription.**
  - Pas d'« Afficher le mot de passe », alors que le compte ne se récupère pas sans lui.
  - Le format du pseudo n'est vérifié que par l'attribut `pattern`, avec la bulle du navigateur,
    dans sa langue et sans redire la règle.
  - L'aperçu « …/é » montre un pseudo refusé comme s'il était valable.
  - Proposition :
    - un `IconButton` `Eye`/`EyeOff` ;
    - une vérification à l'envoi, qui passe par l'`error` du champ (et `FieldAlert`).
- **NAV-04 — ← et → empilent l'historique.**
  - Où : `SpeciesNav.tsx:31`.
  - Trente fiches parcourues demandent trente « Précédent ».
  - À décider : `{ replace: true }` (le fil d'Ariane garde le retour au Pokédex filtré).
- **NAV-05 — Catalogue : rien dans l'adresse.**
  - Où : `CatalogPage.tsx:216-219`.
  - La recherche, les raretés, les types et la fiche ouverte se perdent au retour, à l'inverse du
    Pokédex et des Achats.
- **NAV-06 — Paramètres d'adresse mi-anglais, mi-français.**
  - `generation`, `possession`, `card`, `order` d'un côté ; `vue`, `tri`, `langue`, `carte` de
    l'autre (`lib/filters.ts`).
  - Ne rien casser ; nommer les prochains en français, et le noter en tête de `filters.ts`.
- **LIB-01 — Libellés.**
  - « la vitrine publique » (`DataPage.tsx:20`) au lieu de « Pokédex public » : un nom interne.
  - Le titre d'onglet du Pokédex public n'a pas le nom du site (`VitrinePage.tsx:191`).
  - Le badge « Liste d'achats » n'est pas formaté (`ShoppingPage.tsx:86`) : il afficherait
    « 1025 ». Proposition : passer par `formatInteger`.
- **UI-01 — « Aucun résultat » : trois habillages.**
  - `CatalogPage.tsx:282-287` (`Funnel`, `h3`), `SetPicker.tsx:241-245` (`Search`, sans bouton) et
    `NoMatch.tsx:22-27` (`SearchX`, `h2`).
  - Proposition : `NoMatch` reçoit `headingLevel` et `resetLabel` ; le Catalogue l'emploie.
- **UI-02 — « Rien à planifier » sans action.**
  - Où : `PlannerPanel.tsx:127-133`.
  - Proposition : reprendre les deux liens de `WishlistPanel.tsx:62-78`.
- **DS-01 — Une police jamais chargée.**
  - `--camply-font-mono` vaut « JetBrains Mono », que l'app ne charge pas. La valeur du curseur de
    budget (« 100,00 € », 13 px, rouge), le `Kbd` « Ctrl K » et les nombres de `Meter` tombent sur
    Consolas ou Courier.
  - Proposition : dans `global.css`, `--camply-font-mono: var(--camply-font-display)` (une
    variable publique de camply), avec `font-variant-numeric: tabular-nums`.
- **DS-02 — Une icône, plusieurs sens.**
  - `Layers` sert pour le Catalogue, « Pokémon sans carte », « Pokémon à obtenir » et « Choisir
    par extension ».
  - `Flag` sert pour « Restant ce mois-ci », « Pour compléter » et « Régions complètes ».
  - Proposition : une icône par notion. Pour un Pokémon à obtenir, la marque de possession vide.
- **PERF-01 — La page de connexion charge le code de l'accueil.**
  - Mesuré en ligne : 20 fichiers JS, 256 Ko transférés, 30 requêtes, chargement en 1,96 s
    (4G lente, CPU ×4).
  - `index.html` précharge `shopping` (11 Ko), `prices`, `card-images`, `cardmarket` et `format`,
    soit environ 25 Ko compressés inutiles à un visiteur sans session.
  - C'est le prix de l'accueil et du Pokédex chargés d'emblée, un choix documenté : à garder,
    sauf si la page de connexion devient la porte d'entrée publique.
- **PERF-02 — Pokédex public : toutes ses grilles partagent la même longueur gardée.**
  - Où : `SeriesGrid.tsx:47` (`'collection'`).
  - Une grille allongée à 300 cases, puis « Précédent », et chaque collection repart à 300.
  - Proposition : `linked ? 'collection' : undefined`.
- **SIMP-01 — Pokédex : les filtres actifs écrits un par un.**
  - Où : `PokedexPage.tsx:80-87` ; `onReset` n'est qu'un `setFilters(DEFAULT_FILTERS)`.
  - Proposition : `serializeFilters({ ...filters, descending: false }).size > 0`, et un `onReset`
    interne à `PokedexToolbar`.
- **SIMP-02 — `Vitrine` fait 150 lignes.**
  - Où : `VitrinePage.tsx:153-306`.
  - Choisir « Débloqués » redessine aussi les statistiques, la courbe et les collections.
  - Proposition : un `VitrineBinder` (lignes 254-287) qui porte `shown`.
- **CAMPLY-01 — ARCH-08 de l'audit est toujours là.**
  - Où : `CardActions.tsx:229`, `as unknown as string` sur `Radio.label`.
  - Le cas `Radio` manque aux « Known gaps » du skill `camply-ui` : l'y ajouter en attendant
    DEC-07.

### Accessibilité et mobile, relevés dans le code puis vérifiés dans le navigateur

Les contrastes ont été recalculés : 23 couples texte/fond, dans les deux thèmes, tous à 4,5:1 ou
plus, sauf `.tab:active` en clair (4,2, et seulement pendant l'appui). De l'audit du 2 novembre,
A11Y-01, 03 à 07, 09 et 10 sont corrigés. **A11Y-02 est toujours là** : le contour des radios et
le pouce du `Switch` éteint, à corriger dans camply (DEC-07).

#### A11Y-02 — Un appui à côté ferme la fenêtre d'une carte et perd la saisie (moyen)
- **Où** : `src/pages/pokemon/CardForm.tsx:131-134` (la `Modal` sans `closeOnBackdrop`).
- **Preuve** : dans « Saisie à la main », j'ai tapé une référence puis cliqué sur le fond : la
  fenêtre s'est fermée et la saisie est perdue. camply ferme sur `mousedown` sans rien demander.
  `OrderForm.tsx:111-112` a déjà la parade.
- **Critère** : WCAG 2.5.2 (annulation du pointeur, niveau A).
- **Proposition** : `closeOnBackdrop={false}`, comme `OrderForm`. Dans camply, fermer au `click`
  plutôt qu'au `mousedown`.

#### A11Y-03 — Le focus tombe sur `body` en entrant dans la coquille ou en en sortant (moyen)
- **Où** : `src/components/AppShell.tsx:140`, `:150` (au montage, la coquille laisse le focus en
  place) ; `AuthCard.tsx:45` et `StandalonePage.tsx:27` ne gèrent aucun focus.
- **Preuve** : depuis les mentions légales, « Revenir à l'accueil » au clavier : le focus est sur
  `BODY`. Même chose après la connexion, l'inscription et la déconnexion.
- **Critère** : WCAG 2.4.3. L'en-tête d'`AppShell` promet pourtant « le focus et le défilement à
  chaque changement de page ».
- **Proposition** : la coquille ne laisse le focus en place au montage que pour la première page du
  document (un drapeau de module « app déjà affichée ») ; `AuthCard` et `StandalonePage` mènent le
  focus à leur `<main tabIndex={-1}>`.

#### MOB-03 — Sur téléphone, Valeur ne se trie plus (moyen)
- **Où** : `src/styles/global.css:238-240` (`.stack-table thead { display: none }`) ;
  `ValueTables.tsx:89-90` (tri contrôlé), `OrdersPanel.tsx:92-101`.
- **Preuve** : à 320 px sur `/valeur`, les deux `thead` sont en `display: none`, et aucun autre
  choix de tri n'apparaît. Les boutons de tri et `aria-sort` de camply sont dans le `thead`.
- **Critère** : WCAG 1.4.10 (pas de perte de fonction à 320 px).
- **Proposition** : un `Select` de camply « Trier par » quand `usePhone()`, branché sur le tri
  contrôlé de Valeur. Les commandes passent en tri contrôlé (`sort` et `onSortChange`) avec le même
  `Select`.

#### MOB-04 — Réglette de l'accueil sur téléphone : neuf liens de 16 px, sans libellé (moyen)
- **Où** : `ProgressPanel.tsx:70` ; `ProgressRuler.tsx:28` (`linked = true`) ;
  `ProgressRuler.module.css:91-95` (libellés masqués sous 30rem).
- **Preuve** : à 320 px, les segments font de 15 à 33 px de large pour 16 px de haut. Seule
  l'infobulle, introuvable au toucher, nomme la région.
- **Critère** : WCAG 2.5.8 (taille des cibles) ; Kalos et Alola ont leurs centres à 21 px.
- **Proposition** : le choix déjà fait par le Pokédex public (`VitrinePage.tsx:238-242`) :
  `usePhone()` → `RegionList`, avec une prop `linked`. Chaque ligne devient un lien
  `pokedexUrl({ generation })` d'au moins 36 px.

#### Faibles
- **A11Y-04 — Les filtres rapides sont des bascules qui ne basculent pas.**
  - Où : `PokedexToolbar.tsx:148-152`, `onChange={() => setFilters({ possession: value })}`.
  - Vu : un second clic sur « Débloqués » le laisse `aria-pressed="true"`.
  - Proposition : `onChange={(on) => setFilters({ possession: on ? value : 'all' })}`.
- **A11Y-05 — ← → et « / » agissent sous le menu du compte.**
  - Où : `lib/focus.ts:94` ne bloque les raccourcis que derrière un `[role=dialog]`.
  - Vu : menu ouvert sur Pikachu, → ouvre Raichu.
  - Proposition : `'[role=dialog], [role=menu]'`.
- **A11Y-06 — Rareté et type lus deux fois sur la fiche d'une carte.**
  - Où : `CardDetails.tsx:168-169`, `:177-178`. L'icône a le nom en `alt`, suivi du même nom en
    texte, donc « SAR SAR ».
  - Critère : 1.1.1.
  - Proposition : une prop `decorative` (`alt=""`) pour ces deux usages (`CatalogIcons.tsx`).
- **A11Y-07 — Contraste élevé : la carte montrée et la carte choisie ne se distinguent plus.**
  - Où : `CardList.module.css:32-36` et `CatalogTile.module.css:39-42` (bord, fond, ombre).
  - Proposition : la même règle `Highlight` qu'en A11Y-01. Les drapeaux (`LanguageSwitch`)
    passeraient sans doute en couleur unie : `forced-color-adjust: none`, à vérifier.
- **A11Y-08 — Un lien qui ouvre un onglet ne le dit pas.**
  - Où : `ExternalLink.tsx:5` (`target="_blank"`) ; son icône est `aria-hidden`.
  - Critère : 3.2.5, AAA.
  - Proposition : `<span className="visually-hidden"> (nouvel onglet)</span>`.
- **MOB-05 — Le pseudo subit la majuscule et la correction automatiques sur iPhone.**
  - Où : `config/account.ts:46-53` (`PSEUDO_FIELD`).
  - Proposition : `autoCapitalize: 'none'`, `autoCorrect: 'off'`, `spellCheck: false`, comme
    `RAW_TEXT` (`CardFields.tsx:17`).
- **MOB-06 — La croix des étiquettes de filtre fait 16 × 16 px.**
  - Où : camply `.camply-tag__remove`. Elle passe 2.5.8 grâce à l'espacement, mais reste petite
    au doigt.
  - Proposition : dans camply, une zone de toucher de 24 px au moins.
- **MOB-07 — À vérifier sur un iPhone réel**, Playwright ne peut pas le montrer :
  - la barre d'onglets au-dessus de l'indicateur d'accueil quand le site est installé
    (`index.html:5` n'a pas `viewport-fit=cover`, donc `env(safe-area-inset-bottom)` vaut
    sans doute 0) ;
  - la palette Ctrl K avec le clavier ouvert (`max-height: 60vh` de camply).

Pour MOB-02 (champs en 14 px), l'agent propose un relais en attendant camply :
`@media (pointer: coarse) { .camply-field-shell, .camply-commandpalette__input { font-size: 1rem } }`
dans `global.css`, avec le commentaire « Classe interne de camply (pas une API) ». Le skill
`camply-ui` le tolère, mais la correction dans camply vaut mieux.

## Direction visuelle (skill frontend-design)

Le sujet du site, ce sont des cartes : couleur, brillance, illustrations. La doc le dit (« les
cartes portent la couleur, l'interface reste sobre »), et la fiche d'une carte le réussit
(`CardStage`, l'effet appuyé de l'app). Mais :

- **Quatre pages s'ouvrent pareil** : Accueil, Achats, Valeur et le Pokédex public commencent
  tous par quatre `Stat` dans des cartes identiques (pastille d'icône teintée en haut à droite,
  grand chiffre, phrase grise). C'est le « kit de cartes SaaS » que la skill range parmi les
  choix par défaut. Les cartes Pokémon arrivent sous la ligne de flottaison.
  - Achats : la première carte apparaît à y ≈ 610 sur 1440 × 900, après environ 900 px sur
    téléphone.
  - Les mêmes chiffres se répètent d'une page à l'autre : « Liste d'achats : 175 cartes, environ
    9 312 € » sur l'Accueil et sur Achats.
- **Proposition**, une seule audace par page, le reste discret :
  - Les tuiles d'indicateurs seulement sur l'Accueil, le tableau de bord.
  - Ailleurs, une ligne de résumé : `DescriptionList layout="split"`, ou des `Stat
    variant="plain"` en ligne sans carte.
  - Achats ouvre sur la liste ; Valeur sur la courbe et les cartes qui bougent ; le Pokédex public
    sur l'éventail de ses favorites (comme la tuile Pokédex des Collections), plutôt que l'anneau
    de pourcentage.
- **Les phrases d'introduction** font de deux à quatre lignes (Achats : 63 mots, quatre lignes
  sur téléphone), relues à chaque visite.
  - Proposition : une phrase par page ; la mise en garde « une indication, pas une offre de
    vendeur » à côté des prix, dans le `hint`.
- **À garder** : les deux thèmes (sans bleu, accent jaune ou rouge), Space Grotesk pour les titres
  et les chiffres, la réglette des régions, la Poké Ball plate.

## État par route

| Route | Chargement | Vide | Panne de l'API | Introuvable |
|---|---|---|---|---|
| `/connexion`, `/inscription` | ✔ bouton en attente | — | ✔ `Alert` | — |
| `/:pseudo` (Pokédex public) | ✔ squelette | ✔ `EmptyState` | ✘ sans « Réessayer » (ETAT-01) | ✔, mais une autre page (ETAT-02) |
| `/` (accueil) | ✔ squelettes des prix | ✔ « Pour commencer » | « — » sans explication | — |
| `/pokedex` | ✔ premier écran d'abord | ✔ `NoMatch` | page d'erreur | — |
| `/pokemon/:id` | ✔ squelettes, roue | ✔ fiche vide | prix : sans bouton (ETAT-01) | ✔ `NotFoundPage` |
| `/collections` | ✔ | ✔ tuile Pokédex | ✔ « Réessayer » | — |
| `/collections/:set` | ✔ | — | « — » | ✔ (retour aux Collections si elle disparaît) |
| `/catalogue` | ✔ | ✔ (habillage propre, UI-01) | ✔ « Réessayer » (vu) | code inconnu : la plus récente (documenté) |
| `/valeur` | ✔ | ✔ | `Alert`, tirets « — » (vu) | — |
| `/achats` | ✔ | ✔ (Prochaine commande sans action, UI-02) | plan : `Unavailable` sans bouton | onglet inconnu : la liste |
| `/donnees` (Réglages) | ✔ | ✔ | ✔ | — |
| Hors ligne | page jamais ouverte : écran d'erreur du navigateur (ETAT-03) ; état d'enregistrement peu visible (NAV-01) | | | |

## Ce qui marche, à garder

- **Clavier** : focus visible partout (contour de 2 px à l'accent, ou anneau de camply) et lien
  « Aller au contenu ».
- **Raccourcis** : Ctrl K trouve un Pokémon par son nom (accents ignorés), son nom japonais ou son
  numéro.
- **Préférences** : avec le mouvement réduit, les animations durent 0 ms.
- **Pannes** : « Catalogue indisponible » propose « Réessayer ». Sans prix, Valeur affiche
  « — » et dit pourquoi.
- **Enregistrement** : la collection repart d'elle-même au retour du réseau, et quitter la page
  avec une modification en attente le demande.
- **Annuler** : chaque action a son toast « Annuler » et le focus est mené au bon endroit (vu
  après l'ajout d'une carte : le focus va au titre du panneau de la carte).
- **Lisibilité** : un titre d'onglet par route, un seul `h1` par page sans saut de niveau, un fil
  d'Ariane sur la fiche d'un Pokémon.
- **Poids** : au premier chargement, environ 158 Ko compressés de JS et de CSS (React et
  react-router : 98,6 Ko, dans leur propre fichier ; l'app : 36,9 Ko ; la CSS : 22,5 Ko). Le reste
  est chargé à la demande.

## Ordre proposé

1. **Une ligne chacun, sans risque** : MOB-01, PERF-02, DS-01, LIB-01 (le badge), UX-02 (le
   libellé).
2. **Sécurité des données de l'utilisateur** : NAV-01 (bannière hors ligne ou session fermée) et
   ETAT-03 (`navigator.onLine`).
3. **Le geste principal** : UX-01 (la fenêtre d'ajout après un choix au catalogue).
4. **Cohérence des états** : ETAT-01 et ETAT-02 (`Unavailable`, `useRetry`, une seule page
   introuvable), UI-01, UI-02.
5. **Navigation** : NAV-02 (icône, `/reglages`, menu du compte), NAV-03, UX-06, UX-10.
6. **Accessibilité et téléphone** : A11Y-02 (une prop), A11Y-04 et A11Y-05 (une ligne chacun),
   A11Y-03, MOB-03, MOB-04, puis A11Y-01 et A11Y-07 (contraste élevé).
7. **À décider avec vous**, car ils changent l'apparence : la direction visuelle, UX-04 (les
   raretés, en partie dans `pokedex-data`), UX-09 (les pochettes vides), NAV-04 (← et →).
8. **À porter dans camply** : MOB-02 (16 px sur écran tactile), le remplissage de `Progress` en
   contraste élevé, `Radio.label` en `ReactNode`.

## Annexes

- **Captures** : `C:\Users\a.segalat\Documents\pokedex\.playwright-mcp\audit\` (préfixes : `m-`
  téléphone 390 px, `w-` ordinateur 1440 px, `d-` thème sombre, `e-` pannes, `k-` clavier, `fc-`
  contraste élevé).
- **Compte de test** : créé dans la D1 locale du site, avec une collection « 30th Celebration »,
  deux cartes possédées (Pikachu M6A 047, Raichu MC 226) et 175 cartes à acheter. Rien en ligne.
- **Construction** : `vite build` a réécrit `pokedex/dist/` (ignoré par git).
