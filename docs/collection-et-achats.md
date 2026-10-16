# Collection et achats

La collection (statuts, prix payés), la liste d'achats, les commandes et le budget, dans le navigateur. Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

- Collection : un statut par carte (possédée, commandée, souhaitée), le prix payé (`paidPrice`) qui
  le suit, et les cartes (`customCards`). Clé `pokedex-collection.collection` : ne pas changer son
  format. Ce qu'une ancienne version y gardait en plus (`entries` des illustrations choisies, clé
  `.settings` des raretés suivies, statuts des cartes `tcgdex:ja:…` de l'ancien index) est ignoré.
- Achats (`/achats`), clé `pokedex-collection.shopping` (`ShoppingData`, à part : la collection
  garde son format) :
  - préférence par carte (`accepted` : dans la liste d'achats ; `excluded`, d'une ancienne
    version, compte comme non décidée), avec priorité, prix maximum, note ; indépendante du statut
    de la carte (le lien vers Cardmarket est `cardmarketPage` : la page notée, sinon l'id) ;
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
    commande s'ouvre en détail (coût réel de chaque carte) ; le registre s'exporte en CSV ;
  - budget calculé depuis les commandes : une commande compte une fois, au mois de sa date d'achat,
    remboursé déduit (jamais plus que la commande), rien si annulée. Au-delà du plafond :
    confirmation, jamais de blocage ; le formulaire montre le mois avec la commande en cours de
    saisie. Les filtres de la liste et les réglages de l'assistant (prochaine commande) sont gardés
    par la page, l'onglet caché étant démonté ; changer d'onglet garde `filtre=sous-max` ;
  - l'export contient `shopping` (un export plus ancien, sans lui, s'importe et garde les achats
    en place). Un import demande toujours confirmation ; un fichier abîmé (enregistrement ou bloc
    d'achats illisible : image, priorité, montant en texte, état de commande, date ou jour qui
    n'existe pas, remboursé plus grand que la commande, commande sans id ou en double, carte d'un
    Pokémon hors du Pokédex, texte qui n'en est pas un, lien…) est refusé (`lib/transfer.ts`). « Effacer ma
    collection » efface aussi la liste d'achats, qui renverrait à des cartes disparues ; les
    commandes et le budget restent.
- Deux onglets ouverts restent d'accord : chacun reprend ce que l'autre enregistre (évènement
  `storage`, `store/persist.ts`, pour les deux clés), sans quoi il l'écraserait ; connectés, ils
  partagent aussi la dernière version échangée avec le serveur. Si le navigateur
  refuse de lire ou d'écrire (stockage plein ou bloqué), l'app continue en mémoire et un bandeau
  (`useStorageFailure`, `AppShell`) invite à exporter.
- « Annuler » (`useCollectionAction`) rétablit collection et achats d'avant, et refuse si quelque
  chose a changé depuis : une modification ultérieure n'est jamais effacée.
