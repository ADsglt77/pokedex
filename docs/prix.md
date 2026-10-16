# Prix, historique et état des données

Les prix Cardmarket, leur historique relevé par le serveur, et l'état des tâches d'ingestion. Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

- Prix (`server/jobs/prices.ts`, tâche `prices`) : le guide des prix public de Cardmarket et sa
  liste des produits (pour les noms), seulement les cartes à l'unité (catégorie 51), dans
  `data.db` : le prix du jour de chaque carte (`cardmarket_prices` : prix, plus bas, moyenne 30
  jours, par id Cardmarket) et son historique (`cardmarket_history` : Cardmarket n'en garde pas ;
  une ligne par carte et par année, à partir de son premier jour avec un prix, `server/history.ts` ;
  relancée le même jour, la tâche remplace le prix du jour ; moins de la moitié des prix d'avant :
  format du guide changé, rien n'est écrit, la tâche échoue). Rien n'est retéléchargé (29 Mo) tant
  que le guide n'a pas changé (`sources` : son `Last-Modified`). En fin de tâche, même quand le guide n'a pas changé, la réponse de
  `/api/prices` (le fichier des prix : jour et cartes ; 404 tant que le guide n'a jamais été lu) est
  calculée et gardée compressée (`snapshots`, avec un ETag : 304 si le navigateur
  l'a déjà). L'app la charge au premier écran qui affiche un prix (l'accueil, pour sa valeur ;
  pas le Pokédex), et l'historique d'une carte à la demande (`/api/prices/<id>`) : la courbe,
  le nom affiché dans le formulaire pour vérifier l'id saisi (au départ du champ). Sans serveur,
  ou base encore vide, l'app marche sans prix. Une réponse manquante (404) n'est pas redemandée ;
  après une panne passagère (réseau, délai, réponse illisible), elle l'est la fois suivante où elle
  sert, au plus une fois par minute (`getJson`, `lib/api.ts` : la règle vaut pour toute lecture de
  l'API, catalogue et historiques compris). Une carte sans id Cardmarket, ou dont
  l'id n'a pas de prix ce jour, n'a pas de prix (aucun n'est inventé ; Pokécardex donne l'id de presque toutes).
  L'ancien historique (les fichiers du volume `prices`,
  un par carte) est repris au premier démarrage d'`ingest` (`legacy-prices.ts`), vérifié avant
  d'être gardé : nombre de cartes, somme des prix, échantillon relu tel que l'API le sert.
- État des données (page Données › Sources des données, `ReferenceSection`) : où en est chaque
  tâche d'ingestion, d'après son journal (`/api/status` : dernière réussite, dernier passage, et le
  jour des prix en base), demandé à chaque ouverture de la page. À jour ; en retard (deux
  intervalles sans réussite, `INGEST_JOBS` de `config/jobs.ts`, que suit aussi `ingest.ts`) ; en
  échec (le dernier passage) ; à lancer (jamais passée : la commande est donnée), sauf les images,
  facultatives (le serveur copie à la demande celles affichées). Sans réponse : « l'état des
  données est inconnu ». Dans le formulaire d'une carte, un id Cardmarket n'est pas mis en doute
  tant que les prix manquent tous.
