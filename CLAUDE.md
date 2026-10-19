# CLAUDE.md

Pokédex personnel de cartes Pokémon **japonaises** : les 1 025 Pokémon, et pour chacun la carte que
l'utilisateur veut, qu'il choisit lui-même : dans le catalogue des cartes japonaises de chaque
Pokémon, ou à la main (sa référence, d'où son image est retrouvée, et son id Cardmarket pour le
prix). Un Pokémon est « débloqué » quand sa
carte est possédée. React 19 + Vite + TypeScript, UI `@camply/ui`, espèces PokéAPI, catalogue et
images Pokécardex, prix Cardmarket : tout passe par le serveur de l'app (Elysia, SQLite,
`server/`), le navigateur ne parle qu'à lui. Chacun crée son compte (Better Auth : pseudo et mot
de passe, sans e-mail) ; connecté, sa collection est synchronisée entre ses appareils ; sans
connexion, on ne voit que la connexion et le Pokédex public de chaque compte (`/pseudo`).

## Commandes

Bun est le gestionnaire de paquets (`bun.lock`) — pas npm/pnpm/yarn.

```sh
bun install
bun dev                # serveur Vite (lancé par Bun, pas par Node : `bun --bun vite`) ; voir « Sous Windows » plus bas
bun run build          # tsc -b + vite build (pas `bun build`)
bun lint               # ESLint, puis knip : à lancer après chaque changement (relancés par le build Docker)
bun run knip           # le code mort seul : exports, fichiers et dépendances sans usage (entrées : knip.json)
bun test               # tests de tests/ (ce qu'ils couvrent : Principes), relancés par le build Docker
bun run format         # Prettier sur src/, server/ et tests/
bun run dev:server     # le serveur de l'app (API, server/index.ts) sur le port 3000 ; `bun dev` lui renvoie /api et /images
bun run ingest catalog # une tâche d'ingestion : catalogue (Pokécardex) → .data/data.db ; `--refresh` relit toutes les séries
bun run ingest prices  # prix du jour (Cardmarket)
bun run ingest species # les espèces (PokéAPI) → .data/data.db : la première tâche à lancer
bun run ingest images  # copie les images (≈ 1,5 Go ; inutile en développement : copiées à la demande) ; aussi `backups`
```

## Principes

- App **volontairement simple** : pas d'abstraction « au cas où », pas de vérification défensive
  dans les fonctions. On ne contrôle que ce qui vient de l'extérieur : le stockage du navigateur
  et le fichier importé (`lib/transfer.ts`), l'adresse (`lib/filters.ts`), ce que l'utilisateur
  saisit (montants, liens, adresse d'image, id Cardmarket). Factoriser quand une logique sert à
  deux endroits ou plus.
- Tests : seulement la logique où une erreur coûte de l'argent (`tests/`, `bun test`) : budget
  (et ses seuils), registre des commandes (doublons compris), la liste d'achats que lit le plan
  (jamais une carte possédée ou commandée, une TAG TEAM une fois) et le plan de la prochaine
  commande, import et montants saisis (un montant mal lu fausserait le budget), id Cardmarket
  saisi, le lien vers Cardmarket (ses offres en japonais, Near Mint au moins : une autre langue,
  ce serait une autre carte achetée), prix d'une carte (le plan le lit : jamais celui d'une
  autre), la ligne d'une carte pour la liste de souhaits Cardmarket (une mauvaise version
  achèterait une autre carte : `tests/wants.test.ts`, ses règles et le SQL de `/api/wants`),
  synchronisation (une erreur écraserait les commandes d'un autre appareil ; la garde du serveur,
  409 pour un envoi parti d'une version dépassée, en avance ou d'un autre document au même numéro,
  une mise à jour, un document refusé, sur le serveur entier : `tests/collection.test.ts`), la
  reprise entre onglets (`persist` : une valeur reprise d'un autre onglet n'est jamais réécrite,
  sans quoi les dernières modifications se perdraient : `tests/persist.test.ts`), retrait d'une
  carte TAG TEAM (son statut et son prix payé restent à ses autres Pokémon) et les règles de la
  collection et des commandes, qui ne modifient jamais ce qu'elles reçoivent (« Annuler ») ; les
  comptes (chacun ne touche qu'à sa collection, qui part avec lui ; ses derniers pseudos quittés
  jamais repris par un autre ; rien d'un autre site) et ce que montre le Pokédex
  public de chacun (ce qu'il laisserait passer serait public ; ses règles et sa route) ;
  et l'historique des prix (`server/history.ts`, irremplaçable : Cardmarket n'en garde pas ; son
  écriture quotidienne, `savePriceGuide` ; sa relecture pour la courbe de la valeur,
  `historiesOf` ; les étapes du schéma, qui gardent les lignes d'une base remplie :
  `tests/schema.test.ts`). Pas de
  tests d'interface. Le build Docker les lance : un test en échec bloque le déploiement. C'est la
  liste de référence : le README et les commandes y renvoient.
- Les cartes viennent de l'utilisateur, une par Pokémon, qu'il **choisit** : aucune détection ni
  classement automatique (l'ancien index TCGplayer et la détection des pleines cartes ont été
  retirés à sa demande). Aides, ajoutées à sa demande : le catalogue des cartes japonaises de
  chaque Pokémon (toutes ses cartes Pokémon, sans sélection par rareté) et leur image, leur rareté
  et leur type (des filtres que l'utilisateur choisit, octobre 2026), le logo japonais de chaque
  série (`logos_jp`, jamais le français), et la page Catalogue, un grand catalogue à part (toutes
  les cartes japonaises, dresseurs et énergies compris, extension par extension, avec tout ce
  qu'on en sait ; sans lien avec le Pokédex, seulement « Ajouter à la collection » : à sa demande,
  octobre 2026), de **Pokécardex**, la seule source des cartes depuis octobre 2026 (à la demande de l'utilisateur : TCGdex et
  TCGplayer retirés). L'accord de Pokécardex (octobre 2026) : lire tout ce qu'on veut sur son site
  (ses pages chiffrent leurs données : on les déchiffre comme son propre JavaScript, avec sa clé
  relue dans ce JavaScript), utiliser ses images à condition de les **héberger chez nous** (jamais
  affichées depuis ses serveurs) ; il vaut aussi pour le site ouvert à tous (confirmé par
  Pokécardex, octobre 2026) ; payé par l'utilisateur (octobre 2026), il ne demande aucun
  crédit : **l'app ne cite aucune source** (crédits de Pokécardex et de PokéAPI retirés à sa
  demande ; le pied de page ne dit que ce que le site n'est pas, `SiteDisclaimer`). Seulement des cartes japonaises (pas les françaises de Pokécardex, son choix). Ne pas
  réintroduire le reste sans demande.
- UI : **`@camply/ui` d'abord** (skill `camply-ui`), en deux thèmes (`styles/theme.css`, à sa
  demande, octobre 2026 ; pas de bleu) : **sombre** par défaut, gris foncé neutre et accent jaune ;
  **clair** (`data-camply-theme="light"` sur `<html>`), blanc pastel chaud et accent rouge. Les tons
  restent distincts de l'accent (sombre : danger corail, avertissement orange ; clair : danger
  cramoisi), l'information est violette. La jauge du budget est `info` tant qu'on est dans le budget, et une
  hausse (`Stat` `delta`) est verte (le ton `success` de camply depuis la 0.3) : l'accent
  y passerait pour une alerte. Le choix (bouton « Thème clair / sombre » de la barre,
  `store/theme.ts`) est gardé dans ce navigateur (`pokedex-collection.theme`, une préférence, pas
  synchronisée) ; sans choix, celui du système, posé avant le premier affichage par
  `public/theme.js` (même règle ; un fichier et pas un script dans la page : la politique de sécurité
  n'accepte que les scripts du site). Les couleurs se changent dans `theme.css`, jamais dans un
  composant (le fond, `--camply-bg`, est aussi la couleur de la barre du navigateur, lue par
  `store/theme.ts` ; ses copies figées, `index.html`, manifeste, `public/theme.js`, y sont
  nommées) ; ce qui diffère d'un thème à l'autre hors camply y a aussi son jeton
  (`--empty-sprite-opacity` : le sprite grisé d'un Pokémon sans carte ; `--dark-icon-filter` : les
  icônes de rareté noires, inversées en sombre ; `--link`
  et `--chart-*` : en clair, liens et courbes à l'encre, liens soulignés de rouge, pour que le
  rouge reste la marque et l'action principale, pas une alerte ; le choix d'un `SegmentedControl`
  y est un bouton blanc en relief). Le logo
  est une Poké Ball plate (`Logo`, `AppShell` ; couleurs `--brand-*`, les mêmes dans les deux
  thèmes), la même que l'icône de l'onglet (`public/favicon.svg`). Un composant maison seulement
  s'il est métier ou absent de la lib.
- Périmètre volontairement réduit : pas d'image téléversée (on colle une adresse), pas de
  comparaison ni de fusion à l'import. Le navigateur ne parle qu'au site lui-même : son API
  (`/api/…` : catalogue, prix) et les images copiées (`/images/…`) ; seule exception, une image à
  l'adresse collée. Les sources (PokéAPI, Pokécardex, Cardmarket) ne sont lues que par les tâches
  d'ingestion du serveur.
- Sources : on peut lire (scraper) n'importe quel site, ou contourner une protection (données
  chiffrées…), mais **toujours demander d'abord à l'utilisateur**, qui obtient l'accord du site ;
  dire précisément quoi (pages, rythme, méthode). Jamais de CAPTCHA ni de défi anti-robot
  (Cloudflare…), même avec un accord. Sources convenues : PokéAPI, Pokécardex (pages et images),
  les fichiers publics de Cardmarket.
- Cardmarket : seulement les fichiers publics (guide des prix, liste des produits) ; leurs prix
  peuvent se montrer sur le site ouvert à tous, sans citer Cardmarket (son accord, octobre 2026). Pas de
  scraping, pas d'API (fermée), pas de panier ni de commande à distance. Un seul lien Cardmarket
  construit : la page d'un produit par son id (`cardmarketPage` :
  `/fr/Pokemon/Products?idProduct=…`, vérifié par l'utilisateur en octobre 2026, le site bloquant
  les robots ;
  `/Products/Singles?idProduct=` ne marche pas). Aucune autre adresse devinée. Chaque lien vers une
  carte (celui de l'id comme une page collée) porte les filtres des offres choisis par
  l'utilisateur (octobre 2026) : `language=7` (japonais) et `minCondition=2` (Near Mint au
  moins), sauf ceux qu'une page collée fixe déjà. La page exacte vient
  d'une adresse collée (« Page Cardmarket » de la saisie). Les images de
  Cardmarket ne s'affichent que sur son site (son serveur refuse les autres) : refusées comme image
  de carte. Liste de souhaits (« Wants ») : des lignes que l'utilisateur copie (Achats › Prochaine
  commande › « Copier pour Cardmarket ») et colle lui-même dans « Ajouter une deck list » de sa
  liste ; l'app n'envoie rien à Cardmarket. Le format vérifié par l'utilisateur (octobre 2026), la
  version `(V.n)` (dans l'ordre des numéros imprimés, pas des ids), l'extension et les cas sans
  ligne : `docs/prix.md` ; jamais une ligne qui pourrait désigner une autre carte (une carte sans
  ligne s'ajoute depuis sa page). Pas de CSV ni de recherches à copier (retirés à la demande de
  l'utilisateur, octobre 2026).
- Textes en français (fr-FR pour nombres et dates), vouvoiement. Un Pokémon dont la carte n'est
  pas possédée est « à débloquer » (pas « manquant », « à trouver » ni « à obtenir »).
- Prettier : pas de point-virgule, guillemets simples, 100 colonnes.

## Architecture

| Dossier | Rôle |
|---|---|
| `src/config/` | Configuration, sans logique : générations, couleurs des types, achats (budget par défaut, fournisseurs, états d'une commande), tâches d'ingestion (`jobs` : leur ordre et leur rythme, lus par le serveur et la page Données), types et raretés des cartes (`catalog`), forme des réponses de l'API (`api` : `API_FORMAT`, à augmenter quand elle change : le cache du service worker et les ETag suivent) |
| `src/lib/` | Les règles **pures**, un domaine par module (son en-tête dit ce qu'il contient), et les seules lectures de l'API et du compte (`api`, `account`, `auth`, `species`, `card-catalog`). Le serveur en importe plusieurs (`transfer` contrôle le document reçu, `card-images`, `cardmarket`, `format`, `time`…) : aucun ne touche au navigateur. `account` se passe du client Better Auth (premier chargement léger) ; `auth`, ce client, n'est chargé que par la connexion, la première visite, Données › Mon compte et la déconnexion |
| `src/store/` | Zustand : `collection` et `shopping` (dans `localStorage`), `document` (les deux ensemble), `prices` (les prix des seules cartes affichées), `sync` (le compte et `/api/collection`), `theme` (une préférence de ce navigateur). `persist` les enregistre et garde les onglets d'accord (une valeur reprise d'un autre onglet n'est jamais réécrite) ; le stockage se lit par `readStored` et s'écrit par `writeStored` (un refus lève le bandeau de la coquille) ; une valeur illisible est mise de côté (`setAsideUnreadable`) |
| `src/hooks/` | Les hooks partagés : `usePokedex` (le modèle de toutes les pages), `useNotify` (toasts et « Annuler », aussi par Ctrl+Z), filtres, saisie d'une carte, export, `useGrowingList` (une longue liste dessinée au fil du défilement), `useFollowLinks` (une longue liste de liens simples, suivie par le routeur)… |
| `src/components/` | Les composants métier partagés par plusieurs pages (cartes, catalogue, classeur du Pokédex, courbes, prix, coquille `AppShell`, compte, budget) et les seuls génériques absents de camply (confirmation, `PageHeader`, `Panel`, lien externe, montants en euros) ; le reste vient de camply |
| `src/pages/` | Une page par route ; les sous-composants d'une page vivent dans son dossier (accueil et Achats : le module CSS d'un composant à côté de lui, celui qu'en partagent plusieurs importé sous le nom `page`) |
| `tests/` | `bun test` (ce qu'ils couvrent : Principes), un fichier par domaine ; `fixtures.ts`, les données d'essai ; `setup.ts` (par `bunfig.toml`, avant le premier fichier) : un dossier de données temporaire, jamais `.data`, et un compte d'essai ; `server.ts`, les bases d'essai. Chaque test pose son propre état : ils passent dans n'importe quel ordre. Types : `tsconfig.tests.json` |
| `server/` | Bun (`tsconfig.server.json`, sans les types du navigateur). `index.ts` lance le serveur ; `app.ts` assemble l'API (Elysia, un plugin par domaine : `reference.ts`, `auth.ts`, `collection.ts`, `vitrine.ts`, `journal.ts` ; paramètres et corps validés par leurs schémas ; 404 et 500 sans corps ; OpenAPI à `/api/docs` en développement). `db.ts` : deux bases SQLite dans `DATA_DIR` (`data.db`, les données de référence ; `app.db`, le compte et la collection), un schéma par étapes, chacune avec son empreinte (une étape ne se modifie jamais après coup). `ingest.ts` lance les tâches de `jobs/` (espèces, catalogue, prix, sauvegardes, images) ; `snapshots.ts` garde les grosses réponses, calculées en fin de tâche, compressées ; `images.ts` copie les images (seulement les chemins de `UPSTREAMS`) ; `history.ts`, l'historique des prix ; `lib/`, le réseau (cache disque, file limitée) et les pages de Pokécardex (déchiffrées, une toutes les 3 s) |

Points à connaître :

Le détail de chaque domaine est dans `docs/` : **le lire avant de toucher à ce domaine**, et le
tenir à jour avec le code.

| Domaine | Page | L'essentiel |
|---|---|---|
| Cartes, catalogue, images | [docs/cartes.md](docs/cartes.md) | Une carte par Pokémon (`manual:<uuid>`), choisie par l'utilisateur : catalogue Pokécardex ou saisie ; images copiées chez nous (`/images/…`), jamais affichées depuis Pokécardex |
| Prix, historique, état des données | [docs/prix.md](docs/prix.md) | Guide public Cardmarket du jour ; l'historique n'existe que relevé par le serveur (Cardmarket n'en garde pas) ; aucun prix inventé ; `/api/histories` : la courbe de la valeur en une demande, relue dans l'ordre des cartes ; `/api/status`, `/api/health` ; `/api/wants` : la version suit l'ordre des numéros imprimés (pas des ids), jamais une ligne qui pourrait désigner une autre carte |
| Collection, achats, commandes, budget | [docs/collection-et-achats.md](docs/collection-et-achats.md) | Clés `pokedex-collection.collection` et `.shopping` : ne pas changer leur format ; `applyOrder` ; une possession n'est jamais retirée ; un import demande toujours confirmation |
| Compte, synchronisation, Pokédex public | [docs/compte-et-synchronisation.md](docs/compte-et-synchronisation.md) | Un compte par personne (pseudo et mot de passe, sans e-mail), une session ; chacun ne touche qu'à sa collection ; un document numéroté, avec son empreinte, `decide` testé, jamais de fusion ; une collection illisible n'est jamais envoyée ; `/pseudo` ne montre jamais un prix payé ni un achat ; les adresses du site sont des pseudos réservés |
| Interface, filtres, performance | [docs/interface.md](docs/interface.md) | Système de design (`global.css`, `theme.css`) ; 1 025 pochettes (`content-visibility`, `settled`) ; filtres dans l'adresse ; courbes jour par jour |
| Déploiement, sauvegardes | [docs/deploiement.md](docs/deploiement.md), README | Docker sur le VPS derrière un tunnel Cloudflare ; conteneurs sans droits d'administrateur ; politique de sécurité du contenu ; **jamais `docker compose down -v`** (les volumes `db` et `backups` sont irremplaçables) |

Pièges du poste de développement :

- Sous Windows, `bun dev` (Vite lancé par Bun) : après une modification de `vite.config.ts`, le
  serveur redémarre mal et n'écoute plus (le relancer) ; et deux écritures très rapprochées d'un
  même fichier (outil, formateur) peuvent lui échapper : il sert alors l'ancienne version (page
  blanche, « … is not defined ») jusqu'à ce que le fichier soit de nouveau enregistré.
- `strict` et `noUncheckedIndexedAccess` sont actifs ; alias `@/` → `src/` (vite.config.ts,
  tsconfig.base.json dont héritent tsconfig.app, .server (le serveur, sans les types du
  navigateur), .tests (les tests) et .node (`vite.config.ts`), et tsconfig.json pour Bun).

## Skills du projet (`.claude/skills/`)

`camply-ui` (écrit pour ce projet), `vercel-react-best-practices`, `vercel-composition-patterns`
(installés via `npx skills`, verrouillés dans `skills-lock.json`).
