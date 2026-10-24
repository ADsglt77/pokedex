# Cartes, catalogue et images

Les cartes de chaque Pokémon, le catalogue des cartes japonaises et françaises (Pokécardex, par l'API des données) et leurs images. Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

- Source : **Pokécardex** seul. Son accord : lire son site, utiliser ses images **hébergées chez
  nous** (`isSourceImage`), reprendre son historique des prix ; aucun crédit demandé, l'app n'en
  cite aucune (le pied de page, `SiteDisclaimer`, ne dit que ce que le site n'est pas). Les images
  de Cardmarket ne s'affichent que sur son site : refusées.
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
  ceux qui la reçoivent s'ajoutent à elle (même id) ; son statut et son prix payé valent pour tous ;
  elle peut être la favorite de chacun, chacun pour soi ; la valeur, le coût
  pour compléter et la prochaine commande ne la comptent qu'une fois. La retirer d'un de ses
  Pokémon l'en détache seulement (`removeCard` : elle reste aux autres, avec son statut, son prix
  payé ; possible même dans une commande) ; du dernier, elle part. La fiche dit « aussi
  celle de … ».
  Ajouter une carte à un Pokémon dit déjà qu'on la veut : tant qu'elle n'est ni commandée ni
  possédée, elle est dans la liste d'achats (`docs/collection-et-achats.md`).
- Catalogue (de l'API des données : sa lecture de Pokécardex, ses gardes et ses tables sont dans
  sa page `docs/donnees.md` ; côté site, `lib/card-catalog.ts`) : les cartes japonaises, Pokémon,
  dresseurs et énergies, environ 450 séries de 1996 à aujourd'hui, decks, promos et anciennes
  séries compris, sans les exclusivités d'autres pays d'Asie ; et les françaises, environ 250
  séries et 25 600 cartes (octobre 2026). Trois réponses, que nginx renvoie à l'API :
  `/api/catalog/species/<n°>`, les cartes Pokémon d'un Pokémon (la fenêtre d'ajout,
  `loadSpeciesCards` ; une réponse pour chacun des 1 025, même sans carte : la fenêtre le dit), des
  plus récentes aux plus anciennes : `[série, numéro (sans numéro imprimé : son rang), id
  Cardmarket (0 : aucun), nom français, numéro de son image (son rang, 0 : aucune), rareté (0 :
  inconnue), type (0 : inconnu), Pokémon s'ils sont plusieurs]` ; chaque série : `[nom, sortie,
  logo]` (0 : pas de logo) ; les raretés de ces cartes : `[nom, rang]`. Pour la page Catalogue :
  `/api/catalog/sets`, les séries, des plus récentes aux plus anciennes, `[code, nom, sortie, logo,
  nombre de cartes, rang de son bloc dans `blocks` (-1 : aucun), 1 pour un deck]`, et les blocs
  dans l'ordre du menu ; `/api/catalog/sets/<code>`, toutes les cartes d'une série dans son ordre,
  chacune `{ number, printed, name, en, de, dexIds, cardmarket, image, rarity, type, illustrator,
  versions }`, et leurs raretés. Les cartes françaises ont les mêmes trois réponses, de même forme,
  sous `/api/catalog/fr/…` (`species/<n°>`, `sets`, `sets/<code>`) : le site les charge par langue
  (`CardLanguage`, `'ja'` ou `'fr'` : `loadSpeciesCards(n°, langue)`, `loadSets(langue)`, la
  langue d'une série est `CatalogSet.language`), et la clé d'une carte du catalogue est « SV2A 166 »
  en japonais, « fr MEG 001 » en français (un même code de série existe dans les deux langues ;
  cette clé reste interne, on montre « MEG 001 » : `cardCode`) ; le Catalogue et la fenêtre
  d'ajout montrent les deux langues (l'interrupteur, ci-dessous). Les types
  sont numérotés sans être nommés par la source : leurs noms sont dans `CARD_TYPES`
  (`src/config/catalog.ts` : 1 Plante, 2 Eau, 3 Feu, 4 Électrique, 5 Psy, 6 Obscurité, 7 Métal,
  8 Combat, 9 Dragon, 10 Incolore, 11 Fée ; les catégories des dresseurs, 12 Stade, 13 Dresseur
  (une carte d'avant les catégories), 14 Supporter, 15 Objet, 41 Outil (`TRAINER_TYPES`), et
  16 Énergie (`ENERGY_TYPE`)). Les raretés gardent les noms de la source : « C », « SAR »… pour les
  cartes récentes, « Commune », « Unco », « Rare », « Holographique » pour les anciennes, « Sans
  rareté » pour celles qui n'en impriment pas. Sans API des données, ou tant qu'aucune carte n'a
  été lue (404), la fenêtre d'ajout et la page Catalogue le disent (« pas disponible pour le
  moment »). La référence d'une carte : « Dracaufeu ex (SV2A 006) », son nom puis le code de
  sa série et son numéro. « Ajouter une carte »
  (`pokemon/CardForm`) s'ouvre sur l'onglet « Catalogue », où l'interrupteur de langue
  (`LanguageSwitch`, le même que celui de la page Catalogue, japonais au départ) précède la grille
  (`CatalogPicker` : image Pokécardex, code, rareté, prix du jour, tri par date ou par prix, filtres
  de rareté et de type (`CardFilters`, retirés quand l'extension change) ; une seule langue à la fois,
  les textes (« cartes françaises »), l'extension et le lien « toute l'extension » (`catalogParams`,
  qui porte la langue) le suivent ; changer de langue remet l'extension et les filtres à zéro ; ses
  réglages, la langue comprise (`PickerView.language`), vivent dans `CardForm`, l'onglet caché étant
  démonté) ; choisir une carte remplit la saisie (`fill` : sa langue (`set.language`), sa
  référence « Pikachu ex (SV8 033) » et son id, d'où l'image, le prix et le lien Cardmarket ; une carte
  TAG TEAM dit « avec … » dans la grille, et va à tous ses Pokémon qui ne l'ont pas déjà tant que la
  référence reste la sienne ; une saisie à la main ne va qu'au Pokémon de la fiche) et y mène le
  focus ; on la vérifie puis l'enregistre (« Enregistrer » attend que la carte soit choisie, ou
  l'onglet de saisie ; une carte que le Pokémon a déjà, `isCatalogCard`, est refusée : « Pikachu a
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
  nommé « Carte japonaise » / « Carte française ») : le titre de sa fiche (`CardSheet`), les
  cartes d'un Pokémon sur sa fiche (`CardList`), la liste d'achats (`WishCard`) et les lignes des
  commandes et de l'assistant (`CardLine`).
  L'enregistrement (`useCardDraft.save`) attend le prix et l'image : une seule fois à la fois, la
  fenêtre ne se ferme pas pendant ce temps. Une page Cardmarket qui n'était que celle de l'id de
  départ est oubliée quand l'id change (le lien suit alors le nouvel id).
  La page Catalogue (`/catalogue?langue=fr&set=…`, dans le menu, `pages/catalog/`), un grand
  catalogue sans lien avec le Pokédex (à la demande de l'utilisateur, octobre 2026), des cartes
  japonaises ou françaises : l'interrupteur de la langue (`LanguageSwitch`, dans l'en-tête de la
  page : un `SegmentedControl` de deux drapeaux SVG, « Cartes japonaises » / « Cartes
  françaises ») vit dans l'adresse, `langue=fr`, le japonais sans elle (`catalogLanguage`,
  `catalogParams` de `lib/filters.ts` : une autre valeur vaut le japonais) ; en changer remplace
  `langue` et retire `set` (la plus récente extension de la langue), les textes suivent (« Toutes
  les cartes françaises… », « Sortie en France »). En tête, l'extension (une série de Pokécardex)
  avec son logo, celui de sa langue (`SetLogo`), son code, sa sortie, son nombre de cartes et son
  bloc ; « Changer d'extension » ouvre la fenêtre pleine page des extensions (`SetPicker` : leurs
  logos, une
  recherche par code ou par nom, rangées par année ou par bloc, dans l'ordre du menu de Pokécardex,
  leurs extensions puis leurs decks ; chacune avec son nombre de cartes) ; « Commencer la
  collection » commence celle de l'extension montrée, dans sa langue (toutes ses cartes, à
  débloquer : `docs/collection-et-achats.md`), puis l'ouvre, ou « Voir ma collection » si elle
  l'est déjà (`docs/interface.md`). Puis une recherche (nom
  français, anglais ou allemand, numéro, illustrateur), les filtres de rareté et de type (catégories
  des dresseurs et énergies comprises), ce que compte l'extension (« 188 Pokémon, 21 dresseurs et 1
  énergie · 45 secrètes » ; une secrète est numérotée au-delà du nombre imprimé, « 201/165 ») et ses
  cartes en tuiles serrées (`CatalogTile` : le numéro et le prix, puis la rareté et le nom). Un clic
  ouvre la fiche de la carte (`CardDetails`, pleine page) : son image en grand, l'extension et son
  bloc, le numéro imprimé (« Secrète »), la rareté, le type ou la catégorie, ses Pokémon,
  l'illustrateur, ses versions, ses noms anglais et allemand, sa sortie (au Japon, ou en France), où
  elle en est dans la collection, et son prix Cardmarket avec sa courbe (`PricePanel`, comme la
  fiche d'un Pokémon) ; des flèches passent aux cartes voisines de la grille, dans l'ordre affiché.
  Une carte Pokémon a un seul bouton, « Ajouter à la collection » : elle s'ajoute à tous ses
  Pokémon (une seule pour une TAG TEAM), toujours à acheter (décision de l'utilisateur, octobre
  2026), **sans rien remplacer** : les cartes qu'ils ont déjà restent, leur favorite aussi ; un
  Pokémon qui n'en a pas la reçoit pour favorite (`addCard`). Pas de confirmation, et aucune
  commande ne la retient. Une carte française s'ajoute avec `language: 'fr'`, comme son
  `PricePanel` la reçoit (`languageField`, `lib/card-catalog.ts` : une seule source pour la
  langue d'une carte du catalogue). La fiche dit où elle en est (`useCollectionPlace` : `mine`,
  la carte de la collection qui est celle-ci, parmi toutes celles de ses Pokémon ; `holders`,
  ceux qui ont déjà des cartes) : « Pikachu a déjà des cartes : celle-ci s'y ajoute, à acheter,
  sans changer sa favorite. » (« a déjà une carte » s'il n'en a qu'une ; « ont déjà des cartes »,
  « leur favorite » s'ils sont plusieurs). Déjà dans la collection (de la même langue, avec le même
  code dans la référence ou le même id Cardmarket : `isCatalogCard`, pour n'importe lequel de ses
  Pokémon) :
  « Dans votre collection », qui reçoit le focus après l'ajout, et le bouton disparaît : une carte
  du catalogue n'est jamais ajoutée deux fois (une TAG TEAM qu'un seul de ses Pokémon a se donne
  aux autres depuis leur fiche). Annoncé avec « Annuler » : « Carte … ajoutée à Pikachu, à acheter. »
  Une case pas encore obtenue d'une collection d'extension (pas encore une carte de ses Pokémon :
  `useSeriesSlot`) : « Dans votre collection Méga Rêve ex, à acheter : l’ajouter en fait aussi une
  carte de Pikachu. » ; « Ajouter à la collection » la reprend avec son statut (`adopt`), jamais une
  seconde carte : « Carte … ajoutée à Pikachu (déjà dans votre collection Méga Rêve ex). »
  Les dresseurs, les énergies et les cartes dont Pokécardex ne donne pas
  les Pokémon (« Togepi, Mélo et Toudoudou-GX ») n'ont pas de bouton. Filtres de rareté et de type
  (`CardFilters`, demandés par l'utilisateur, octobre 2026) : des pastilles à icône, chacune avec le
  nombre de cartes qu'elle montrerait parmi celles que gardent l'autre filtre et la recherche ;
  plusieurs choix d'un filtre s'ajoutent, les deux filtres se combinent (`passesFilter`) ; un filtre
  qui n'offrirait qu'un choix n'est pas montré ; changer d'extension ou de langue les retire, avec
  la recherche.
  Ce sont des filtres que l'utilisateur choisit : rien n'est trié ni écarté seul.
- Images (`lib/card-images.ts`) : copiées et servies par l'API des données (sa page
  `docs/donnees.md` : leurs sources, la tâche `images`), aux chemins neutres
  que demande le navigateur : `/images/cards/<série>/<rang>-<md|hd>.webp` (`catalogImage` : `md`
  pour la grille, `hd` pour la fiche), `/images/sets/<série>-<md|hd>.webp` (le logo d'une série,
  `setLogo`) ; ceux des cartes françaises sous `fr/` (`/images/cards/fr/<série>/<rang>-…`,
  `/images/sets/fr/<série>-…` : un même code de série existe dans les deux langues), ceux du japonais
  inchangés ; `/images/types/<n>.webp` (`typeIcon`), `/images/rarities/<n>.webp`
  (`rarityIcon` ; les noires, `DARK_RARITY_ICONS`, inversées sur le thème sombre,
  `--dark-icon-filter` ; une rareté sans icône, « FUR », s'écrit en texte), les sprites et
  illustrations des Pokémon (`spriteUrl`, `artworkUrl`). nginx les renvoie à l'API et les garde sur
  son disque (`proxy_cache`) ; le navigateur, un an, sans redemande (`immutable`) ; seules les pages
  du site les affichent (`Cross-Origin-Resource-Policy`), 20 par seconde et par visiteur, 1 100 d'un
  coup (de quoi charger tout le Pokédex, `docs/deploiement.md`). Le catalogue
  donne le rang de l'image de chaque carte ; pour une référence hors du catalogue, `cardImage` la
  déduit de la langue et du code de la référence (série en majuscules sans tiret, SV-P → SVP ;
  numéro sans zéro), sans certitude. La collection garde ces chemins (`isFoundImage` : une image retrouvée, qui suit
  la référence) ; aucun ne nomme la source. L'API ne copie aucune image à la demande, la tâche
  `images` les copie toutes d'avance : une image absente répond 404 (la carte de substitution). Une adresse collée de chez la
  source (son site ou ses serveurs d'images) est refusée à la saisie, et jamais affichée (`isSourceImage` : son accord,
  jamais une image affichée depuis chez elle ; une carte qui en garde une montre la carte de
  substitution, jusqu'à ce qu'elle soit corrigée). Le code que reçoit le navigateur ne la nomme
  pas : `isSourceImage` compare l'empreinte (FNV-1a sur 32 bits, `fingerprint`) du nom de domaine
  de l'adresse, et de chacun de ses domaines parents, à celles des domaines de Pokécardex
  (`SOURCE_DOMAINS`) : `0xdef02a18` pokecardex.com (son site, `www.` compris : un domaine parent),
  `0x6e583970` pokecardex.b-cdn.net (ses logos et icônes), `0x82cad49f` pokecardex-scans.b-cdn.net
  (ses scans ; les adresses que lit l'API des données, `src/images.ts` de son dépôt). Un nouveau
  domaine de la source s'y ajoute par son empreinte, jamais par son nom ; après `bun run build`, le
  nom ne doit apparaître nulle part dans `dist/`. Réglages › Sauvegarde › « Chercher
  les images » cherche d'un coup celles des cartes sans image. `findCardImage` (`lib/card-catalog.ts`) : l'image du catalogue pour
  cette référence, dans la langue donnée (celle de la carte, `cardLanguage` ; lue dans sa série :
  `/api/catalog/sets`, puis `/api/catalog/sets/<code>`, sous `fr/` en français), **prise telle
  quelle**, sans la charger, comme l'ajoute « Ajouter à la collection » de la page Catalogue : son
  chemin ne change jamais d'image, et une image pas encore copiée par l'API des données (les
  françaises, les heures qui suivent leur arrivée) s'affiche dès qu'elle l'est (d'ici là, la carte
  de substitution) ; une carte que le catalogue dit sans image n'en a pas. Hors du catalogue,
  celle que la référence désigne (un chemin déduit, qui peut ne mener à rien), seulement si elle
  se charge (sans réponse en 10 s : absente, pour ne pas bloquer l'enregistrement) ; la saisie le
  dit, sans nommer de source (aucun crédit dans l'app, à la demande de l'utilisateur, octobre
  2026 : CLAUDE.md). Un échec est redemandé à l'enregistrement (panne passagère), et une image
  déjà enregistrée reste si elle ne répond pas. Une adresse collée s'affiche telle quelle : la seule image que le
  navigateur va chercher ailleurs. Sans adresse collée, l'image suit la référence (cherchée en
  quittant le champ). Le code d'une carte (`lib/card-code.ts`) :
  `codeKey` en fait une clé (« SV2A 166 », « S8AG 1 » : série en majuscules sans tiret, numéro sans
  zéro), pour retrouver la carte du catalogue d'une référence.
- Retirés à la demande de l'utilisateur, à ne pas réintroduire sans demande : TCGdex et TCGplayer
  (Pokécardex est la seule source) ; le favori « Ajouter au Pokédex » (`/ajouter`, un lien
  `javascript:` qui reprenait une page produit de Cardmarket : une carte hors du catalogue se saisit
  à la main) ; sur la page Catalogue, la progression par extension, « Seulement les Pokémon sans
  carte », « Ajouter comme » et les extensions « plus utiles » ou « plus avancées ».
