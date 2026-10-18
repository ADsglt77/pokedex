# Prix, historique et état des données

Les prix Cardmarket, leur historique relevé par le serveur, les lignes de la liste de souhaits Cardmarket, et l'état des tâches d'ingestion. Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

- Prix (`server/jobs/prices.ts`, tâche `prices`) : le guide des prix public de Cardmarket et sa
  liste des produits (`products_singles_6.json`), seulement les cartes à l'unité (catégorie 51),
  dans `data.db` : chaque produit (`cardmarket_products` : son nom, son extension `expansion` =
  `idExpansion` et sa carte `metacard` = `idMetacard`, indexées ensemble, pour la liste de
  souhaits ; vides pour une ligne de l'ancienne reprise ou un produit sorti de la liste), le prix
  du jour de chaque carte (`cardmarket_prices` : prix, plus bas, moyenne 30 jours, par id
  Cardmarket) et son historique (`cardmarket_history` : Cardmarket n'en garde pas ;
  une ligne par carte et par année, à partir de son premier jour avec un prix, `server/history.ts` ;
  relancée le même jour, la tâche remplace le prix du jour ; moins de la moitié des prix d'avant :
  format du guide changé, rien n'est écrit, la tâche échoue). Rien n'est retéléchargé (29 Mo) tant
  que le guide n'a pas changé (`sources` : son `Last-Modified`) ; une base d'avant les colonnes
  `expansion` et `metacard` les remplit au passage suivant (l'étape du schéma qui les ajoute,
  `db.ts`, oublie ce `Last-Modified` : le guide et la liste sont relus). La liste des produits met
  à jour un nom, une extension ou une carte qui a changé. En fin de tâche, même quand le guide n'a
  pas changé, la réponse de `/api/prices` (le fichier des prix : jour et cartes, `readPrices` ;
  404 tant que le guide n'a jamais été lu) est calculée et gardée compressée (`snapshots`, avec un
  ETag : 304 si le navigateur l'a déjà). L'app la charge au premier écran qui affiche un prix
  (l'accueil, pour sa valeur ; pas le Pokédex), et l'historique d'une carte à la demande
  (`/api/prices/<id>`, 404 sans historique) : la courbe de sa fiche, le nom affiché dans le
  formulaire pour vérifier l'id saisi (au départ du champ) ; ceux de la collection, en une fois
  (`/api/histories`, plus bas). Le Pokédex public ne la charge pas : `/api/vitrine` donne les prix
  de ses seules cartes possédées (`readPrices` avec leurs ids, `docs/compte-et-synchronisation.md`).
  Sans serveur, ou base encore vide, l'app marche sans prix. Une réponse manquante (404) n'est pas
  redemandée ; après une panne passagère (réseau, délai, réponse illisible), elle l'est la fois
  suivante où elle sert, au plus une fois par minute (`getJson`, `lib/api.ts` : la règle vaut pour
  les données de référence, catalogue et historiques compris, sauf l'état des tâches et les lignes
  de la liste de souhaits, demandés à chaque fois : `fetchFresh` ; le compte et la collection ont
  leurs propres lectures). Une carte sans id Cardmarket, ou dont
  l'id n'a pas de prix ce jour, n'a pas de prix (aucun n'est inventé ; Pokécardex donne l'id de presque toutes).
  L'ancien historique (les fichiers du volume `prices`,
  un par carte) est repris au premier démarrage d'`ingest` (`legacy-prices.ts`), vérifié avant
  d'être gardé : nombre de cartes, somme des prix, échantillon relu tel que l'API le sert.
- Historiques de la collection (`GET /api/histories?ids=719621,719654`, `server/reference.ts`) :
  la courbe de la valeur (Valeur › Évolution) demande ceux de toutes ses cartes possédées en une
  fois, et non une demande par carte. Une clé par id demandé, son historique ou `null` ; `ids`
  validés comme ceux de `/api/wants` (des entiers de 1 à 9 chiffres, sans zéro devant, séparés par
  des virgules ; 422 sinon), 1 025 au plus (une carte par Pokémon : avec les ids de 6 chiffres
  d'aujourd'hui, l'adresse d'une collection complète fait ≈ 7 Ko, sous les 8 Ko de la ligne de
  requête que nginx accepte par défaut) ; chaque id lu une fois, requête préparée une fois
  (`historyReader`, `server/history.ts`, la même pour `/api/prices/<id>`) ;
  `Cache-Control: no-cache`. L'app y met chaque id une fois (`loadPriceHistories`,
  `store/prices.ts`) et relit la réponse dans l'ordre de ses cartes (`historiesOf`,
  `lib/prices.ts`, testé) : la même carte Cardmarket possédée pour deux Pokémon compte deux fois,
  comme dans la valeur du jour (une TAG TEAM, une seule carte, une fois) ; une carte sans id ou
  sans historique ne pèse pas sur la courbe. Seule la réponse de la dernière liste reste en mémoire
  (`forget`, `lib/api.ts`) : celle d'une collection qui a changé depuis ne revient pas, et pèse
  plusieurs Mo pour une collection presque complète. Sans réponse : « L'historique des prix n'est
  pas disponible pour le moment ». Sans réseau, ou sans réponse en 4 s (un réseau faible), le
  service worker sert la dernière réponse, gardée sous une seule clé quels que soient les ids
  (`docs/interface.md`) : une carte ajoutée depuis n'y est pas. Le serveur répondant pour chaque
  id, une clé absente le révèle : la page compte ces cartes et le dit sous la courbe (« Courbe
  d'une copie gardée sur cet appareil (réseau lent ou absent), sans 2 cartes ajoutées depuis »),
  jusqu'au rechargement de la page (`getJson` garde la réponse lue ; celle du réseau, si elle est
  arrivée depuis, a remplacé la copie du service worker).
- Liste de souhaits Cardmarket (`GET /api/wants?ids=719621,719654`, `server/reference.ts` ; ses
  règles, pures : `wantsLine` et sa version `wantsVersion`, de `lib/cardmarket.ts`, testées dans
  `tests/wants.test.ts`, une mauvaise version achèterait une autre carte ; le serveur ne fait qu'en
  réunir les données en SQL : le nom du produit, les numéros imprimés de son groupe, les noms de
  séries de son extension et, pour chacun, le nombre d'extensions qui le portent ; deux choix de ce
  SQL ne sont pas testés : un seul numéro par produit, sinon aucun, `sameCard`, et les noms de
  séries comparés sans les espaces des bords, `TRIM`) : pour chaque id
  Cardmarket demandé, sa ligne pour « Ajouter une deck
  list » de la liste de souhaits de Cardmarket (`WantsLines`), ou `null` quand aucune ne
  désignerait sûrement cette carte-là. L'app n'envoie rien à Cardmarket : l'utilisateur copie les
  lignes et les colle lui-même (Achats › Prochaine commande, `docs/collection-et-achats.md`), puis
  lance son « Shopping Wizard », qui choisit les vendeurs les moins chers. Le format, vérifié par
  l'utilisateur sur cardmarket.com (octobre 2026) :
  `1x <nom du produit, sans crochets, « | » devenu une espace> (V.<n>) (<extension>)`. Le produit
  719621, « Charmander [Blazing Destruction | Steady Firebreathing] » de « Pokémon Card 151 »,
  seconde version, donne
  `1x Charmander Blazing Destruction Steady Firebreathing (V.2) (Pokémon Card 151)`, que Cardmarket
  ajoute comme « Salamèche (sv2a 168) ». Toujours `1x` : une carte par Pokémon, une TAG TEAM une
  fois.
  - La version : sans `(V.n)`, Cardmarket prend la V.1 de la carte dans l'extension (la sv2a 004
    commune au lieu de l'Art Rare sv2a 168). Elle est donc écrite dès que le groupe du produit
    (tous les produits de la liste de Cardmarket de même extension et même carte : `expansion`,
    `metacard`) en compte deux ou plus, et jamais pour un produit seul. Cardmarket numérote les
    versions dans l'ordre de leur **numéro imprimé**, pas dans celui de leur création ni de leurs
    ids (une première version de la règle s'y fiait, à tort). Vérifié par l'utilisateur sur
    cardmarket.com : dans Rebellion Crash (S2), Toxtricity VMAX S2 037 (464059) est la V.1, bien
    que créée après S2 107 (464054), la V.2 ; dans Pokémon Card 151, sv2a 004 (719446) est la V.1,
    sv2a 168 (719621) la V.2.
  - Ce numéro, seul le catalogue Pokécardex le connaît (`cards.number` des cartes dont
    `cards.cardmarket` est ce produit). La version n'est donnée que si chaque produit du groupe y a
    exactement un numéro, fait de chiffres seulement, et que deux produits n'ont jamais le même :
    c'est alors le rang du numéro du produit dans le groupe, par valeur (037 → 37), à partir de 1.
    Sinon (un produit du groupe absent du catalogue, un numéro comme TG01 ou SV-P, deux produits
    au même numéro, un produit à deux numéros), pas de ligne : la carte s'ajoute depuis sa page.
    Mesuré sur les vraies données (octobre 2026) : 16 117 produits seuls dans leur groupe, 4 808
    versions sûres, 96 sans (16 ex aequo ; les autres, un produit du groupe absent du catalogue
    ou un numéro vide).
  - L'extension : ses noms ne sont dans aucun fichier public de Cardmarket ; ceux des séries
    Pokécardex du catalogue leur correspondent (vérifié : « Pokémon Card 151 »). On prend les noms
    distincts des séries (`sets`, par `cards.set_id`) des cartes du catalogue dont le produit
    (`cards.cardmarket`) est de cette extension : un seul, c'est le sien, sans les espaces des
    bords (Pokécardex en laisse : « Shining Legends  ») ; aucun ou plusieurs (19 extensions de
    Cardmarket, promos, Jumbo, Vending Machine…, couvrent plusieurs séries Pokécardex), pas de
    ligne. Pas de ligne non plus quand ce nom est aussi celui de cartes du catalogue d'une autre
    extension (espaces des bords ignorées), car il ne désignerait pas la sienne : deux séries
    Pokécardex « Beginning Set » (HS, 2010 ; HXY, 2013), chacune d'une autre extension ; « Jumbo »,
    réparti sur sept extensions, seul nom de l'une d'elles. Une extension écrite sans parenthèses,
    ou que Cardmarket ne connaît pas, donne un souhait « toutes versions » (avec un message bleu
    « Informations ») : l'app n'en écrit jamais en connaissance de cause.
  - Pas de ligne non plus pour un produit inconnu, un produit sans extension (`expansion` vide), ni
    pour une parenthèse dans le nom ou l'extension (l'analyseur de Cardmarket la lirait mal : deux
    cartes « Imakuni? » en ont).
  - Ni la langue ni l'état ne tiennent dans une ligne : après le collage, l'utilisateur les règle
    pour toutes avec « Modification en masse » de Cardmarket (japonais, Near Mint).
  - `ids` : des entiers positifs (1 à 9 chiffres) séparés par des virgules, 2 000 au plus, validés
    par le schéma de la route (422 sinon) ; une clé par id demandé. Calculée à chaque demande (pas
    un `snapshot`), sur la base des données de référence, requêtes préparées une fois ; chaque id
    une fois (répété, il n'est pas recalculé) et les noms de chaque extension lus une fois par
    demande : un plan coûte environ 15 ms, 2 000 ids 0,15 à 0,2 s au pire (mesuré, octobre 2026),
    la route n'ayant ni session ni limite de rythme. `Cache-Control: no-cache`. L'app la demande à
    chaque ouverture de la fenêtre (`loadWantsLines`, par `fetchFresh` : sans cache, 10 s au plus) ;
    sans réponse du serveur, elle propose de réessayer.
- État des données (page Données › Sources des données, `ReferenceSection`) : où en est chaque
  tâche d'ingestion, d'après son journal (`/api/status` : dernière réussite, dernier passage, et le
  jour des prix en base), demandé à chaque ouverture de la page (`loadStatus`, `lib/api.ts`). À jour ; en retard (deux
  intervalles sans réussite, `INGEST_JOBS` de `config/jobs.ts`, que suit aussi `ingest.ts`) ; en
  échec (le dernier passage) ; à lancer (jamais passée : la commande est donnée), sauf les images,
  facultatives (le serveur copie à la demande celles affichées). Sans réponse : « l'état des
  données est inconnu ». Dans le formulaire d'une carte, un id Cardmarket n'est pas mis en doute
  tant que les prix manquent tous.
