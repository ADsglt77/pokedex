# Cartes, catalogue et images

La carte de chaque Pokémon, le catalogue des cartes japonaises (Pokécardex, par l'API des données) et leurs images. Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

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
  ne marche pas), le seul lien construit vers Cardmarket. Il ouvre les offres en japonais, Near
  Mint au moins (`?language=7&minCondition=2`, sauf les filtres qu'une page collée fixe déjà).
  Une par Pokémon : on la corrige (« Modifier la carte », même id, son statut et ses achats la
  suivent) ou on la retire (« Retirer la carte » : avec son statut et son prix payé ; confirmation si elle est possédée ; impossible tant qu'une commande la contient) avant
  d'en ajouter une autre. Si un fichier importé en a plusieurs, la première compte.
  Une carte de plusieurs Pokémon (TAG TEAM : `dexIds` en a plusieurs) est **une seule carte**,
  achetée une fois (décision de l'utilisateur, octobre 2026) : choisie dans le catalogue, elle va
  aussi à ceux de ses Pokémon qui n'ont pas de carte (`cardSpecies`, le Pokémon de la fiche en
  tête) ; son statut et son prix payé valent pour tous ; la valeur, le coût
  pour compléter et la prochaine commande ne la comptent qu'une fois. La retirer d'un de ses
  Pokémon l'en détache seulement (`removeCard` : elle reste aux autres, avec son statut, son prix
  payé ; possible même dans une commande) ; du dernier, elle part. La fiche dit « aussi
  celle de … ».
  Choisir la carte d'un Pokémon dit déjà qu'on la veut : tant qu'elle n'est ni commandée ni
  possédée, elle est dans la liste d'achats (`docs/collection-et-achats.md`).
- Catalogue (de l'API des données : sa lecture de Pokécardex, ses gardes et ses tables sont dans
  sa page `docs/donnees.md` ; côté site, `lib/card-catalog.ts`) : les cartes japonaises, Pokémon,
  dresseurs et énergies, environ 450 séries de 1996 à aujourd'hui, decks, promos et anciennes
  séries compris, sans les exclusivités d'autres pays d'Asie. Trois réponses, que nginx renvoie à
  l'API :
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
  versions }`, et leurs raretés. Les types
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
  (`pokemon/CardForm`) s'ouvre sur l'onglet « Cartes japonaises » (`CatalogPicker` : image
  Pokécardex, code, rareté, prix du jour, tri par date ou par prix, filtres de rareté et de type
  (`CardFilters`, retirés quand l'extension change) ; ses réglages vivent
  dans `CardForm`, l'onglet caché étant démonté) ; choisir une carte remplit la saisie (`fill` :
  référence « Pikachu ex (SV8 033) » et id, d'où l'image, le prix et le lien Cardmarket ; une carte
  TAG TEAM dit « avec … » dans la grille, et va à tous ses Pokémon sans carte tant que la référence
  reste la sienne) et y mène le focus ; on la vérifie puis l'enregistre (« Enregistrer » attend que la
  carte soit choisie, ou l'onglet de saisie). « Modifier la carte » n'a que la saisie : choisir une autre carte, ce serait
  lui transmettre le statut, le prix payé et les commandes de celle-ci. Le catalogue n'est qu'une
  aide : la carte enregistrée est une carte saisie comme les autres (`manual:<uuid>`).
  L'enregistrement (`useCardDraft.save`) attend le prix et l'image : une seule fois à la fois, la
  fenêtre ne se ferme pas pendant ce temps. Une page Cardmarket qui n'était que celle de l'id de
  départ est oubliée quand l'id change (le lien suit alors le nouvel id).
  La page Catalogue (`/catalogue?set=…`, dans le menu, `pages/catalog/`), un grand catalogue sans
  lien avec le Pokédex (à la demande de l'utilisateur, octobre 2026) : en tête, l'extension (une
  série de Pokécardex) avec son logo japonais (`SetLogo`), son code, sa sortie, son nombre de
  cartes et son bloc ; « Changer d'extension » ouvre la fenêtre pleine page des extensions
  (`SetPicker` : leurs logos, une
  recherche par code ou par nom, rangées par année ou par bloc, dans l'ordre du menu de Pokécardex,
  leurs extensions puis leurs decks ; chacune avec son nombre de cartes). Puis une recherche (nom
  français, anglais ou allemand, numéro, illustrateur), les filtres de rareté et de type (catégories
  des dresseurs et énergies comprises), ce que compte l'extension (« 188 Pokémon, 21 dresseurs et 1
  énergie · 45 secrètes » ; une secrète est numérotée au-delà du nombre imprimé, « 201/165 ») et ses
  cartes en tuiles serrées (`CatalogTile` : le numéro et le prix, puis la rareté et le nom). Un clic
  ouvre la fiche de la carte (`CardDetails`, pleine page) : son image en grand, l'extension et son
  bloc, le numéro imprimé (« Secrète »), la rareté, le type ou la catégorie, ses Pokémon,
  l'illustrateur, ses versions, ses noms anglais et allemand, la sortie au Japon, où elle en est
  dans la collection, et son prix Cardmarket avec sa courbe (`PricePanel`, comme la fiche d'un
  Pokémon) ; des flèches passent aux cartes voisines de la grille, dans l'ordre affiché. Une carte
  Pokémon a un seul bouton, « Ajouter à la collection » : elle devient la carte de tous ses Pokémon
  (une seule pour une TAG TEAM), toujours à acheter (décision de l'utilisateur, octobre 2026). Si
  l'un d'eux a déjà la sienne, elle la remplace après confirmation : l'ancienne part avec son statut
  et son prix payé (une carte TAG TEAM reste celle de ses autres Pokémon : `removeCard`) ; pas si
  une commande la retient et qu'elle quitterait tous ses Pokémon (le bouton est désactivé, la fiche
  dit pourquoi : le registre tiendrait mal). Déjà la leur (le même code dans la référence ou le même
  id Cardmarket : `isCatalogCard`) : « Dans votre collection », qui reçoit le focus après l'ajout.
  Annoncé avec « Annuler ». Les dresseurs, les énergies et les cartes dont Pokécardex ne donne pas
  les Pokémon (« Togepi, Mélo et Toudoudou-GX ») n'ont pas de bouton. Filtres de rareté et de type
  (`CardFilters`, demandés par l'utilisateur, octobre 2026) : des pastilles à icône, chacune avec le
  nombre de cartes qu'elle montrerait parmi celles que gardent l'autre filtre et la recherche ;
  plusieurs choix d'un filtre s'ajoutent, les deux filtres se combinent (`passesFilter`) ; un filtre
  qui n'offrirait qu'un choix n'est pas montré ; changer d'extension les retire, avec la recherche.
  Ce sont des filtres que l'utilisateur choisit : rien n'est trié ni écarté seul.
- Images (`lib/card-images.ts`) : copiées et servies par l'API des données (sa page
  `docs/donnees.md` : leurs sources, la tâche `images`, la copie à la demande), aux chemins neutres
  que demande le navigateur : `/images/cards/<série>/<rang>-<md|hd>.webp` (`catalogImage` : `md`
  pour la grille, `hd` pour la fiche), `/images/sets/<série>-<md|hd>.webp` (le logo japonais d'une
  série, `setLogo`), `/images/types/<n>.webp` (`typeIcon`), `/images/rarities/<n>.webp`
  (`rarityIcon` ; les noires, `DARK_RARITY_ICONS`, inversées sur le thème sombre,
  `--dark-icon-filter` ; une rareté sans icône, « FUR », s'écrit en texte), les sprites et
  illustrations des Pokémon (`spriteUrl`, `artworkUrl`). nginx les renvoie à l'API et les garde sur
  son disque (`proxy_cache`) ; le navigateur, un an, sans redemande (`immutable`). Le catalogue
  donne le rang de l'image de chaque carte ; pour une référence hors du catalogue, `cardImage` la
  déduit du code de la référence (série en majuscules sans tiret, SV-P → SVP ; numéro sans zéro),
  sans certitude. La collection garde ces chemins (`isFoundImage` : une image retrouvée, qui suit
  la référence) ; aucun ne nomme la source. Une image absente est copiée à la demande par l'API
  (une source qui ne l'a pas : 404, la carte de substitution). Une adresse collée du serveur
  d'images de la source est refusée à la saisie, et jamais affichée (`isSourceImage` : son accord,
  jamais une image affichée depuis chez elle ; une carte qui en garde une montre la carte de
  substitution, jusqu'à ce qu'elle soit corrigée). Données › « Chercher
  les images » cherche d'un coup celles des cartes sans image. `findCardImage` (`lib/card-catalog.ts`) : l'image du catalogue pour
  cette référence (lue dans sa série : `/api/catalog/sets`, puis `/api/catalog/sets/<code>`), sinon celle que la référence désigne, si elle se charge (sans réponse en 10 s :
  absente, pour ne pas bloquer l'enregistrement) ; la saisie le dit, sans nommer de source (aucun
  crédit dans l'app, à la demande de l'utilisateur, octobre 2026 : CLAUDE.md). Un échec
  est redemandé à l'enregistrement (panne passagère), et une image déjà enregistrée reste si elle
  ne répond pas. Une adresse collée s'affiche telle quelle : la seule image que le
  navigateur va chercher ailleurs. Sans adresse collée, l'image suit la référence (cherchée en
  quittant le champ). Le code d'une carte (`lib/card-code.ts`) :
  `codeKey` en fait une clé (« SV2A 166 », « S8AG 1 » : série en majuscules sans tiret, numéro sans
  zéro), pour retrouver la carte du catalogue d'une référence.
- Retirés à la demande de l'utilisateur, à ne pas réintroduire sans demande : TCGdex et TCGplayer
  (Pokécardex est la seule source) ; le favori « Ajouter au Pokédex » (`/ajouter`, un lien
  `javascript:` qui reprenait une page produit de Cardmarket : une carte hors du catalogue se saisit
  à la main) ; sur la page Catalogue, la progression par extension, « Seulement les Pokémon sans
  carte », « Ajouter comme » et les extensions « plus utiles » ou « plus avancées ».
