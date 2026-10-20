# Prix, historique et état des données

Les prix Cardmarket, leur historique, les lignes de la liste de souhaits Cardmarket et l'état des tâches d'ingestion, côté site. Ils viennent de l'API des données (le dépôt `pokedex-data`, sa page `docs/donnees.md` : la règle du prix suivi, l'historique repris, le format des lignes de la liste de souhaits, les tâches). Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

- Cardmarket : seulement ses fichiers publics (guide des prix, liste des produits), lus par l'API
  des données ; ses prix peuvent se montrer sans le citer (son accord). Ni scraping, ni API, ni
  panier.
- Le chemin : le navigateur demande `/api/prices/…`, `/api/histories`, `/api/wants`, `/api/status`
  au site ; nginx (Vite en développement) les renvoie à l'API des données, sous `/v1`, avec le
  token du site (`deploy/nginx.conf.template`, `vite.config.ts`) : le code du site n'en sait rien.
  Les réponses portent leur ETag (304 tant que les prix n'ont pas changé) ; leur forme est celle de
  `src/types.ts`, copie du contrat de l'API (`contract.ts`).
- Prix du jour : l'app demande ceux des seules cartes qu'elle affiche (`GET /api/prices?ids=…` :
  celles de la collection, d'une extension du catalogue, d'un Pokémon, un id saisi ; le jour, et
  une clé par carte demandée, `[prix, plus bas, prix d'il y a 30 jours]` ou `null` sans prix ce
  jour ; 1 025 ids au plus ; 404 tant que le guide n'a jamais été lu). Le prix suivi est la règle de Pokécardex (la tendance pour une série de moins de
  31 jours, la moyenne sur 30 jours ensuite) ; « Ce qui bouge » (Valeur) et la fiche comparent au
  prix d'il y a 30 jours (`priceChange`, `lib/prices.ts`). Côté navigateur (`store/prices.ts`), les
  réponses s'ajoutent : `usePrices()` rend les prix de la collection, `usePrices(ids)` ceux d'autres
  cartes, `null` tant que la réponse de ces cartes n'est pas arrivée ; une carte dont le prix est
  connu n'est pas redemandée (une carte ajoutée : une demande pour elle seule), sauf au retour sur
  une page restée ouverte plus de 6 h, où tout ce qui est affiché est redemandé (`refreshPrices` :
  ceux déjà affichés le restent en attendant). Une demande en panne compte comme une panne
  passagère (« — », jamais « Sans prix »). L'historique d'une carte se charge à la demande
  (`/api/prices/<id>`, 404 sans historique) : la courbe de sa fiche, le nom affiché dans le
  formulaire pour vérifier l'id saisi (au départ du champ). Le Pokédex public d'un compte reçoit
  les prix de ses seules cartes possédées avec sa réponse (`server/vitrine.ts`, qui les demande à
  l'API des données : `docs/compte-et-synchronisation.md`). Sans API des données, ou base encore
  vide, l'app marche sans prix. Une réponse manquante (404) n'est pas redemandée ; après une panne
  passagère (réseau, délai, réponse illisible), elle l'est la fois suivante où elle sert, au plus une
  fois par minute (`getJson`, `lib/api.ts` : la règle vaut pour les données de référence, catalogue
  et historiques compris, sauf l'état des tâches et les lignes de la liste de souhaits, demandés à
  chaque fois : `fetchFresh` ; le compte et la collection ont leurs propres lectures). Une carte
  sans id Cardmarket, ou dont l'id n'a pas de prix ce jour, n'a pas de prix (aucun n'est inventé).
- Historiques de la collection (`GET /api/histories?ids=719621,719654`) : la courbe de la valeur
  (Valeur › Évolution) demande ceux de toutes ses cartes possédées en une fois. Une clé par id
  demandé, son historique ou `null` ; 1 025 ids au plus (avec les ids de 6 et 7 chiffres,
  l'adresse d'une collection complète fait de 7 à 8 Ko, sous les 16 Ko de la ligne de requête que
  nginx accepte, `large_client_header_buffers`) ; 2 demandes par seconde et par visiteur, 10 d'un
  coup au plus (nginx). L'app y met chaque id une fois (`loadPriceHistories`, `store/prices.ts`) et
  relit la réponse dans l'ordre de ses cartes (`historiesOf`, `lib/prices.ts`, testé) : la même
  carte Cardmarket possédée pour deux Pokémon compte deux fois, comme dans la valeur du jour (une
  TAG TEAM, une seule carte, une fois) ; une carte sans id ou sans historique ne pèse pas sur la
  courbe. Seule la réponse de la dernière liste reste en mémoire (`forget`, `lib/api.ts`). Sans
  réponse : « L'historique des prix n'est pas disponible pour le moment ».
- Liste de souhaits Cardmarket (`GET /api/wants?ids=…`) : pour chaque id Cardmarket demandé, sa
  ligne pour « Ajouter une deck list » de la liste de souhaits de Cardmarket (`WantsLines`), ou
  `null` quand aucune ne désignerait sûrement cette carte-là (les règles, testées, et le format
  vérifié par l'utilisateur : `docs/donnees.md` de l'API des données). L'app n'envoie rien à
  Cardmarket : l'utilisateur copie les lignes et les colle lui-même (Achats › Prochaine commande,
  `WantsDialog`, `docs/collection-et-achats.md`), puis lance son « Shopping Wizard ». Ni la langue
  ni l'état ne tiennent dans une ligne : après le collage, l'utilisateur les règle pour toutes avec
  « Modification en masse » de Cardmarket (japonais, Near Mint). 2 demandes par seconde et par
  visiteur au plus (nginx). L'app la demande à chaque ouverture de la fenêtre (`loadWantsLines`,
  par `fetchFresh` : sans cache, 10 s au plus) ; sans réponse, elle propose de réessayer.
- État des données (Réglages › Avancé, `ReferenceSection`) : `/api/status` est demandé à
  chaque ouverture (`loadStatus`, `lib/api.ts`). Aucun panneau n'est affiché quand tout va bien ;
  seuls un retard, un échec, des prix figés ou une absence de réponse produisent une alerte avec
  l'action à tenter. L'état reste calculé par l'API : le site n'a ni la liste des tâches ni leurs
  règles. `/api/health` (la surveillance) : celui de l'API des données.
  Dans le formulaire d'une carte, un id Cardmarket n'est pas mis en doute tant que les prix
  manquent tous.
