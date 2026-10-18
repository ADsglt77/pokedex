# Cartes, catalogue et images

La carte de chaque Pokémon, le catalogue des cartes japonaises (Pokécardex) et leurs images. Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

- Une carte (`PokemonCard`) : id `manual:<uuid>`, ses Pokémon (`dexIds`), une référence (vide à la
  saisie : le nom de la carte chez Cardmarket, sinon le nom du Pokémon), son image (`image` :
  celle de Pokécardex en deux tailles (ou de TCGplayer, d'une ancienne version), ou l'adresse
  collée, `small` = `large` ; `null` sans image),
  son id Cardmarket (`cardmarket`) et sa page chez Cardmarket (`page`), tous deux facultatifs ;
  sans page notée, le lien « Voir sur Cardmarket » se fait par l'id (`cardmarketPage`). Il
  ouvre les offres en japonais, Near Mint au moins (`?language=7&minCondition=2`).
  Une par Pokémon : on la corrige (« Modifier la carte », même id, son statut et ses achats la
  suivent) ou on la retire (« Retirer la carte » : avec son statut et son prix payé ; confirmation si elle est possédée ; impossible tant qu'une commande la contient) avant
  d'en ajouter une autre. Si une ancienne version en a gardé plusieurs, la première compte.
  Une carte de plusieurs Pokémon (TAG TEAM : `dexIds` en a plusieurs) est **une seule carte**,
  achetée une fois (décision de l'utilisateur, octobre 2026) : choisie dans le catalogue, elle va
  aussi à ceux de ses Pokémon qui n'ont pas de carte (`cardSpecies`, le Pokémon de la fiche en
  tête) ; son statut et son prix payé valent pour tous ; la valeur, le coût
  pour compléter et la prochaine commande ne la comptent qu'une fois. La retirer d'un de ses
  Pokémon l'en détache seulement (`removeCard` : elle reste aux autres, avec son statut, son prix
  payé ; possible même dans une commande) ; du dernier, elle part. La fiche dit « aussi
  celle de … ».
  Choisir la carte d'un Pokémon dit déjà qu'on la veut : ni statut « souhaitée » ni « À acheter »
  (retirés à la demande de l'utilisateur, octobre 2026) ; tant qu'elle n'est ni commandée ni
  possédée, elle est dans la liste d'achats.
- Catalogue (tâche `catalog`, `server/jobs/catalog.ts`, une fois par jour → tables `sets`, `cards`,
  `card_species`, `rarities` → `/api/catalog/species/<n°>`, `/api/catalog/sets`, `/api/catalog/sets/<code>`,
  `lib/card-catalog.ts`) : les cartes japonaises de Pokécardex, Pokémon, dresseurs et énergies (`server/lib/pokecardex.ts`), ≈ 450 séries de 1996 à aujourd'hui, decks, promos et
  anciennes séries compris (27 Herbizarre japonaises, contre 8 chez TCGdex), sans les exclusivités
  d'autres pays d'Asie (bloc « Asia Exclusive » de son menu, `asiaExclusive`). La liste des séries
  vient de son plan du site (`sitemap_fr.xml`, `/series/jp/<code>`) ; chaque série, de sa page :
  son nom, sa sortie au Japon, et ses cartes (id Pokécardex, numéro imprimé « 001/165 », `sort`,
  noms français, anglais et allemand, Pokémon `id_pokedex_list`, id Cardmarket, rareté
  `id_rarete`, type `id_type`, illustrateur `nom_illustrateur`, versions `versions` : « Standard »,
  « Reverse »… ; un tiret seul, « — », qu'il écrit pour « inconnu », est gardé vide), toutes les
  raretés (`raretes` : nom et ordre) et le menu des séries (`seriesMenu` : le bloc de chacune,
  « Scarlet & Violet », son rang dans le menu, et si c'est un deck), gardés depuis la première page
  lue de chaque passage. Les types sont numérotés par Pokécardex sans être nommés : leurs noms sont dans
  `CARD_TYPES` (`src/config/catalog.ts` : 1 Plante, 2 Eau, 3 Feu, 4 Électrique, 5 Psy,
  6 Obscurité, 7 Métal, 8 Combat, 9 Dragon, 10 Incolore, 11 Fée ; les catégories des dresseurs,
  12 Stade, 13 Dresseur (une carte d'avant les catégories), 14 Supporter, 15 Objet, 41 Outil
  (`TRAINER_TYPES`), et 16 Énergie (`ENERGY_TYPE`), d'après ses icônes et ses cartes). Les raretés gardent les noms de Pokécardex : « C », « SAR »… pour
  les cartes récentes, « Commune », « Unco », « Rare », « Holographique » pour les anciennes, « Sans
  rareté » pour celles qui n'en impriment pas. Toutes les cartes, dresseurs et énergies compris
  (pour la page Catalogue, à la demande de l'utilisateur, octobre 2026) : sans Pokémon, rien dans
  `card_species` (ni dans `/api/catalog/species/<n°>`, qui ne donne que les cartes Pokémon). Ses pages portent leurs données chiffrées
  (`__INITIAL_DATA_ENCRYPTED__`, AES-CBC) : déchiffrées avec la clé que contient son JavaScript,
  relue quand l'adresse de son script change (à chaque mise en ligne du site), jamais recopiée dans le
  dépôt. Une page toutes les 3 s, User-Agent identifié : le premier passage prend une vingtaine de
  minutes ; ensuite, une série est relue chaque semaine, chaque jour si elle est sortie depuis
  moins de 90 jours (`read_at`), et `--refresh` les relit toutes. Une page en échec n'empêche pas
  les autres (la tâche échoue ensuite, pour être relancée) ; dix d'affilée arrêtent la lecture
  (le site a changé : on ne le sollicite pas davantage). Une série qui donne moins de la moitié
  des cartes qu'elle avait est refusée (format des pages changé : rien n'est gardé, c'est un échec).
  Une page sans cartes (série annoncée, ou
  site changé) ne retire rien et n'est pas notée : elle est relue au passage suivant. Tant qu'aucune
  carte n'a été lue, rien n'est publié : les réponses du catalogue répondent 404 (« pas disponible »).
  Une carte qu'une lecture de sa série ne voit plus est retirée (`seen`). Sans serveur, la fenêtre
  d'ajout et la page Catalogue le disent (« pas disponible pour le moment »).
  `/api/catalog/species/<n°>` (octobre 2026 ; avant, `/api/catalog`, le catalogue entier, 930 Ko
  pour n'en lire qu'un Pokémon, retiré par une étape du schéma), les cartes Pokémon d'un Pokémon
  (la fenêtre d'ajout, `loadSpeciesCards` ; une réponse par Pokémon, les 1 025, même sans carte :
  la fenêtre le dit), dans la forme du catalogue entier réduit à lui, des plus récentes aux plus
  anciennes : `[série, numéro (sans numéro imprimé : `sort`), id Cardmarket (0 :
  aucun), nom français, numéro de son image (`sort`, 0 : Pokécardex ne l'a pas), rareté (0 :
  inconnue), type (0 : inconnu), Pokémon s'ils sont plusieurs]` ; chaque série : `[nom, sortie,
  logo]` (0 : Pokécardex n'a pas de logo) ; les raretés de ces cartes : `[nom, rang]`. La forme a
  changé (octobre 2026, rareté, type et logo) : l'étape du schéma qui ajoute ces colonnes fait
  relire toutes les séries au passage suivant de la tâche (`read_at` remis à 1970), la suivante
  retire l'ancienne réponse, que le navigateur ne sait plus lire (404, « pas disponible », plutôt
  qu'une page en erreur), et la tâche la refait dès son démarrage d'après les tables (`saveCatalog`,
  comme la boucle d'ingestion au sien), avant de relire les séries. Pour la page Catalogue :
  `/api/catalog/sets`, les séries, des plus récentes aux plus anciennes, `[code, nom, sortie, logo,
  nombre de cartes, rang de son bloc dans `blocks` (-1 : aucun), 1 pour un deck]`, et les blocs
  dans l'ordre du menu ; `/api/catalog/sets/<code>`, toutes les cartes d'une série dans son ordre
  (`sort`), chacune `{ number, printed, name, en, de, dexIds, cardmarket, image, rarity, type,
  illustrator, versions }`, et leurs raretés ; une réponse par série (`snapshots` :
  `catalog/sets/<code>`, celles des séries disparues retirées), gardée hors ligne par le service
  worker une fois vue. Toutes les cartes et ce qu'on en sait de plus (octobre 2026) : l'étape du
  schéma qui ajoute ces colonnes fait relire toutes les séries (`read_at` remis à 1970) ; jusque-là,
  les dresseurs et les énergies manquent et les nouveaux champs sont vides. Chaque réponse est
  gardée compressée en gzip et en Brotli (un quart plus petite ; `saveSnapshot` ne recompresse
  pas une réponse inchangée : le premier passage prend une vingtaine de secondes, les suivants
  moins d'une). La référence d'une carte : « Dracaufeu ex (SV2A 006) », son nom puis le code de
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
  lien avec le Pokédex (à la demande de l'utilisateur, octobre 2026 : plus de progression par
  extension, de « Seulement les Pokémon sans carte », d'« Ajouter comme », ni d'extensions « plus
  utiles » ou « plus avancées ») : en tête, l'extension (une série de Pokécardex) avec son logo
  japonais (`SetLogo`), son code, sa sortie, son nombre de cartes et son bloc ; « Changer
  d'extension » ouvre la fenêtre pleine page des extensions (`SetPicker` : leurs logos, une
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
- Plus de favori « Ajouter au Pokédex » (un lien `javascript:` qui reprenait une page produit de
  Cardmarket, `/ajouter`) : retiré à la demande de l'utilisateur (octobre 2026), le catalogue
  Pokécardex donnant presque toutes les cartes avec leur id Cardmarket ; une carte qu'il n'a pas se
  saisit à la main. Ne pas le réintroduire sans demande.
- Images (`lib/card-images.ts`, `server/images.ts`, tâche `images`) : chez Pokécardex,
  `pokecardex-scans.b-cdn.net/sets_jp/<série>/<sort>.jpg?class=md` (son code tel quel, « S8A-G »
  compris ; tailles `md` pour la grille, `hd` pour la fiche) : `pokecardexImage`. Le catalogue
  donne l'adresse exacte de chaque carte ; pour une référence hors du catalogue, `cardImage` la
  déduit du code de la référence (série en majuscules sans tiret, SV-P → SVP ; numéro sans zéro),
  sans certitude. La collection garde les adresses d'origine (son format ne change pas), mais le
  navigateur ne charge que la copie du serveur (condition de Pokécardex) : `localSrc` en donne le
  chemin (`/images/cards/pokecardex/SV2A/6-md.webp`), pour le `src` de `CardArt` et pour
  `findCardImage`. La tâche `images` (chaque jour, la dernière, après les prix et les sauvegardes ; deux téléchargements à la
  fois, seulement ce qui manque ; le premier passage, environ 1,5 Go, prend une heure ou plus) copie
  d'abord, pour chaque série du catalogue, son logo japonais
  (`pokecardex.b-cdn.net/assets/images/logos_jp/<série>.png`, jamais `logos/`, le français ; en
  WebP, `?class=md` pour la fenêtre des extensions, `hd` en tête de la page :
  `/images/sets/SV2A-md.webp`, `setLogo`), noté s'il existe (`sets.logo`, cherché de nouveau chaque
  semaine) ; les icônes des types (`types/type_<n>.png` → `/images/types/<n>.webp`, `typeIcon`) et
  des raretés (`rarete/ids/rarete_<n>.png` → `/images/rarities/<n>.webp`, `rarityIcon` ; les noires,
  `DARK_RARITY_ICONS`, inversées sur le thème sombre, `--dark-icon-filter` ; une rareté sans icône,
  « FUR », s'écrit en texte) : légers (une dizaine de Mo), attendus par le choix d'une extension ;
  puis les sprites et illustrations des 1 025 Pokémon ; puis, pour chaque carte du catalogue, son
  scan en deux tailles, noté s'il existe (`cards.image`) : le catalogue le dit d'avance. Une carte sans
  scan est recherchée chaque semaine. Une image en erreur (panne, réponse qui n'est pas une image)
  n'arrête pas les autres : rien n'est noté pour elle, elle est redemandée au passage suivant, et la
  tâche échoue à la fin (à la 20e erreur, elle s'arrête : la source est sans doute en panne).
  Une image absente du volume (référence saisie hors du
  catalogue, image pas encore copiée) est copiée à la demande par le serveur (`serveImage` :
  seulement les chemins plausibles, `plausible` : chez Pokécardex, une série du catalogue et un
  numéro d'image jusqu'au plus grand des siens, le logo d'une série du catalogue, un type de
  `CARD_TYPES`, une rareté connue ; un Pokémon de 1 à 1 025 ; jamais plus chez TCGplayer ; une absence retenue une semaine ; une source en panne :
  502, et « Image non copiée » au journal ; nginx laisse passer jusqu'à 60 copies d'un coup puis
  10 par seconde, sans faire attendre, `nodelay`, et le serveur en télécharge 4 à la fois, sans la
  pause de la tâche, 15 s au plus). Une image copiée est gardée un an par le navigateur, sans
  redemande (`immutable` : `mirror` ne réécrit jamais un fichier qui existe). Les images de TCGplayer qu'une ancienne version a enregistrées
  s'affichent encore si le volume en a la copie (jamais plus copiées) ;
  Données › « Chercher les images » les remplace par celles de Pokécardex, comme il cherche celles
  des cartes sans image. `findCardImage` (`lib/card-catalog.ts`) : l'image du catalogue pour
  cette référence (lue dans sa série : `/api/catalog/sets`, puis `/api/catalog/sets/<code>`), sinon celle que la référence désigne, si elle se charge (sans réponse en 10 s :
  absente, pour ne pas bloquer l'enregistrement) ; la saisie le dit, sans nommer de source (aucun
  crédit dans l'app, à la demande de l'utilisateur, octobre 2026 : CLAUDE.md). Un échec
  est redemandé à l'enregistrement (panne passagère), et une image déjà enregistrée reste si elle
  ne répond pas. Une adresse collée s'affiche telle quelle : la seule image que le
  navigateur va chercher ailleurs. Sans adresse collée, l'image suit la référence (cherchée en
  quittant le champ). Le code d'une carte (`lib/card-code.ts`) :
  `codeKey` en fait une clé (« SV2A 166 », « S8AG 1 » : série en majuscules sans tiret, numéro sans
  zéro), pour retrouver la carte du catalogue d'une référence.
