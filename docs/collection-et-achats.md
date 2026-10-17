# Collection et achats

La collection (statuts, prix payés), la liste d'achats, les commandes et le budget, dans le navigateur. Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

- Collection : les cartes choisies (`customCards`), un statut par carte (commandée, possédée ;
  sans statut, elle est à débloquer) et le prix payé (`paidPrice`) qui le suit. Clé
  `pokedex-collection.collection` : ne pas changer son format. Ce qu'une ancienne version y gardait
  en plus (`entries` des illustrations choisies, clé `.settings` des raretés suivies, statuts des
  cartes `tcgdex:ja:…` de l'ancien index) est ignoré ; le statut « souhaitée » (retiré en octobre
  2026 : choisir la carte dit déjà qu'on la veut) se lit comme sans statut, dans le stockage, un
  import ou le document du serveur (`readCollection`), et comme état d'avant d'une ligne de
  commande (`readShopping` : annulée, la carte revient sans statut). La page Valeur montre à sa
  place ce que les commandes ont coûté en tout (« Dépensé en tout »).
- Achats (`/achats`), clé `pokedex-collection.shopping` (`ShoppingData`, à part : la collection
  garde son format ; ceux d'un nouveau venu, aucune commande et le budget par défaut :
  `emptyShopping`, `lib/orders.ts`) :
  - la liste d'achats n'est pas enregistrée : c'est la carte de chaque Pokémon ni possédée ni
    commandée (`wishlistRows`, une TAG TEAM une fois), toutes voulues autant (décision de
    l'utilisateur, octobre 2026 : choisir la carte suffit ; plus de « À acheter » carte par carte, ni
    priorité, ni prix maximum, ni note). L'ancienne liste (`preferences`) est ignorée à la lecture
    (stockage, import, serveur : `readShopping`) et toujours écrite vide, pour qu'une ancienne
    version (un onglet resté ouvert) relise les achats sans les croire abîmés. Le lien vers
    Cardmarket est `cardmarketPage` : la page notée, sinon l'id. La prochaine commande
    (`planPurchase`, `purchase-planner`) ne lit qu'elle : elle y prend les moins chères d'abord,
    une par Pokémon, dans le budget, port réservé ; on peut en retirer ou en ajouter à la main.
    Après « Enregistrer comme commande », l'assistant repart de ses réglages par défaut (le budget :
    le reste du mois, cette commande comprise) ;
  - « Copier pour Cardmarket » (`shopping/WantsDialog`, à côté d'« Enregistrer comme commande… »,
    affiché comme lui dès que la prochaine commande a une carte) en fait des lignes pour la liste de
    souhaits de Cardmarket, que l'utilisateur colle lui-même : l'app n'envoie rien à Cardmarket
    (format, version et extension : `/api/wants`, `docs/prix.md`). La fenêtre « Ajouter à ma liste
    Cardmarket » attend les lignes (« Réessayer » si le serveur ne répond pas), puis donne les
    étapes : sur Cardmarket, ouvrir sa liste de souhaits, « Ajouter une deck list », coller,
    « Ajouter » ; « Modification en masse » : japonais, Near Mint (une ligne ne peut pas les
    porter) ; vérifier le numéro de chaque carte (« Salamèche (sv2a 168) »), puis lancer le
    « Shopping Wizard », qui choisit les vendeurs les moins chers. Les lignes sont dans un champ en
    lecture seule ; « Copier » (`copyText`, `lib/clipboard.ts`, comme l'adresse du Pokédex public)
    dit « N cartes copiées », ou, si le navigateur refuse (hors https aussi), sélectionne les lignes
    et dit de les copier avec Ctrl+C.
    Chaque carte du plan a un prix, donc un id Cardmarket. Une carte sans ligne sûre (version ou
    extension incertaine) est listée à part, avec son lien « Voir sur Cardmarket »
    (`CardmarketLink`) : l'ajouter depuis sa page (« Ajouter à mes souhaits », déjà en japonais,
    Near Mint par le lien). Un message bleu « Informations » de Cardmarket signale une carte ajoutée
    sans sa version : la retirer de la liste et l'ajouter depuis sa page ;
  - commandes : `applyOrder` (`lib/orders.ts`) reporte chaque enregistrement sur la collection (en
    cours → commandée, reçue → possédée, annulée ou supprimée → l'état d'avant, gardé dans
    `OrderLine.previous`, `previousOf`, relu à chaque enregistrement, formulaire comme « Marquer
    reçue » : l'état actuel dès que la carte ne porte plus l'effet de la commande, commande annulée
    ou carte corrigée à la main depuis). Une possession n'est jamais retirée ; une carte qui quitte
    une commande reçue (ligne retirée, commande annulée ou supprimée) reste possédée, sans la date
    ni le prix payé que la commande lui avait donnés : ceux d'une autre commande reçue qui la
    contient (réception, prix de revient), sinon aucun. Le prix payé est le prix de revient (port,
    frais et remboursé répartis au prorata, au centime ; les centimes d'arrondi vont aux lignes
    d'une seule carte, en plusieurs tours, jamais sous 0 €, pour que les prix de revient fassent le
    total). Corriger la date de réception corrige la date d'obtention. Une carte déjà dans une autre
    commande est signalée à la saisie (son prix payé serait remplacé). Une commande en cours depuis
    plus de 28 jours est signalée, aux Achats et à l'accueil (`latePendingOrders`) ; chaque
    commande s'ouvre en détail (coût réel de chaque carte) ;
  - budget calculé depuis les commandes : une commande compte une fois, au mois de sa date d'achat,
    remboursé déduit (jamais plus que la commande), rien si annulée. Au-delà du plafond :
    confirmation, jamais de blocage ; le formulaire montre le mois avec la commande en cours de
    saisie. Les filtres de la liste et les réglages de l'assistant (prochaine commande) sont gardés
    par la page, l'onglet caché étant démonté ;
  - l'export contient `shopping` (un export plus ancien, sans lui, s'importe et garde les achats
    en place). Un import demande toujours confirmation ; un fichier abîmé (enregistrement ou bloc
    d'achats illisible : image, montant en texte, état de commande, date ou jour qui
    n'existe pas, remboursé plus grand que la commande, commande sans id ou en double, carte d'un
    Pokémon hors du Pokédex ou sans clé `image` (« Modifier la carte » planterait), id Cardmarket
    que la saisie refuserait (0, négatif, plus de 9 chiffres…), texte qui n'en est pas un, lien…)
    est refusé (`lib/transfer.ts`), comme par le serveur à la synchronisation. « Effacer ma
    collection » efface les cartes, leurs statuts et leurs prix payés ; les commandes et le budget
    restent.
- Deux onglets ouverts restent d'accord : chacun reprend ce que l'autre enregistre (évènement
  `storage`, `store/persist.ts`, pour les deux clés), sans quoi il l'écraserait ; connectés, ils
  partagent aussi la dernière version échangée avec le serveur. Si le navigateur
  refuse de lire ou d'écrire (stockage plein ou bloqué ; toute lecture passe par `readStored`,
  toute écriture par `writeStored`, sauf le choix du thème), l'app continue en mémoire et un
  bandeau (`useStorageFailure`, `AppShell`) invite à exporter.
- « Annuler » (`useCollectionAction`) rétablit collection et achats d'avant, et refuse si quelque
  chose a changé depuis : une modification ultérieure n'est jamais effacée.
