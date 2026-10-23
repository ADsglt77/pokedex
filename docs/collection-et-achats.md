# Collection et achats

La collection (statuts, prix payés), la liste d'achats, les commandes et le budget : un document par compte, gardé par le serveur (`docs/compte-et-synchronisation.md`). Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

- Collection : les cartes choisies (`customCards`), un statut par carte (commandée, possédée ;
  sans statut, elle est à débloquer) et le prix payé (`paidPrice`) qui le suit. Son format est
  celui des exports et des documents gardés par le serveur : ne pas le changer. Seuls ses champs connus sont gardés
  à la lecture (`readCollection` : `schemaVersion`, `updatedAt`, `cards` et `customCards` ; de même
  `readShopping` pour les achats). La page Valeur montre ce que les commandes ont coûté en tout
  (« Dépensé en tout »).
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
  - la liste d'achats n'est pas enregistrée : c'est la carte de chaque Pokémon ni possédée ni
    commandée (`wishlistRows`, une TAG TEAM une fois), toutes voulues autant (décision de
    l'utilisateur, octobre 2026 : choisir la carte suffit). Le lien vers Cardmarket est
    `cardmarketPage` : la page notée, sinon l'id. La prochaine commande (`planPurchase`,
    `purchase-planner`) ne lit qu'elle : elle y prend les moins chères d'abord,
    une par Pokémon, dans le budget, port réservé ; on peut en retirer ou en ajouter à la main.
    Après « Enregistrer comme commande », l'assistant repart de ses réglages par défaut (le budget :
    le reste du mois, cette commande comprise) ;
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
    d'un Pokémon hors du Pokédex ou sans clé `image` (« Modifier la carte » planterait), id Cardmarket
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
    `lib/orders.ts` : la fiche d'un Pokémon et celle d'une carte du catalogue) ; les règles de la
    collection et des commandes ne modifient jamais ce qu'elles reçoivent (« Annuler » repose
    dessus ; testé). « Effacer ma
    collection » efface les cartes, leurs statuts et leurs prix payés ; les commandes et le budget
    restent.
- Deux onglets ouverts : chacun envoie ses modifications à partir de la version qu'il a lue ;
  celle d'un onglet en retard est refusée (409) et il relit celle du serveur, sans rien écraser
  (`store/account.ts`). « Annuler » se lance aussi par Ctrl+Z (⌘Z) tant que son toast est affiché.
- « Annuler » (`useCollectionAction`) rétablit collection et achats d'avant, et refuse si quelque
  chose a changé depuis : une modification ultérieure n'est jamais effacée.
- Retirés à la demande de l'utilisateur, à ne pas réintroduire sans demande : les statuts
  « souhaitée » et « À acheter » d'une carte ; la priorité, le prix maximum et la note d'une
  carte de la liste d'achats.
