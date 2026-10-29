# PokéCodex

Un Pokédex personnel de cartes Pokémon japonaises et françaises, en ligne à https://pokecodex.fr :
pour chacun des 1 025 Pokémon, on ajoute les cartes que l'on veut (leur référence, d'où leur image
est retrouvée, et leur id Cardmarket pour suivre leur prix), dont une favorite que montre le
Pokédex ; le Pokémon se débloque dès qu'on en possède une. React + Vite + TypeScript, interface
[`@camply/ui`](https://www.npmjs.com/package/@camply/ui) ; espèces,
cartes, images et prix relus par l'API des données, un dépôt à part (plus bas).

```sh
bun install
bun dev          # Vite et le Worker du site, sur sa base D1 locale (migrée au démarrage)
bun run build    # type-check + build
bun lint         # ESLint, puis knip (code mort : exports, fichiers, dépendances)
bun run contracts # vérifie les types partagés avec ../pokedex-data (Cloudflare construit sans)
bun test         # tests de ce qui coûterait de l'argent (chaque fichier de tests/ le dit en tête)
bun run test:worker # tests du Worker, dans le moteur de Cloudflare (worker/tests)
bun run db:generate # après une modification de worker/schema.ts : sa migration
bun run format   # Prettier
```

- **Accueil** : un tableau de bord (progression, avec celle de chaque collection d'extension,
  « À faire », valeur, budget du mois, liste d'achats, commandes, dernières cartes) ; trois étapes
  pour commencer quand la collection est vide.
- **Recherche** (Ctrl/⌘ K, ou le bouton de la barre) : un Pokémon par son nom ou son numéro, une
  page, une action.
- **Collections** : le Pokédex en première tuile, puis une tuile par extension que vous
  collectionnez en entier (drapeau, logo, nom, cartes possédées sur toutes, valeur) ; « Nouvelle
  collection » en commence une, japonaise ou française (l'interrupteur 🇯🇵 / 🇫🇷) : toutes ses
  cartes, Pokémon, dresseurs et énergies, à débloquer, celles déjà dans votre collection reprises
  telles quelles. Sa page : sa progression, sa valeur, le coût pour la compléter, toutes ses
  cartes (possédées en couleur), chacune avec son statut, son prix payé et son prix ; la supprimer
  garde les cartes possédées et commandées.
- **Pokédex** (depuis Collections) : les 1 025 espèces, recherche (nom fr/en/ja ou numéro,
  raccourci `/`), filtres partageables dans l'adresse.
- **Fiche** : toutes les cartes du Pokémon, choisies parmi ses cartes japonaises ou françaises (un
  interrupteur 🇯🇵 / 🇫🇷 ; image, rareté, prix du jour, tri par date ou par prix, filtres de rareté
  et de type) ou saisies à la main, chacune ajoutée sans en remplacer une autre, puis corrigée ou
  retirée ; sa favorite, celle que montre le Pokédex, marquée et changée d'un bouton (la première
  l'est d'office ; retirer la favorite demande de choisir la suivante) ; en grand, la carte
  choisie dans la liste, son statut (commandée / possédée) et son prix payé, son prix Cardmarket
  et sa courbe, le lien vers sa page Cardmarket, les détails de l'espèce. Le Pokémon est débloqué
  dès qu'une de ses cartes est possédée.
- **Catalogue** : un grand catalogue de toutes les cartes japonaises ou françaises (le même
  interrupteur 🇯🇵 / 🇫🇷, dans l'adresse), Pokémon, dresseurs et énergies, extension par extension
  (choisie sur son logo), en tuiles serrées, avec une recherche et des filtres de rareté et de
  type ; chaque carte a sa fiche (image en grand, numéro, rareté, type, Pokémon, illustrateur, versions, noms anglais et allemand, prix Cardmarket et sa
  courbe) et, pour une carte Pokémon, « Ajouter à la collection » (à acheter, sans remplacer les
  cartes que le Pokémon a déjà, ni changer sa favorite) ; « Commencer la collection » de
  l'extension montrée (ou « Voir ma collection »).
- **Valeur** : prix Cardmarket du jour, valeur de la collection (et gain par rapport au prix
  payé), commandes, dépensé en tout, coût pour compléter le Pokédex ; courbes jour par jour (valeur,
  Pokémon débloqués, dépenses) sur 7 jours, 30 jours, 1 an ou tout, avec leurs chiffres.
- **Achats** : liste d'achats (toutes les cartes voulues, ni possédées ni commandées),
  assistant « prochaine commande » dans un budget (100 € par mois, 150 € au plus, réglables),
  et « Copier pour Cardmarket » : ses cartes en lignes à coller dans votre liste de souhaits
  Cardmarket (« Ajouter une deck list »), en deux blocs, japonaises et françaises, chacune dans sa version exacte, avant son Shopping
  Wizard (langue et état se règlent ensuite par « Modification en masse » ; une carte dont la
  version ou l'extension n'est pas sûre s'ajoute depuis sa page ; le site n'envoie rien à
  Cardmarket) ; registre
  des commandes (Cardmarket, Myutsu, Hikaru…) qui met à jour les statuts, suivi du budget par mois
  et par fournisseur.
- **Comptes** : chacun crée le sien (`/inscription`), un pseudo et un mot de passe, sans e-mail
  (pas de mot de passe oublié) ; le pseudo, le mot de passe et la suppression du compte dans
  Réglages › Compte & partage › Mon compte.
- **Pokédex public** : celui de chaque compte, à son adresse (`/pseudo`, toujours public), en
  lecture seule : progression, régions, valeur au prix du jour, courbe, classeur, puis ses
  collections d'extensions. Jamais les prix payés, les commandes ni le budget. Le reste de
  l'interface demande d'être connecté.
- **Thème** : sombre (gris foncé et jaune) ou clair (blanc pastel et rouge), au bouton de la
  barre ; sans choix, celui du système.
- **Réglages** : trois groupes — compte et Pokédex public, sauvegarde (contenu, export et import,
  achats compris), puis actions avancées. L'état du serveur reste invisible quand tout va bien et
  n'apparaît qu'en cas de retard, d'échec ou d'indisponibilité.

Les données (espèces, catalogue des cartes japonaises et françaises, images, prix Cardmarket et
leur historique) viennent de **l'API des données**, un dépôt à part (`pokedex-data`, un Worker
Cloudflare lui aussi) : privée, sans token aucune donnée. Le navigateur ne parle qu'au site
(`/api/…`, `/images/…`) : le Worker du site renvoie les adresses des données au Worker des
données, par sa liaison de service (ni token ni réseau entre les deux). Aucune adresse de la source n'apparaît dans le navigateur :
les images ont des chemins neutres (`/images/cards/SV2A/166-md.webp`). Le Worker du site
(`worker/`, Hono, Drizzle et D1, sur Cloudflare Workers) garde les comptes et les collections, et
montre les Pokédex publics. Seule une image à l'adresse
collée se charge ailleurs ; pas celles de Cardmarket, qui ne s'affichent que sur son site.

**Les données et les images se lisent sans connexion** (décision de conception) : le Worker du
site les demande pour tout visiteur, connecté ou non. Les routes `/api/species`, `/api/catalog`,
`/api/prices`, `/api/histories`, `/api/wants`, `/api/status`, `/api/health` et `/images/…` répondent
donc à n'importe qui (sous les limites par visiteur du Worker, `worker/limits.ts`, sauf les
espèces et l'état des tâches) ; seule l'interface demande d'être connecté. Ce que la connexion
garde, ce sont les comptes et les collections (`/api/collection`, `/api/auth/…`), pas le
catalogue, les prix ni les scans.

En développement, deux terminaux : l'API des données (`bun run dev` dans `../pokedex-data`, son
Worker sur le port 8787, que remplissent ses tâches ; sa base et ses tâches : son README) et
`bun dev` : Vite, avec le Worker du site dans le moteur de Cloudflare (le plugin
`@cloudflare/vite-plugin`), qui répond à `/api` et joint lui-même le Worker des données (Wrangler
relie les deux). Sa base D1 locale vit dans `.wrangler/` ; `bun dev` lui applique
d'abord les migrations qui manquent (`worker/migrations`). Il faut **Node 22 ou plus** (Wrangler),
et sur un Windows ARM64 **Node ARM64** (Bun reste le gestionnaire de paquets : le plugin ne tourne
pas sous Bun). Un fichier `.env` (ignoré par git), copié de `.env.example` :

```sh
BETTER_AUTH_URL=http://localhost:5173
BETTER_AUTH_SECRET=…        # 32 caractères au moins, pour ce poste seulement
```

Un visiteur arrive sur la connexion ; `/inscription` crée un compte (pseudo, mot de passe). Pseudo
et mot de passe se changent ensuite dans Réglages › Compte & partage › Mon compte, où le compte
se supprime aussi.

Votre collection : le site ne s'ouvre que connecté ; elle n'est gardée que sur le serveur (rien
dans le navigateur, pas d'usage hors ligne) et vous suit d'un appareil à l'autre : un seul
connecté à la fois (se connecter ailleurs déconnecte le précédent). Chaque modification part
aussitôt ; si le serveur ne répond pas, le menu du compte le dit et elle repart à son retour.

**Le journal** : le Worker écrit une ligne par évènement, alignée, à l'heure de Paris : un symbole
de niveau (✔ réussi, • info, ▲ à surveiller, ✖ refusé, en couleur en développement), le thème, un
message court et ses détails en `clé=valeur` (pas les requêtes une à une : seulement ce qui se
passe). Il note les connexions
(réussies ou refusées, avec l'adresse du visiteur), création du compte, pseudo et mot de passe
changés, cartes ajoutées, possédées ou retirées, commandes enregistrées, reçues ou annulées, budget,
exports et imports, visites du Pokédex public, l'API des données muette, et les erreurs
du serveur (avec leur cause). Pour le
suivre : le terminal de `bun dev` ; en ligne, les journaux du Worker chez Cloudflare (Workers
Logs, gardés 7 jours).

## Mise en ligne

Le site est le Worker Cloudflare `pokedex`, à https://pokecodex.fr (`www.pokecodex.fr` y
redirige) ; l'API des données, le Worker `pokedex-data`, à https://api.pokecodex.fr. Chacun a son
domaine personnalisé (`routes` de `wrangler.jsonc`), sans adresse `workers.dev`. **Workers
Builds** (Cloudflare relié aux dépôts GitHub) déploie chacun à chaque push sur `main` de son dépôt.
Pour le site, `bun run ci` construit (`bun test`, `bun run lint:ci`, `bun run test:worker`,
`bun run build` ; un échec arrête là), puis `bun run deploy` applique les migrations à la base D1
en ligne et publie le Worker.
`lint:ci` est le lint sans `../pokedex-data`, que la construction de Cloudflare n'a pas
(`knip.ci.json`). Le guide complet : [docs/deploiement.md](docs/deploiement.md).

Ce que faisaient nginx et Caddy, le Worker le fait lui-même : les en-têtes de sécurité, de cache
et des moteurs de recherche, et la redirection de `www` (`worker/headers.ts`) ; les limites par
visiteur, 429 au-delà (`worker/limits.ts`). Cloudflare compresse les réponses. Le site envoie
`Strict-Transport-Security` avec `includeSubDomains` pour un an : tout navigateur qui l'a reçu
n'ouvre plus, pendant un an, aucun sous-domaine de `pokecodex.fr` en http (un futur `staging.` ou
un service du domaine sans https lui serait inaccessible).

**La surveillance** : `/api/health` est celui de l'API des données (le Worker du site le lui
demande) : 200 quand chaque tâche à rythme a réussi récemment (les prix en 12 h, les espèces en 60
jours) et que le guide des prix n'est pas figé, 503 sinon, avec les tâches en retard. Un service
gratuit (UptimeRobot, Healthchecks…) peut le demander toutes les 5 minutes et vous écrire s'il ne
répond plus 200 : sans surveillance, un trou dans l'historique des prix passerait inaperçu ;
Cardmarket ne le garde pas, un jour manqué l'est pour toujours.

Les tâches d'ingestion (de nouvelles cartes…) : le README de l'API des données.

## Sauvegardes : aucune

Aucune sauvegarde côté serveur (octobre 2026, décision de l'utilisateur) : ni copie de la base, ni
versions remplacées des collections, ni procédure de restauration. Seul reste l'historique de la
base D1 que Cloudflare garde de lui-même, 30 jours (Time Travel) ; une base remise à un instant
passé relève ensuite les numéros des collections (`docs/compte-et-synchronisation.md`). Une base
abîmée ou effacée, vue plus de 30 jours après, perd pour toujours les comptes et les collections.
Seul l'export de chacun (Réglages › Sauvegarde › Exporter) en garde une copie, chez lui.

Les copies de l'ancien système de sauvegarde, envoyées sur un stockage distant, y restent jusqu'à
ce qu'on les supprime (`rclone purge distant:pokedex-sauvegardes`).
