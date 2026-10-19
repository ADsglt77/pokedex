# CLAUDE.md

Pokédex personnel de cartes Pokémon **japonaises** : les 1 025 Pokémon, et pour chacun la carte que
l'utilisateur choisit lui-même (dans le catalogue des cartes japonaises, ou à la main : sa
référence, d'où son image est retrouvée, et son id Cardmarket pour le prix). Un Pokémon est
« débloqué » quand sa carte est possédée. Chacun crée son compte (pseudo et mot de passe, sans
e-mail) ; sans connexion, on ne voit que la connexion et le Pokédex public de chaque compte
(`/pseudo`).

- **Site** (ce dépôt) : React 19, Vite, TypeScript, `@camply/ui`, zustand, react-router. Le serveur
  de l'app (`server/` : Bun, Elysia, Better Auth, SQLite `app.db`) garde les comptes et **la
  collection, sur le serveur seul** (rien dans le navigateur sauf le thème, pas de hors-ligne).
- **API des données** (dépôt `../pokedex-data`, privée, un token) : espèces, catalogue, images,
  prix Cardmarket et leur historique. nginx (Vite en développement) la joint avec le token du site ;
  le navigateur ne parle qu'au site, aux adresses `/api/…` et `/images/…`.

## Commandes

Bun est le gestionnaire de paquets (`bun.lock`) — pas npm/pnpm/yarn.

```sh
bun install
bun dev                # Vite (`bun --bun vite`) ; renvoie les données à l'API (3001) et le reste de /api au serveur (3000)
bun run dev:server     # le serveur de l'app, port 3000
bun run build          # tsc -b + vite build (pas `bun build`)
bun lint               # ESLint, puis knip (code mort) : après chaque changement
bun test               # tests de tests/ (ce qu'ils couvrent : Principes)
bun run format         # Prettier sur src/, server/ et tests/
```

L'API des données se lance à côté (`bun run dev` dans `../pokedex-data`) ; le site a besoin du même
token qu'elle (`DATA_API_TOKEN` dans `.env`, `pokedex:<token>` dans son `API_TOKENS`).

## Principes

- **Volontairement simple** : pas d'abstraction « au cas où », pas de vérification défensive dans
  les fonctions. On ne contrôle que ce qui vient de l'extérieur : le fichier importé et le document
  reçu par le serveur (`lib/transfer.ts`), l'adresse (`lib/filters.ts`), ce que l'utilisateur
  saisit. Factoriser quand une logique sert à deux endroits ou plus.
- **Tests** (`tests/`, lancés par le build Docker : un échec bloque le déploiement), seulement où
  une erreur coûte : budget et ses seuils, registre des commandes, liste d'achats et plan de la
  prochaine commande, import et montants saisis, id Cardmarket saisi, lien vers Cardmarket (offres
  en japonais, Near Mint au moins), prix d'une carte (jamais celui d'une autre), relecture des
  historiques (`historiesOf`), règles de la collection et des commandes (qui ne modifient jamais ce
  qu'elles reçoivent, « Annuler » ; retrait d'une carte TAG TEAM), la garde du serveur sur la
  collection (409 pour un envoi parti d'une autre version, document refusé, chacun son compte,
  pseudos quittés jamais repris, rien d'un autre site : `tests/collection.test.ts`), ce que montre
  le Pokédex public (jamais un prix payé ni un achat ; ses prix demandés à une fausse API), les
  étapes du schéma. Pas de tests d'interface. Les prix, l'historique et la liste de souhaits sont
  testés dans l'API des données.
- **Les cartes, c'est l'utilisateur qui les choisit** : aucune détection ni classement automatique.
  Aides demandées : le catalogue des cartes japonaises de chaque Pokémon (sans sélection par
  rareté), leurs filtres de rareté et de type, le logo japonais de chaque série (jamais le
  français), et la page Catalogue (toutes les cartes, extension par extension, seulement « Ajouter
  à la collection »). **Pokécardex** est la seule source des cartes (octobre 2026 : TCGdex et
  TCGplayer retirés) ; son accord : lire son site, utiliser ses images **hébergées chez nous**
  (jamais affichées depuis ses serveurs : `isSourceImage`), reprendre son historique des prix ;
  aucun crédit demandé : **l'app ne cite aucune source** (le pied de page ne dit que ce que le site
  n'est pas, `SiteDisclaimer`). Seulement des cartes japonaises. Ne pas réintroduire le reste sans
  demande.
- **Anonyme** : rien de ce que voit le navigateur ne nomme une source (chemins d'images neutres,
  `/images/cards/SV2A/166-md.webp` ; le token jamais côté navigateur).
- **Sources** : on peut lire n'importe quel site, ou contourner une protection (données
  chiffrées…), mais **toujours demander d'abord à l'utilisateur**, qui obtient l'accord du site ;
  jamais de CAPTCHA ni de défi anti-robot. Toutes les lectures sont dans l'API des données.
- **Cardmarket** : seulement ses fichiers publics (guide des prix, liste des produits ; ses prix
  peuvent se montrer sans le citer, son accord). Pas de scraping, pas d'API, pas de panier. Un seul
  lien construit : la page d'un produit par son id (`cardmarketPage` :
  `/fr/Pokemon/Products?idProduct=…`, vérifié par l'utilisateur ; `/Products/Singles?idProduct=`
  ne marche pas), avec les filtres des offres `language=7` et `minCondition=2` (sauf ceux qu'une
  page collée fixe déjà). Ses images ne s'affichent que sur son site : refusées. Liste de
  souhaits : des lignes que l'utilisateur copie (Achats › Prochaine commande) et colle lui-même ;
  jamais une ligne qui pourrait désigner une autre carte (règles : `docs/donnees.md` de l'API). Pas
  de CSV.
- **UI** : `@camply/ui` d'abord (skill `camply-ui`) ; un composant maison seulement s'il est métier
  ou absent de la lib. Deux thèmes (`styles/theme.css`, pas de bleu) : sombre par défaut (gris
  foncé, accent jaune), clair (blanc pastel chaud, accent rouge). Les couleurs se changent dans
  `theme.css`, jamais dans un composant (détails : `docs/interface.md`).
- **Périmètre réduit** : pas d'image téléversée (on colle une adresse), pas de fusion à l'import.
- Textes en français (fr-FR), vouvoiement ; un Pokémon sans sa carte possédée est « à débloquer ».
- Prettier : pas de point-virgule, guillemets simples, 100 colonnes.

## Architecture

| Dossier | Rôle |
|---|---|
| `src/config/` | Configuration sans logique (générations, types, achats, compte, types de cartes) |
| `src/lib/` | Règles **pures**, un domaine par module (son en-tête dit ce qu'il contient), et les lectures de l'API (`api`, `account`, `species`, `card-catalog`). Le serveur en importe plusieurs (`transfer`, `format`, `time`…) |
| `src/store/` | Zustand : `collection`, `shopping`, `document` (les deux ensemble), `account` (le compte, la collection lue sur le serveur et chaque modification envoyée), `prices`, `theme` |
| `src/hooks/`, `src/components/`, `src/pages/` | Hooks partagés ; composants métier et génériques absents de camply ; une page par route, ses sous-composants dans son dossier |
| `server/` | `index.ts` lance le serveur ; `app.ts` assemble l'API (Elysia : `auth.ts`, `collection.ts`, `vitrine.ts`, `journal.ts`) ; `db.ts` (`app.db`, schéma par étapes avec empreintes) ; `backups.ts` (sauvegarde quotidienne) |
| `tests/` | `bun test` ; `setup.ts` : un dossier de données temporaire, jamais `.data` |

Le détail de chaque domaine est dans `docs/` : **le lire avant d'y toucher**, et le tenir à jour.

| Domaine | Page |
|---|---|
| Cartes, catalogue, images | [docs/cartes.md](docs/cartes.md) |
| Prix, historique, état des données (côté site) | [docs/prix.md](docs/prix.md) |
| Collection, achats, commandes, budget | [docs/collection-et-achats.md](docs/collection-et-achats.md) |
| Compte, collection sur le serveur, Pokédex public | [docs/compte-et-synchronisation.md](docs/compte-et-synchronisation.md) |
| Interface, filtres, performance | [docs/interface.md](docs/interface.md) |
| Déploiement, sauvegardes (**jamais `docker compose down -v`**) | [docs/deploiement.md](docs/deploiement.md), README |

Pièges du poste de développement :

- Sous Windows, `bun dev` : après une modification de `vite.config.ts`, le serveur redémarre mal
  (le relancer) ; deux écritures très rapprochées d'un même fichier peuvent lui échapper (page
  blanche) jusqu'à ce que le fichier soit de nouveau enregistré.
- `strict` et `noUncheckedIndexedAccess` actifs ; alias `@/` → `src/`.

## Skills du projet (`.claude/skills/`)

`camply-ui` (écrit pour ce projet), `vercel-react-best-practices`, `vercel-composition-patterns`.
