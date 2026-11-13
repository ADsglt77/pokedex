# Cartes, catalogue et images

Les cartes de chaque Pokémon, le catalogue des cartes japonaises et françaises (TCGdex, par l'API des données) et leurs images. Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

- Source : **TCGdex** seul, depuis le 13 novembre 2026 (Pokécardex, abandonné, n'est plus lu) :
  ses cartes japonaises et françaises (sans TCG Pocket), copiées avec leurs images par
  l'importateur `pokecodex-importer` (images **hébergées chez nous**, dans R2), puis servies par
  l'API des données. L'app ne cite aucune source (le pied de page, `SiteDisclaimer`, ne dit que ce
  que le site n'est pas). TCGdex donne le nom d'une carte dans sa langue : une carte japonaise a
  son nom japonais (« ピカチュウex »), montré tel quel (décision de l'utilisateur, novembre 2026).
  TCGdex ne répertorie pas forcément toutes les cartes jamais parues. Les images de Cardmarket ne
  s'affichent que sur son site : refusées.
- Une carte (`PokemonCard`) : id `manual:<uuid>`, ses Pokémon (`dexIds`), une référence (vide à la
  saisie : le nom de la carte chez Cardmarket, sinon le nom du Pokémon), son image (`image` :
  celle du catalogue en deux tailles (un chemin du site), ou l'adresse
  collée, `small` = `large` ; `null` sans image),
  son id Cardmarket (`cardmarket`) et sa page chez Cardmarket (`page`), tous deux facultatifs ;
  sans page notée, le lien « Voir sur Cardmarket » se fait par l'id (`cardmarketPage` :
  `/fr/Pokemon/Products?idProduct=…`, vérifié par l'utilisateur ; `/Products/Singles?idProduct=`
  ne marche pas), le seul lien construit vers Cardmarket. Il ouvre les offres dans la langue de la
  carte, Near Mint au moins : `?language=7&minCondition=2` en japonais, `?language=2&minCondition=2`
  pour une carte française (`PokemonCard.language`), sauf les filtres qu'une page collée fixe déjà.
  Le filtre japonais (`language=7`) a été vérifié par l'utilisateur sur cardmarket.com ; le français
  (`language=2`) est **à faire vérifier** de même.
  Un Pokémon peut en avoir plusieurs, dont une favorite, celle que montre le Pokédex
  (`docs/collection-et-achats.md`) : on en ajoute une sans rien remplacer (la fenêtre d'ajout
  refuse une carte du catalogue qu'il a déjà) ; on corrige chacune (« Modifier la carte », même
  id, son statut et ses achats la suivent), on en fait la favorite (« Mettre en favorite ») ou on
  la retire (« Retirer la carte » : avec son statut et son prix payé ; confirmation si elle est
  possédée, ou si c'est la favorite d'un Pokémon qui garde d'autres cartes : il faut alors choisir
  la nouvelle favorite ; impossible tant qu'une commande la contient).
  Une carte de plusieurs Pokémon (TAG TEAM : `dexIds` en a plusieurs) est **une seule carte**,
  achetée une fois (décision de l'utilisateur, octobre 2026) : choisie dans la fenêtre d'ajout,
  elle va à tous ses Pokémon, sauf à ceux qui l'ont déjà ; déjà dans la collection comme carte d'un
  autre de ses Pokémon (une TAG TEAM ajoutée avant à certains seulement), elle n'est pas recopiée :
  ceux qui la reçoivent s'ajoutent à elle (même id ; `catalogTarget`, `lib/card-catalog.ts`) ;
  son statut et son prix payé valent pour tous ; elle peut être la favorite de chacun, chacun pour
  soi ; la valeur, le coût pour compléter et la prochaine commande ne la comptent qu'une fois. La
  retirer d'un de ses Pokémon l'en détache seulement (`removeCard` : elle reste aux autres, avec
  son statut, son prix payé ; possible même dans une commande) ; du dernier, elle part. La fiche
  dit « aussi celle de … ».
  Ajouter une carte à un Pokémon dit déjà qu'on la veut : tant qu'elle n'est ni commandée ni
  possédée, elle est dans la liste d'achats (`docs/collection-et-achats.md`).
- Catalogue (de l'API des données : sa construction, ses gardes et ses tables sont dans sa page
  `docs/donnees.md` ; côté site, `lib/card-catalog.ts`) : les cartes japonaises et françaises que
  répertorie TCGdex, Pokémon, dresseurs et énergies, extension par extension (une extension : un
  « set » de TCGdex ; un bloc : une « série » de TCGdex, « Écarlate et Violet »). Trois réponses,
  que le Worker du site demande à l'API : `/api/catalog/species/<n°>`, les cartes Pokémon d'un
  Pokémon (la fenêtre d'ajout, `loadSpeciesCards` ; une réponse pour chacun des 1 025, même sans
  carte : la fenêtre le dit), des plus récentes aux plus anciennes : `[série, numéro (le `localId`
  de TCGdex), id Cardmarket (0 : aucun), nom (dans la langue de la carte), image (sa clé, '' :
  aucune), rareté (sa clé, '' : inconnue), type ('' : inconnu), Pokémon s'ils sont plusieurs]` ;
  chaque série : `[nom, sortie, logo (sa clé, '' : aucun)]` ; les raretés de ces cartes : `[nom
  français, rang]`. Pour la page Catalogue : `/api/catalog/sets`, les séries, des plus récentes aux
  plus anciennes, `[id, nom, sortie, logo, nombre de cartes, rang de son bloc dans `blocks` (-1 :
  aucun)]`, et les blocs, des plus récents aux plus anciens ; `/api/catalog/sets/<id>`, toutes les
  cartes d'une série dans son ordre, chacune `{ number, printed, name, dexIds, cardmarket, image,
  rarity, type, illustrator, versions }` (les versions en français : « Normale », « Reverse »,
  « Holo »…), et leurs raretés. Les cartes françaises ont les mêmes trois réponses, de même forme,
  sous `/api/catalog/fr/…` (`species/<n°>`, `sets`, `sets/<id>`) : le site les charge par langue
  (`CardLanguage`, `'ja'` ou `'fr'` : `loadSpeciesCards(n°, langue)`, `loadSets(langue)`, la
  langue d'une série est `CatalogSet.language`), et la clé d'une carte du catalogue est « SV2a 166 »
  en japonais, « fr sv03.5 001 » en français (un même id de série peut exister dans les deux
  langues ; cette clé reste interne, on montre « sv03.5 001 » : `cardCode`) ; le Catalogue et la
  fenêtre d'ajout montrent les deux langues (l'interrupteur, ci-dessous). Les ids des séries sont
  ceux de TCGdex, tels quels (« SV2a », « sv03.5 ») : ceux des séries françaises ne sont plus les
  codes d'avant (« MEG » de l'ancienne source). Les types (`CardType`) sont des mots, les mêmes dans les
  deux langues ; leurs noms sont dans `CARD_TYPES` (`src/config/catalog.ts`) : l'énergie d'un
  Pokémon (`grass` Plante, `fire` Feu, `water` Eau, `lightning` Électrique, `psychic` Psy,
  `fighting` Combat, `darkness` Obscurité, `metal` Métal, `fairy` Fée, `dragon` Dragon,
  `colorless` Incolore), les catégories des dresseurs (`TRAINER_TYPES` : `trainer` Dresseur, sans
  précision, `item` Objet, `tool` Outil, `technical-machine` Machine technique, `supporter`,
  `stadium` Stade) et des énergies (`ENERGY_TYPES` : `basic-energy` Énergie de base,
  `special-energy` Énergie spéciale, `energy` Énergie) ; un type inconnu n'est pas montré. Les
  raretés ont pour clé le mot de TCGdex (« Double rare ») ; chaque réponse donne leur nom français
  et leur rang (de la plus commune à la plus rare), que le site reprend tels quels
  (`readRarities`) : plus de table de raretés côté site (les synonymes de D-08, « C » et
  « Commune », venaient de l'ancienne source). Ni icône de type ni icône de rareté (le catalogue
  n'en a aucune image) : tout s'écrit en toutes lettres, la rareté sous la tuile d'une carte (une ligne, coupée si
  elle ne tient pas), le type sur sa fiche et dans les filtres, l'énergie d'un Pokémon précédée
  d'une pastille à sa couleur (`TypeLabel` : le jeton `--type-…` du type de Pokémon qui lui répond,
  `ENERGY_COLORS`, comme `TypeChip`). Sans API des données, ou tant qu'aucune carte n'a
  été lue (404), la fenêtre d'ajout et la page Catalogue le disent (« pas disponible pour le
  moment »). La référence d'une carte : « Dracaufeu ex (SV2a 006) », son nom puis le code de
  sa série et son numéro. Un clic à côté de la fenêtre d'une carte (ajout ou modification) ne la
  ferme pas : la saisie ne se perd pas d'un appui (`closeOnBackdrop={false}`, comme la saisie d'une
  commande). « Ajouter une carte »
  (`pokemon/CardForm`) s'ouvre sur l'onglet « Catalogue », où l'interrupteur de langue
  (`LanguageSwitch`, le même que celui de la page Catalogue, japonais au départ) précède la grille
  (`CatalogPicker` : image, code, rareté, prix du jour, tri par date ou par prix, filtres
  de rareté et de type (`CardFilters`, retirés quand l'extension change) ; une seule langue à la fois,
  les textes (« cartes françaises »), l'extension et le lien « toute l'extension » (`catalogParams`,
  qui porte la langue) le suivent ; changer de langue remet l'extension et les filtres à zéro ; ses
  réglages, la langue comprise (`PickerView.language`), vivent dans `CardForm`, l'onglet caché étant
  démonté) ; choisir une carte remplit la saisie (`fill` : sa langue (`set.language`), sa
  référence « Pikachu ex (SV8 033) » et son id, d'où l'image, le prix et le lien Cardmarket ; une carte
  TAG TEAM dit « avec … » dans la grille, et va à tous ses Pokémon qui ne l'ont pas déjà tant que la
  référence reste la sienne ; une saisie à la main ne va qu'au Pokémon de la fiche) et y mène le
  focus. L'onglet « La carte choisie » la résume d'abord (`PickedCard` : son aperçu, sa référence
  et son drapeau, son prix du jour : ce que la saisie enregistrera ; une correction s'y montre,
  la référence aussitôt, l'aperçu en quittant la référence, le prix en quittant l'id, et un id
  vidé n'a pas de prix). Vient ensuite « Ajouter comme », le seul vrai choix (« Non possédée », par
  défaut, ou
  « Possédée » ; décision D-04, novembre 2026), le prochain arrêt au clavier. Les champs viennent
  enfin, repliés sous « Modifier les détails » (`Accordion` de camply, pour le cas rare d'une
  correction ; repliés à chaque carte choisie, ouverts d'eux-mêmes tant qu'un champ est illisible,
  même pas encore signalé : un refus les trouve ouverts, et le champ reçoit le focus, à l'écran).
  Une carte reprise telle quelle (une carte qu'un autre Pokémon a déjà, ou la case d'une série :
  `kept` de `catalogTarget`, testé) n'a ni ces champs ni « Ajouter comme » : ses corrections
  seraient ignorées, l'alerte le dit (« … telle qu'elle est, avec son statut », H-02, novembre
  2026), et le résumé montre la carte de la collection, son image, sa référence et le prix de son
  id, pas ceux du catalogue. Une fois reprise, elle se corrige par « Modifier la carte », sur sa
  fiche. Les champs
  restent au même endroit : corriger la référence ne les remonte pas sous la frappe. Sur un
  téléphone, l'aperçu du résumé est une vignette, et « Ajouter comme » tient à l'écran sans
  défiler. « Saisie à la main » garde le formulaire complet, « Ajouter comme » à la fin ; on
  vérifie la carte puis l'enregistre (« Enregistrer » attend que la carte soit choisie, ou
  l'onglet de saisie ; une carte que le Pokémon a déjà, `catalogMatch`, est refusée : « Pikachu a
  déjà cette carte. », tant que la référence reste la sienne : corrigée, c'est une saisie, plus
  refusée ; une carte qu'un autre de ses Pokémon a déjà lui est ajoutée telle quelle,
  statut, prix payé et commandes compris, la fenêtre le dit et n'offre pas « Ajouter comme » :
  « Carte … ajoutée à Pikachu (déjà dans votre collection). » ; une case pas encore obtenue d'une
  collection d'extension, qui n'est encore la carte d'aucun Pokémon (`useSeriesSlot`,
  `unobtainedSlot`), est reprise de même, jamais copiée : elle devient une carte de tous ses
  Pokémon (`adopt`, favorite de ceux qui n'en ont pas), avec son statut, et reste une case de sa
  collection ; la fenêtre le dit (« Cette carte fait partie de votre collection Méga Rêve ex : elle
  devient aussi celle de Pikachu, avec son statut. »), sans « Ajouter comme » : « Carte … ajoutée à
  Pikachu (déjà dans votre collection Méga Rêve ex). »). « Modifier la carte » n'a que la saisie : choisir une autre carte, ce serait
  lui transmettre le statut, le prix payé et les commandes de celle-ci. Une carte qui est une case
  d'une collection d'extension (`seriesOf`) se corrige de même ; la fenêtre prévient seulement
  (octobre 2026 : ni langue figée, ni code d'une autre extension refusé) : « Elle fait partie de
  votre collection Méga Rêve ex : la modifier change aussi sa case. » Le catalogue n'est qu'une
  aide : la carte enregistrée est une carte saisie comme les autres (`manual:<uuid>`). La saisie a
  sa langue (`useCardDraft.language`, `CardFields` : son propre `LanguageSwitch` et « Carte
  japonaise » / « Carte française ») : celle de la carte corrigée, japonaise pour une nouvelle, ou
  celle de la carte choisie dans le catalogue ; elle dit où l'image de la référence est cherchée
  (`findCardImage`) et se lit à l'enregistrement : `language: 'fr'` pour une carte française, rien
  pour une japonaise (un export d'avant n'a rien à migrer). Corriger une carte garde donc sa langue,
  qu'on peut aussi changer là ; l'image déjà retrouvée n'est gardée (`kept`) que dans la langue de
  la carte. Les codes d'extension se répètent d'une langue à l'autre (SVP 001 existe dans les
  deux) : la langue d'une carte de la collection se voit à côté de sa référence, un petit drapeau
  à la taille du texte, pour les japonaises aussi (`LanguageFlag`, dans `LanguageSwitch.tsx`,
  nommé « Carte japonaise » / « Carte française » ; avec la référence : `CardReference`) : le
  titre de sa fiche (`CardSheet`), les cartes d'un Pokémon sur sa fiche (`CardList`), le choix
  de la nouvelle favorite (`CardActions`), la fenêtre d'une carte d'une collection
  (`SeriesCard`), la liste d'achats (`WishCard`) et les lignes des commandes et de l'assistant
  (`CardLine`).
  En quittant le champ de l'id, la saisie dit ce que Cardmarket en sait (`CardmarketCheck` :
  « Chez Cardmarket : <nom> · <prix> », ou pas de prix connu). Cette ligne a sa place, même vide
  (une ligne, `.idCheck` de `CardFields.module.css`) : en apparaissant, elle ne pousse pas
  « Ajouter comme » sous le pointeur (un clic sur « Possédée » juste après l'id était perdu,
  novembre 2026). Plus longue qu'une ligne (un nom long sur téléphone, un id sans prix), elle
  pousse encore ce qui suit.
  L'enregistrement (`useCardDraft.save`) attend le prix et l'image : une seule fois à la fois, la
  fenêtre ne se ferme pas pendant ce temps. Une page Cardmarket qui n'était que celle de l'id de
  départ est oubliée quand l'id change (le lien suit alors le nouvel id) ; une référence qui
  n'était que le nom de l'ancien id chez Cardmarket suit le nouveau, sans l'image d'avant. Ces
  règles, sans React : `draftCard` (la carte lue, testée) et `draftErrors` (les erreurs des
  champs), dans `lib/card-draft.ts`.
  La page Catalogue (`/catalogue?langue=fr&set=…`, dans le menu, `pages/catalog/`), un grand
  catalogue sans lien avec le Pokédex (à la demande de l'utilisateur, octobre 2026), des cartes
  japonaises ou françaises : l'interrupteur de la langue (`LanguageSwitch`, dans l'en-tête de la
  page : un `SegmentedControl` de deux drapeaux SVG, « Cartes japonaises » / « Cartes
  françaises ») vit dans l'adresse, `langue=fr`, le japonais sans elle (`catalogLanguage`,
  `catalogParams` de `lib/filters.ts` : une autre valeur vaut le japonais) ; en changer remplace
  `langue` et retire `set` (la plus récente extension de la langue), les textes suivent (« Toutes
  les cartes françaises… », « Sortie en France »). En tête, l'extension (un « set » de TCGdex)
  avec son logo (`SetLogo` ; seules certaines extensions françaises en ont un, les autres montrent
  leur id), son id, sa sortie, son nombre de cartes et son bloc ; « Changer d'extension » ouvre la
  fenêtre pleine page des extensions (`SetPicker` : leurs logos, une recherche par id ou par nom,
  rangées par année ou par bloc, dans l'ordre des blocs que donne l'API ; chacune avec son nombre
  de cartes) ; « Commencer la
  collection » commence celle de l'extension montrée, dans sa langue (toutes ses cartes, à
  débloquer : `docs/collection-et-achats.md`), puis l'ouvre, ou « Voir ma collection » si elle
  l'est déjà (`docs/interface.md`). Puis une recherche (nom, dans
  la langue de la carte, numéro, illustrateur), les filtres de rareté et de type (catégories
  des dresseurs et énergies comprises), ce que compte l'extension (« 188 Pokémon, 21 dresseurs et 1
  énergie · 45 secrètes » ; une secrète est numérotée au-delà du nombre imprimé, « 201/165 ») et ses
  cartes en tuiles serrées (`CatalogTile` : le numéro et le prix, puis la rareté et le nom). Un clic
  ouvre la fiche de la carte (`CardDetails`, pleine page) : son image en grand, l'extension et son
  bloc, le numéro imprimé (« Secrète »), la rareté, le type ou la catégorie (en toutes lettres,
  `TypeLabel`), ses Pokémon (chacun vers sa fiche, `SpeciesLinks`),
  l'illustrateur, ses versions, sa sortie (au Japon, ou en France), où
  elle en est dans la collection, et son prix Cardmarket avec sa courbe (`PricePanel`, comme la
  fiche d'un Pokémon) ; des flèches passent aux cartes voisines de la grille, dans l'ordre affiché.
  Une carte Pokémon a un seul bouton, « Ajouter à la collection » : elle s'ajoute à tous ses
  Pokémon (une seule pour une TAG TEAM), toujours à acheter (décision de l'utilisateur, octobre
  2026), **sans rien remplacer** : les cartes qu'ils ont déjà restent, leur favorite aussi ; un
  Pokémon qui n'en a pas la reçoit pour favorite (`addCard`). Pas de confirmation, et aucune
  commande ne la retient. Une carte française s'ajoute avec `language: 'fr'`, comme son
  `PricePanel` la reçoit (`languageField`, `lib/collection.ts` : une seule source pour le champ
  de la langue d'une carte). La fiche dit où elle en est (`useCollectionPlace` : `mine`,
  la carte de la collection qui est celle-ci, parmi toutes celles de ses Pokémon ; `holders`,
  ceux qui ont déjà des cartes) : « Pikachu a déjà des cartes : celle-ci s'y ajoute, à acheter,
  sans changer sa favorite. » (« a déjà une carte » s'il n'en a qu'une ; « ont déjà des cartes »,
  « leur favorite » s'ils sont plusieurs). Déjà dans la collection (de la même langue, avec le même
  code dans la référence ; ou, si aucune carte du compte n'a ce code, le même id Cardmarket :
  `catalogMatch`, testé, pour n'importe lequel de ses Pokémon ; le code d'abord, comme
  `startSeries` : « AR 94 » et « AR AR7 » ont le même id, et chacune reste la sienne) :
  « Dans votre collection », qui reçoit le focus après l'ajout, et le bouton disparaît : une carte
  du catalogue n'est jamais ajoutée deux fois (une TAG TEAM qu'un seul de ses Pokémon a se donne
  aux autres depuis leur fiche). Annoncé avec « Annuler » : « Carte … ajoutée à Pikachu, à acheter. »
  Une case pas encore obtenue d'une collection d'extension (pas encore une carte de ses Pokémon :
  `useSeriesSlot`) : « Dans votre collection Méga Rêve ex, non possédée : l’ajouter en fait aussi
  une carte de Pikachu. » (le statut, « possédée », « commandée » ou « non possédée », est celui de
  `statusLabel`, le même que sur la grille et la fenêtre de la collection) ; « Ajouter à la
  collection » la reprend avec son statut (`adopt`), jamais une seconde carte : « Carte … ajoutée à Pikachu (déjà dans votre collection Méga Rêve ex). »
  Les dresseurs, les énergies et les cartes dont le catalogue ne donne pas
  les Pokémon (« Togepi, Mélo et Toudoudou-GX ») n'ont pas de bouton. Filtres de rareté et de type
  (`CardFilters`, demandés par l'utilisateur, octobre 2026) : des pastilles en toutes lettres
  (la rareté, le type avec sa pastille de couleur pour une énergie), chacune avec le
  nombre de cartes qu'elle montrerait parmi celles que gardent l'autre filtre et la recherche ;
  plusieurs choix d'un filtre s'ajoutent, les deux filtres se combinent (`passesFilter`) ; un filtre
  qui n'offrirait qu'un choix n'est pas montré ; changer d'extension ou de langue les retire, avec
  la recherche.
  Ce sont des filtres que l'utilisateur choisit : rien n'est trié ni écarté seul.
- Images (`lib/card-images.ts`) : copiées de TCGdex par l'importateur, servies par l'API des
  données (sa page `docs/donnees.md`), aux chemins neutres que demande le navigateur. Chaque image a
  sa clé (`ImageKey`), que donne le catalogue : `<langue>/<série>/<carte>` pour le scan d'une carte
  (`ja/SV2a/SV2a-166` : la langue d'abord, un même id de série existant dans les deux langues),
  `<langue>/<série>` pour le logo d'une série ; ses parties encodées comme les clés de
  l'importateur (seuls `A-Z a-z 0-9 . -` restent, tout autre octet devient `_XX`). Le scan d'une
  carte, en deux tailles : `/images/cards/<clé>-md.webp` pour les grilles, `-hd.webp` pour la fiche
  (`catalogImage`) ; le logo d'une série, une taille : `/images/sets/<clé>.webp` (`setLogo`). Une
  carte sans image au catalogue (clé '') montre la carte de substitution (`CardArt`) ; une série
  sans logo (la plupart : seules certaines séries françaises en ont un), son id (`SetLogo`). Une
  collection d'extension ne garde pas la clé du logo : elle la recalcule d'après sa langue et son
  id (`setLogoKey`, la règle d'encodage testée) et, sans logo à ce chemin (404), montre son id.
  Ni icône de type ni icône de rareté (plus de `/images/types/…` ni `/images/rarities/…`). Les
  sprites et illustrations des Pokémon (`spriteUrl` ; `artworkUrl`, en WebP sans perte depuis L19,
  novembre 2026 : `../pokedex-data/docs/donnees.md`). Le Worker du site les demande à l'API, qui
  les lit dans R2 ; le navigateur les garde un an, sans redemande (`immutable`) ; seules les pages
  du site les affichent (`Cross-Origin-Resource-Policy`, `worker/headers.ts`), 1 300 par 10 s et
  par visiteur (de quoi charger tout le Pokédex, `worker/limits.ts`). Une référence hors du
  catalogue n'a pas d'image retrouvée. La collection garde les chemins des scans (`isFoundImage` :
  une image retrouvée, qui suit la référence) ; aucun ne nomme la source. L'API ne copie aucune
  image à la demande : une image pas encore copiée répond 404 (la carte de substitution). Une
  adresse collée s'affiche telle quelle, d'où qu'elle vienne (sauf Cardmarket, refusée à la
  saisie) : la seule image que le navigateur va chercher ailleurs. Réglages › Sauvegarde
  › « Chercher les images » cherche d'un coup celles des cartes sans image. `findCardImage`
  (`lib/card-catalog.ts`) : l'image du catalogue pour cette référence, dans la langue donnée (celle
  de la carte, `cardLanguage` ; lue dans sa série : `/api/catalog/sets`, puis
  `/api/catalog/sets/<id>`, sous `fr/` en français), **prise telle quelle**, sans la charger,
  comme l'ajoute « Ajouter à la collection » de la page Catalogue : son chemin (la clé de la carte
  chez TCGdex) ne change pas d'image, et une image pas encore copiée s'affiche dès qu'elle l'est
  (d'ici là, la carte de substitution) ; une carte que le catalogue dit sans image n'en a pas ; un
  catalogue sans réponse en 15 s (`CATALOG_TIMEOUT`, ses séries puis celle de la carte) la compte
  pour absente, pour ne pas bloquer l'enregistrement. Hors du catalogue, aucune image ; la saisie
  le dit, sans nommer de source (aucun crédit dans l'app, à la demande de l'utilisateur, octobre
  2026 : CLAUDE.md). Un échec est redemandé à l'enregistrement (panne passagère), et une image déjà
  enregistrée reste si elle n'est pas retrouvée. Sans adresse collée, l'image suit la référence
  (cherchée en quittant le champ). Le code d'une carte (`lib/card-code.ts`) : `codeKey` en fait une
  clé (« SV2A 166 », « SV03.5 6 » : série en majuscules sans tiret, numéro sans zéro) : ce qui fait
  la même carte de la collection qu'une carte du catalogue (`catalogMatch`) ou qu'une case
  (`cardCodeKey`, `startSeries`) ; ses deux moitiés, `setKey` puis `numberKey`, retrouvent la carte
  du catalogue d'une référence (`findCardImage`) : « SV2A », tapé à la main ou noté avant TCGdex,
  est la série « SV2a ».
- Migration vers TCGdex (une fois, novembre 2026) : `scripts/migrer-tcgdex.ts`, ses règles dans
  `lib/tcgdex-migration.ts` (testées : `tests/tcgdex.test.ts`). Il lit le document `collection`
  d'un compte (un fichier JSON, tel que le garde le serveur) et le catalogue de chaque langue chez
  un site qui tourne, et écrit, sans toucher à aucune base, le document migré, de même forme, et
  son bilan (cartes retrouvées avec ou sans image, introuvables, par série d'avant ; collections
  d'extensions ; la liste des introuvables) :
  `bun scripts/migrer-tcgdex.ts collection.json http://localhost:5173 [sortie.json]`. Une carte du
  catalogue d'avant (image à un chemin du site, ou référence à code) est cherchée dans sa langue
  par sa série (`setKey`) et son numéro (`numberKey`), sinon par son id Cardmarket s'il ne désigne
  qu'une carte de la langue (les ids des séries françaises ont changé) ; retrouvée, sa référence
  prend le code de TCGdex, son nom gardé (« Bulbizarre (SV2a 001) »), son image celle du catalogue
  (`null` sans ; une adresse collée reste), son id Cardmarket reste ; introuvable, rien ne change.
  Une collection d'extension prend l'id et le nom de sa série chez TCGdex (par son id, sinon celle
  de toutes ses cartes retrouvées), jamais celle d'une autre collection. Une carte d'avant non
  migrée garde son ancien chemin, que l'API ne sert plus : la carte de substitution.
- Retirés à la demande de l'utilisateur, à ne pas réintroduire sans demande : TCGplayer (TCGdex
  est la seule source ; Pokécardex, abandonné, retiré le 13 novembre 2026, avec la garde de ses
  adresses d'images, `isSourceImage`, et ses icônes de types et de raretés) ; le favori « Ajouter au Pokédex » (`/ajouter`, un lien
  `javascript:` qui reprenait une page produit de Cardmarket : une carte hors du catalogue se saisit
  à la main) ; sur la page Catalogue, la progression par extension, « Seulement les Pokémon sans
  carte », « Ajouter comme » et les extensions « plus utiles » ou « plus avancées ».
