# Collection et achats

La collection (statuts, prix payés), la liste d'achats, les commandes et le budget : un document par compte, gardé par le serveur (`docs/compte-et-synchronisation.md`). Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

- Collection : les cartes choisies (`customCards`), un statut par carte (commandée, possédée ;
  sans statut, elle est à acheter) et le prix payé (`paidPrice`) qui le suit. Son format est
  celui des exports et des documents gardés par le serveur : ne pas le changer. Seuls ses champs connus sont gardés
  à la lecture (`readCollection` : `schemaVersion`, `updatedAt`, `cards`, `customCards`,
  `favorites` et `series`, vide dans un document d'avant les collections d'extensions ; de même
  `readShopping` pour les achats). La page Valeur montre ce que les commandes
  ont coûté en tout (« Dépensé en tout »).
- Carte favorite : un Pokémon peut avoir plusieurs cartes (`customCards`) ; `favorites`
  (`CollectionData.favorites`, le numéro du Pokémon → l'id de l'une de ses cartes) dit laquelle on
  montre pour lui. Invariant : un Pokémon qui a au moins une carte a exactement une favorite, l'une
  de ses cartes ; un Pokémon sans carte n'en a pas. Une carte TAG TEAM peut être la favorite de
  chacun de ses Pokémon, chacun pour soi. Qui la choisit : la première carte d'un Pokémon l'est
  d'office (`saveCard`, par `completeFavorites` : pour une carte de plusieurs Pokémon, chacun de ceux
  qui n'en ont pas encore ; une case d'extension, au moment où elle devient une de ses cartes :
  `obtain`) ; ensuite, seul l'utilisateur la change (`setFavorite`, une carte à la fois pour un
  Pokémon, les autres Pokémon n'y changent rien) : l'app ne la choisit jamais, rien
  n'est proposé quand une carte est obtenue. Retirer la favorite d'un Pokémon (`removeCard`) : si
  le Pokémon garde d'autres cartes, l'appelant désigne la nouvelle favorite (paramètre `favorite`) ;
  sans autre carte, il n'a plus de favorite. Une carte TAG TEAM retirée d'un Pokémon reste la
  favorite des autres. `schemaVersion` reste `1` : un champ ajouté, les documents d'avant se lisent.
  Testé (`tests/cards.test.ts`), « Annuler » compris : ces règles ne modifient pas ce qu'elles
  reçoivent. À la lecture (`readCollection`, par `completeFavorites`), les favorites sont
  complétées : un document d'avant les favorites, ou un fichier auquel il en manque, donne à chaque
  Pokémon sa première carte (celle que le Pokédex montrait) ; celles notées restent. Une carte
  abîmée (pas un objet à `dexIds` en liste) n'en donne pas et la lecture ne plante jamais : le
  contrôle la refuse ensuite. Ce contrôle (`documentProblem`, après celui des cartes) refuse une
  favorite qui n'est pas l'id d'une carte du document portant ce Pokémon (« la carte favorite du
  Pokémon n° 25 n’est pas une de ses cartes » : une carte d'un autre Pokémon, une carte absente, une
  clé qui n'est pas un numéro, une case d'extension pas encore obtenue). Testé
  (`tests/import.test.ts`).
- Collections d'extensions (`CollectionData.series`, `lib/series.ts`) : une collection, ce sont
  toutes les cartes d'une extension dans une langue (Pokémon, dresseurs, énergies, secrètes ; une
  Reverse est la même case), une case par carte, dans l'ordre de l'extension
  (`SeriesCollection.cards` : l'id d'une carte de `customCards` chacune). `set` est le code de
  l'extension au catalogue (« M6A »), `language` absente pour une japonaise (comme une carte),
  `name` son nom au catalogue, gardé pour l'afficher sans le recharger, `startedAt` le jour où elle
  a été commencée. Plusieurs collections, japonaises et françaises mélangées, dans l'ordre où elles
  ont été commencées ; jamais deux fois la même extension dans la même langue (`findSeries`). Un
  dresseur ou une énergie est une carte sans Pokémon (`dexIds` vide).
  - Commencer (`startSeries`) : une carte n'existe qu'une fois. Une carte déjà dans le compte, de
    même langue et de même code (extension et numéro) ou de même id Cardmarket (`cardCodeKey`,
    `cardmarketKey`, `lib/card-code.ts`, la règle d'`isCatalogCard` en clés), est reprise comme sa
    case, telle quelle (statut, achats, place au Pokédex). Une case chacune (jamais deux fois le
    même id dans une collection) : celle de son code d'abord, sinon celle de son id Cardmarket, car
    deux cartes d'une extension ont parfois le même id Cardmarket au catalogue (« AR 94 » et « AR
    AR7 » en français). Chaque carte du compte est lue une fois, rangée par clé : le clic attend le
    calcul, et un compte de 8 000 cartes commence une extension de 250 cartes en quelques
    millisecondes (testé ; comparer chaque case à chaque carte prenait près de 3 s). Une japonaise n'est jamais la case d'une extension française. Une case pas encore
    obtenue d'une autre collection n'est jamais reprise : deux extensions ont parfois une carte de
    même id Cardmarket (« SC2 012 », « SC-C 012 »), et supprimer la première collection la
    retirerait à la seconde. Les autres cases sont ajoutées marquées `seriesOnly` : pas encore des
    cartes de leurs Pokémon, ni au Pokédex (`buildPokedex` les saute), ni sur leur fiche, jamais
    favorites (`completeFavorites` les saute). Commencer une extension ne remplit pas
    le Pokédex ; une case est débloquée quand elle est possédée. Les cases viennent du catalogue,
    chargé au moment de commencer (`seriesSlot`, `lib/card-catalog.ts` : une nouvelle carte
    `seriesOnly` par carte de l'extension ; Collections et Catalogue, `useStartCollection`). Le
    magasin (`store/collection.ts`) ne recommence pas une extension déjà commencée dans cette
    langue : un second clic pendant le chargement de ses cartes mettrait chaque case en double.
  - Obtenir (`obtain`, `lib/collection.ts`) : une case possédée, par son statut (`setCardStatus`)
    ou à la réception d'une commande (`applyOrder`), perd `seriesOnly` pour de bon et devient une
    carte de ses Pokémon, favorite de ceux qui n'en ont pas (les autres gardent la leur ; un
    dresseur n'en donne aucune). La quitter (« sans statut ») ne la rend pas à l'extension ;
    commandée seulement, elle reste une case.
  - Ajouter seule (`adopt`, `lib/collection.ts`) : une case pas encore obtenue qu'on ajoute à ses
    Pokémon (« Ajouter à la collection » du Catalogue, la fenêtre d'ajout d'une fiche :
    `docs/cartes.md`) est reprise, jamais copiée (une carte n'existe qu'une fois) : elle perd
    `seriesOnly` comme à l'obtention (`obtain` : favorite de ceux de ses Pokémon qui n'en ont pas),
    garde son statut (aucun, ou commandée) et reste une case de sa collection.
  - Retirer : une carte qui est une case d'une collection (`seriesOf`) y reste ; sur la fiche d'un
    Pokémon, « Retirer la carte » est inactif (« Elle fait partie de votre collection Méga Rêve ex :
    elle y reste. »). Supprimer la collection ne retire que des cases pas encore obtenues, qui ne
    sont sur aucune fiche : une carte de la fiche (possédée, ou ajoutée seule) reste, et se retire
    ensuite de la fiche comme les autres.
  - Supprimer (`removeSeries`, d'après `seriesRemoval`, ce que dit aussi sa confirmation) : les
    cartes possédées restent dans le compte (et au Pokédex pour celles d'un Pokémon : un dresseur ou
    une énergie n'y est pas) ; une case commandée, ou dans une commande quel que soit son état
    (`isInAnOrder` : le registre ne perd rien), reste comme carte seule (sans `seriesOnly`,
    favorite de ceux de ses Pokémon qui n'en ont pas) ; les autres cases disparaissent, avec leur
    statut. Une carte de l'extension ajoutée seule, reprise comme case, ne bouge pas. Un dresseur
    ou une énergie (sans Pokémon) n'a pas d'autre page que ses collections : sans elles, rien ne le
    montrerait plus, ni ne pourrait le changer ou le retirer. Il ne reste donc que possédé, dans une
    commande, ou case d'une autre collection (une carte obtenue peut l'être de plusieurs) ; sinon il
    part avec son statut, même obtenu puis quitté, ou « commandée » à la main sans commande (un
    statut sans commande n'est pas le registre). Testé (`tests/series.test.ts`).
  - Progression (`seriesProgress`) : ses cases possédées sur toutes, chacune une fois (une TAG TEAM
    aussi) ; leur valeur (prix du marché) ; le coût pour la compléter (les cases ni possédées ni
    commandées) et combien d'entre elles n'ont pas de prix.
  - Testé (`tests/series.test.ts`) ; ces règles non plus ne modifient pas ce qu'elles reçoivent
    (`tests/cards.test.ts`).
  - Lecture et contrôle (`lib/transfer.ts`, pour un fichier importé comme pour l'envoi au serveur ;
    testé dans `tests/import.test.ts`) : `readCollection` rend `series` (une liste, sinon aucune
    collection : un export d'avant s'importe). Une carte (`isCard`) peut n'avoir aucun Pokémon
    (`dexIds` vide : un dresseur, une énergie ; un numéro hors du Pokédex reste refusé), et son
    `seriesOnly` est absent ou `true`, jamais `false` (le champ disparaît à l'obtention). Une favorite
    sur une case `seriesOnly` est refusée (le message des favorites). `documentProblem`, après les
    cartes et les favorites, refuse, en le disant en clair :
    - une collection abîmée (« la collection « Pokémon Card 151 » est abîmée » ; « sans nom » quand
      elle n'en a pas) : une extension (`set`) vide ou qui n'est pas un texte, un nom qui n'en est pas
      un, une langue autre que `'fr'` ou absente, un jour de début illisible, des cases qui ne sont pas
      une liste d'ids distincts de cartes du document ;
    - deux collections de la même extension dans la même langue (« deux collections de l’extension
      SV2A ») ;
    - une case `seriesOnly` qui n'est dans aucune collection (« la carte « Carte s » n’est dans
      aucune collection ») ou dans plusieurs (supprimer l'une la retirerait à l'autre ; une carte
      qui n'est pas `seriesOnly` peut être la case de plusieurs collections, ou d'aucune : une carte
      possédée reste après la suppression de sa collection).
  - Le Pokédex public montre les collections (`series`, champ par champ) et leurs cases, marquées
    `seriesOnly` tant qu'elles ne sont pas obtenues (`shownCollection`) ; jamais un statut
    « commandée » ni un prix payé (`docs/compte-et-synchronisation.md`). Au journal du serveur, une
    collection commencée ou supprimée est une ligne (`documentChanges`), pas une par case.
- Débloqué : un Pokémon l'est dès qu'une de ses cartes est possédée, quelle qu'elle soit ; sa
  favorite ne décide que de la carte que le Pokédex montre pour lui. Chaque entrée du Pokédex
  (`PokedexEntry`, `buildPokedex`) a sa favorite (`card`), toutes ses cartes dans l'ordre d'ajout
  (`cards`, sans les cases d'extension pas encore obtenues) et où il en est (`status`) : `owned`
  si une de ses cartes est possédée, sinon `ordered` si une est commandée, sinon rien ; `unlocked`
  est `status === 'owned'`. La pochette (en couleur, marque « possédée »), la fiche (« Débloqué : carte possédée ») et le Pokédex public lisent ce
  statut, pas celui de la favorite : une favorite pas encore possédée reste montrée avec son propre
  statut, et le Pokémon n'en est pas moins débloqué. Testé (`tests/pokedex.test.ts`, avec le jour du
  déblocage : celui de la première de ses cartes obtenue ; une case d'extension commandée ne le dit
  pas « commandé », possédée elle devient une de ses cartes).
- Coût pour compléter (Valeur › « Pour compléter le Pokédex », `completionCost`) : pour chaque Pokémon à
  débloquer (`status` nul : aucune de ses cartes n'est possédée ni commandée), le prix de sa
  **favorite**, seule chiffrée ; ses autres cartes ne comptent pas. Un Pokémon sans carte
  (`noCard`) n'est pas chiffré. Un Pokémon débloqué, par n'importe laquelle de ses cartes, ou dont
  une carte est commandée n'y est pas (il compte dans les commandes). Une même carte (TAG TEAM,
  favorite de deux Pokémon) n'est comptée qu'une fois. Testé (`tests/prices.test.ts`).
- Langue d'une carte (`PokemonCard.language`) : `'fr'` pour une carte française ; absente, elle est
  japonaise (`cardLanguage`, `lib/collection.ts`), si bien que les collections et les exports
  d'avant restent japonais, sans migration. Le japonais n'a qu'une écriture, l'absence :
  `isCard` (`lib/transfer.ts`, pour un fichier importé comme pour l'envoi au serveur) n'accepte que
  l'absence ou `'fr'`, et refuse `'ja'` ou toute autre langue (testé). Le Pokédex public recopie la
  langue (`shownCollection`, testé) : sans elle, une carte française y passerait pour japonaise
  (mauvaise image, mauvais lien).
- Achats (`/achats`, `ShoppingData`, à part de la collection dans le document : elle garde son
  format ; ceux d'un nouveau venu, aucune commande et le budget par défaut :
  `emptyShopping`, `lib/orders.ts`) :
  - la liste d'achats n'est pas enregistrée : ce sont toutes les cartes du compte ni possédées ni
    commandées (`wishlistRows`, lue dans la collection, chacune une fois : une TAG TEAM une fois),
    celles de tous les Pokémon, pas seulement les favorites, et les cases des collections
    d'extensions, dresseurs et énergies compris, toutes voulues autant (décision de l'utilisateur,
    octobre 2026 : choisir la carte, ou commencer l'extension, suffit) ; les cartes d'un Pokémon
    déjà débloqué par une autre y restent tant qu'elles ne sont ni commandées ni possédées (testé,
    `tests/purchase-planner.test.ts`). Une carte sans Pokémon ni collection (un dresseur gardé par
    une commande après la suppression de sa collection, puis sorti de la commande) n'y est pas : rien
    ne la veut, et aucune page ne la montre plus (testé). Une case dit sa collection (`WishRow.series`, `seriesOf` : la
    première, pour une carte obtenue qui l'est de plusieurs), sur sa carte de la liste comme sur sa
    ligne (prochaine commande, commandes). Une carte sans Pokémon n'a pas de génération (un filtre
    de génération l'écarte), se cherche par sa référence et vient après les autres au tri par
    numéro (`filterWishlist`). Le lien vers Cardmarket est `cardmarketPage` : la page notée, sinon
    l'id. La prochaine commande (`planPurchase`, `purchase-planner`) ne lit qu'elle : elle y prend
    les moins chères d'abord, dans le budget, port réservé, et une par Pokémon pour les cartes du
    Pokédex ; une case d'extension pas encore obtenue (`seriesOnly`) n'est pas encore une carte de
    ses Pokémon : elle est libre de cette règle, ni écartée par une carte du même Pokémon prise
    avant elle, ni écartant celles prises après (deux cases du même Pokémon sont prises ; testé).
    On peut en retirer ou en ajouter à la main. Après « Enregistrer comme commande », l'assistant
    repart de ses réglages par défaut (le budget : le reste du mois, cette commande comprise) ;
  - « Copier pour Cardmarket » (`shopping/WantsDialog`, à côté d'« Enregistrer comme commande… »,
    sous la jauge du total, affiché comme lui dès que la prochaine commande a une carte) en fait
    des lignes pour la liste de
    souhaits de Cardmarket, que l'utilisateur colle lui-même : l'app n'envoie rien à Cardmarket
    (format, version et extension : `/api/wants`, `docs/prix.md`). La fenêtre « Ajouter à ma liste
    Cardmarket » attend les lignes (« Réessayer » si le serveur ne répond pas), puis les donne en
    deux blocs au plus, « Cartes japonaises » et « Cartes françaises » (un bloc seulement s'il a
    des cartes : une ligne ne porte pas la langue, et `cardLanguage` classe chaque carte). Chaque
    bloc a ses étapes : sur Cardmarket, ouvrir sa liste de souhaits, « Ajouter une deck list »,
    coller, « Ajouter » ; « Modification en masse » : langue japonais ou français selon le bloc,
    état Near Mint, pour ces cartes ; vérifier le numéro de chaque carte (« Salamèche (sv2a 168) »).
    Une fois toutes les cartes dans la liste, lancer le « Shopping Wizard », qui choisit les
    vendeurs les moins chers. Les lignes de chaque bloc sont dans un champ en lecture seule ; son
    « Copier » (`copyText`, `lib/clipboard.ts`, comme l'adresse du Pokédex public) dit « N cartes
    japonaises copiées » (ou françaises), ou, si le navigateur refuse (hors https aussi),
    sélectionne les lignes et dit de les copier avec Ctrl+C.
    Chaque carte du plan a un prix, donc un id Cardmarket. Une carte sans ligne sûre (version ou
    extension incertaine, de toute langue : l'API n'a pas de ligne pour une carte française dont
    l'extension n'a pas de nom anglais confirmé) est listée à part, avec son lien « Voir sur
    Cardmarket » (`CardmarketLink`) : l'ajouter depuis sa page (« Ajouter à mes souhaits », déjà
    dans la langue de la carte, Near Mint par le lien). Un message bleu « Informations » de
    Cardmarket signale une carte ajoutée sans sa version : la retirer de la liste et l'ajouter
    depuis sa page ;
  - commandes : `applyOrder` (`lib/orders.ts`) reporte chaque enregistrement sur la collection (en
    cours → commandée, reçue → possédée, annulée ou supprimée → l'état d'avant, gardé dans
    `OrderLine.previous`, `previousOf`, relu à chaque enregistrement, formulaire comme « Marquer
    reçue » : l'état actuel dès que la carte ne porte plus l'effet de la commande, commande annulée
    ou carte corrigée à la main depuis). Une possession n'est jamais retirée ; une carte qui quitte
    une commande reçue (ligne retirée, commande annulée ou supprimée) reste possédée, sans la date
    ni le prix payé que la commande lui avait donnés : ceux d'une autre commande reçue qui la
    contient (réception, prix de revient), sinon aucun. Une commande reçue ne repasse pas « en
    cours » (le formulaire ne le propose pas : `canBePending`) : ses cartes resteraient possédées
    avec sa date et son prix payé sans plus porter son effet ; au prochain enregistrement, elles
    passeraient pour possédées avant elle (« Déjà possédée avant cette commande »), son remboursé
    ne changerait plus leur prix payé, et l'annuler ou la supprimer leur laisserait sa date et son
    prix. Une réception notée par erreur se défait par « Annuler » du message ; sinon, l'état
    « Annulée ». Le prix payé est le prix de revient (port, frais et remboursé répartis au prorata,
    au centime ; les centimes d'arrondi vont aux lignes d'une seule carte, en plusieurs tours,
    jamais sous 0 €, pour que les prix de revient fassent le total). Corriger la date de réception
    corrige la date d'obtention. Une carte déjà dans une autre
    commande est signalée à la saisie (son prix payé serait remplacé). Une commande en cours depuis
    plus de 28 jours est signalée, aux Achats et à l'accueil (`latePendingOrders`) ; chaque
    commande s'ouvre en détail (coût réel de chaque carte) ;
  - budget calculé depuis les commandes : une commande compte une fois, au mois de sa date d'achat,
    remboursé déduit (jamais plus que la commande), rien si annulée. Au-delà du plafond :
    confirmation, jamais de blocage ; le formulaire montre le mois avec la commande en cours de
    saisie ; fermer une saisie commencée (Échap, « Annuler »), ou quitter la page avec elle (le
    titre d'une carte, le retour du navigateur, la recherche Ctrl K : `useBlocker`), demande
    confirmation (« Abandonner la saisie ? ») ; enregistrer ou abandonner ne demande rien de plus.
    Une question (plafond, abandon) remplace la fenêtre le temps d'y répondre, jamais ouverte
    dedans (deux fenêtres se disputeraient le focus, et la page resterait sans défilement) : la
    saisie revient telle quelle après « Annuler ». Les dates (achat, réception) sont celles que
    l'import et le serveur acceptent (`isDay`) : « 05/10/26 », l'an 26, est refusé. Les filtres de
    la liste sont dans l'adresse (`docs/interface.md`) ; les réglages de l'assistant (prochaine
    commande) sont gardés par la page, l'onglet caché étant démonté ;
  - l'export contient `shopping`. Un import demande toujours confirmation ; un fichier abîmé
    (enregistrement ou bloc d'achats illisible ou absent : image, montant en texte, état de
    commande, date ou jour qui n'existe pas ou d'avant l'an 100, remboursé plus grand que la commande, commande sans id ou en double, carte
    d'un Pokémon hors du Pokédex ou sans clé `image` (« Modifier la carte » planterait), favorite qui
    n'est pas une carte de son Pokémon, collection d'extension abîmée (case inconnue ou en double,
    deux fois la même extension dans la même langue, case pas encore obtenue hors de toute
    collection), id Cardmarket
    que la saisie refuserait (0, négatif, plus de 9 chiffres…), quantité qui n'est pas un entier
    de 1 ou plus, texte qui n'en est pas un, lien…) est refusé (`lib/transfer.ts`), comme par le
    serveur à l'enregistrement, et la règle en cause est dite (« La commande du 5 octobre 2026
    est abîmée. », `documentProblem`, `readImport`). Les montants saisis (`parseEuros`) acceptent
    une virgule ou un point, le symbole et une espace entre les milliers seulement (« 1 234,50 ») :
    « 12 50 », une virgule oubliée, est refusé plutôt que lu 1 250 € ; une quantité (`parseQuantity`)
    s'écrit en chiffres seulement (« 1e1 » ne vaut pas 10). La saisie d'une commande, des textes,
    est lue à l'enregistrement par `readDraft` (`pages/shopping/orderDraft.ts`, testé) : un
    montant facultatif vide vaut 0, un montant ou une quantité illisible est une erreur du champ,
    jamais un montant approché. Une carte d'une commande (en cours,
    reçue ou annulée) ne se retire pas de la collection, sauf d'un seul de ses Pokémon (`isInAnOrder`,
    `lib/orders.ts` : la fiche d'un Pokémon) ; les règles de la
    collection et des commandes ne modifient jamais ce qu'elles reçoivent (« Annuler » repose
    dessus ; testé). « Effacer ma
    collection » efface les cartes, les collections d'extensions, les statuts et les prix payés ;
    les commandes et le budget restent. Son décompte (`summarize`, Réglages) : les cartes ajoutées
    (sans les cases pas encore obtenues, testé dans `tests/pokedex.test.ts`), possédées, commandées
    (cases comprises) et les collections d'extensions ; une collection qui n'a qu'une extension
    commencée n'est pas vide.
- Deux onglets ouverts : chacun envoie ses modifications à partir de la version qu'il a lue ;
  celle d'un onglet en retard est refusée (409) et il relit celle du serveur, sans rien écraser
  (`store/account.ts`). « Annuler » se lance aussi par Ctrl+Z (⌘Z) tant que son toast est affiché.
- « Annuler » (`useCollectionAction`) rétablit collection et achats d'avant, et refuse si quelque
  chose a changé depuis : une modification ultérieure n'est jamais effacée.
- Retirés à la demande de l'utilisateur, à ne pas réintroduire sans demande : les statuts
  « souhaitée » et « À acheter » d'une carte ; la priorité, le prix maximum et la note d'une
  carte de la liste d'achats.
