# Déploiement

La mise en ligne sur Cloudflare Workers. Une partie de la documentation du projet, à lire avant de
toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

> **En ligne depuis le 29 octobre 2026**, sur l'offre Workers Paid (plus bas, « Pourquoi l'offre
> payante »). Reste l'étape 9 : résilier l'ancien VPS d'OVH.

## Ce qui tourne en ligne

Deux Workers, un par dépôt, déployés par **Workers Builds** (Cloudflare relié aux dépôts GitHub) à
chaque push sur `main`.

| Worker | Dépôt | Adresse | Ce qu'il a |
|---|---|---|---|
| `pokedex-data` | `pokedex-data` | `api.pokecodex.fr` | D1 `pokedex-data` (catalogue, prix, historique, état des tâches), R2 `pokedex-data` (images, grosses réponses), le Workflow `ingest` et son Cron horaire, ses limites par adresse |
| `pokedex` | `pokedex` | `pokecodex.fr` (et `www.`, qui y mène) | D1 `pokecodex` (comptes, collections : **dans l'Union européenne**), les fichiers de l'app (`ASSETS`), le Worker des données par sa liaison de service (`DATA`), ses limites par visiteur |

Le site joint l'API par sa liaison de service, sans réseau ni token : **le Worker des données doit
être en ligne avant celui du site**. Ni l'un ni l'autre n'a d'adresse `workers.dev` (les sessions
n'y marcheraient pas : Better Auth n'accepte que `BETTER_AUTH_URL`).

Qui fait quoi (le détail est dans l'en-tête de chaque fichier) :

| Fichier | Rôle |
|---|---|
| `wrangler.jsonc` (chaque dépôt) | Le Worker : ses liaisons, ses domaines (`routes`), ses limites (`ratelimits`) |
| `package.json` : `ci`, `deploy` (chaque dépôt) | Ce que lance Workers Builds : les contrôles et la construction, puis les migrations de la base et le déploiement |
| `worker/headers.ts`, `worker/limits.ts` (site) | En-têtes de sécurité, cache, moteurs de recherche, `http://` et `www` vers `https://pokecodex.fr`, limites par visiteur |
| `worker/index.ts` (données) | Son entrée d'Internet : lecture seule, en-têtes d'une API, limites, token |
| `knip.ci.json`, `bun run lint:ci` (site) | Le lint sans `../pokedex-data`, que la construction de Cloudflare n'a pas |

## Pourquoi l'offre payante

L'offre gratuite de Workers ne suffit pas aux tâches d'ingestion :

- **le calcul** : 10 ms par demande en gratuit ; une étape des tâches en prend des secondes (le guide
  des prix lu en flux, ses 64 000 cartes) : `limits.cpu_ms` (5 min) n'existe qu'en payant ;
- **D1** : 100 000 lignes écrites par jour en gratuit ; la tâche `prices` en écrit plus du double à
  chaque nouveau guide (les prix du jour, mis de côté puis recopiés, et l'historique de chaque
  carte).

L'offre **Workers Paid** coûte 5 $ par mois, ce qui couvre largement l'usage prévu (R2 : les 10
premiers Go gratuits ; les images en font environ 3). Les mentions légales en dépendent aussi : le
journal gardé 7 jours (Workers Logs) et l'historique de D1 de 30 jours (Time Travel) sont ceux de
l'offre payante (3 et 7 jours en gratuit).

## Une fois : la mise en ligne

Les étapes marquées **(vous)** demandent votre compte, un achat ou un registraire : à faire par
vous. Les autres sont des commandes, à lancer dans le dossier du dépôt indiqué.

1. **(vous) Le compte Cloudflare et l'offre Workers Paid** : tableau de bord › Workers & Pages ›
   Plans.
2. **(vous) Le domaine sur Cloudflare** : tableau de bord › Add a domain › `pokecodex.fr` (l'offre
   gratuite du domaine suffit). Cloudflare recopie les enregistrements DNS actuels : vérifier
   qu'il garde ceux de la messagerie de `contact@pokecodex.fr` (MX, SPF, DKIM : sans eux, plus
   aucun e-mail n'arrive), et **supprimer** ceux de `pokecodex.fr`, `www` et `api` qui mènent au
   VPS (`15.235.90.246`) : les domaines des Workers ne s'ajoutent pas par-dessus. Chez OVH, si
   DNSSEC est actif sur le domaine, le désactiver d'abord (sinon le domaine ne répond plus du tout
   pendant la bascule ; il se réactive ensuite avec Cloudflare). Puis (Noms de domaine ›
   `pokecodex.fr` › Serveurs DNS) remplacer ses serveurs par les deux que donne Cloudflare, et
   attendre que Cloudflare dise le domaine actif (de quelques minutes à un jour).
3. **(vous) Wrangler relié au compte**, une fois sur ce poste :

   ```bash
   npx wrangler login
   ```

4. **Les bases et le bucket**, une fois. Chaque commande `d1 create` affiche l'identifiant de la
   base (`database_id`) : le recopier dans le `wrangler.jsonc` de son dépôt, à côté de son
   `database_name`, puis commiter.

   Dans `pokedex-data` :

   ```bash
   npx wrangler d1 create pokedex-data
   ```

   ```bash
   npx wrangler r2 bucket create pokedex-data
   ```

   Dans `pokedex` (les comptes, gardés dans l'Union européenne, ce que disent les mentions
   légales : `src/config/legal.ts`) :

   ```bash
   npx wrangler d1 create pokecodex --jurisdiction eu
   ```

5. **(vous) Workers Builds**, pour chaque dépôt, **`pokedex-data` d'abord** : tableau de bord ›
   Workers & Pages › Create › Import a repository (Cloudflare installe alors son application
   GitHub sur le dépôt), puis :
   - le nom du projet : celui du Worker et du dépôt (`pokedex-data`, puis `pokedex`), comme dans son
     `wrangler.jsonc` ;
   - la branche : `main` ;
   - la commande de construction : `bun run ci` ; celle de déploiement : `bun run deploy` ;
   - les variables de **construction** (Settings › Builds › Variables and secrets, pas celles
     d'exécution du Worker) : `NODE_VERSION` = `24` (Wrangler et Vitest veulent Node 22 ou plus) et
     `BUN_VERSION` = `1.3.10`.

   L'import crée le Worker, vide, et lance la première construction, qui le déploie. Si la
   migration de la base échoue faute de droits, donner « D1 : Edit » au token de construction
   (Settings › Builds › API token). Le nom du Worker est celui du tableau de bord : un autre nom
   dans `wrangler.jsonc` est remplacé en construction (Cloudflare propose alors de le corriger).
6. **Les secrets**, une fois le Worker créé par l'import (avant, Wrangler en créerait un du même
   nom, et l'import buterait sur lui). Le site : la clé des sessions, tirée au hasard, jamais celle
   de `.env`, dans `pokedex`. Sa première construction échoue sans elle (le Worker la vérifie au
   démarrage, `worker/auth.ts`) : la poser, puis relancer la construction (Deployments › le build
   › Retry) :

   ```bash
   openssl rand -hex 32 | npx wrangler secret put BETTER_AUTH_SECRET
   ```

   L'API, pour ses clients autres que le site (facultatif : sans lui, seul le site la lit), dans
   `pokedex-data`, au format `nom:token,…` (son README) :

   ```bash
   npx wrangler secret put API_TOKENS
   ```

7. **Les données**, dès que le Worker des données est en ligne, le jour même : son Cron lance les
   prix à l'heure suivante ; sans le catalogue, ce passage ne sait pas quelles séries sont
   récentes (leur prix est la tendance : `../pokedex-data/docs/donnees.md`), et un passage des
   prix du même jour, après le catalogue, corrige ce jour-là. Les tâches relisent tout elles-mêmes
   (environ deux jours, au rythme convenu avec Pokécardex), dans `pokedex-data` :

   ```bash
   bun run ingest setup --remote
   ```

   L'avancée se suit dans le tableau de bord (Workflows › `ingest` › le passage : chaque étape et
   son état), au terminal (`npx wrangler workflows instances list ingest`, puis
   `npx wrangler workflows instances describe ingest <id>`) et dans le journal
   (`npx wrangler tail pokedex-data`). La page Réglages du site, elle, ne montre que les tâches en
   retard ou en échec. Ensuite, le Cron tient les prix et les espèces à jour tout seul ; les
   nouvelles cartes : `bun run ingest cards --remote`.
8. **Vérifier** : `https://pokecodex.fr` (créer un compte, enregistrer une carte) et
   `https://api.pokecodex.fr/v1/health` (200 une fois les tâches à rythme passées).
9. **(vous) L'ancien VPS** : une fois le site vérifié, l'arrêter et le résilier chez OVH. Rien n'est
   à en reprendre (aucun utilisateur ; les données se relisent).

## Au quotidien

- **Un push sur `main`** : Workers Builds lance `bun run ci` (tests, lint, types, construction),
  puis, s'ils passent, `bun run deploy` : les migrations de la base d'abord, puis le nouveau code.
  Un contrôle en échec : rien n'est déployé, la version d'avant continue. Le résultat s'affiche sur
  le commit dans GitHub et dans le tableau de bord.
- **Les deux dépôts se déploient chacun de leur côté** : un changement de l'API que le site attend
  (le contrat : `bun run contracts`) se pousse d'abord dans `pokedex-data`.
- **Le journal** : tableau de bord › le Worker › Logs (7 jours), ou en direct :

  ```bash
  npx wrangler tail pokedex
  ```

- **Revenir en arrière** : tableau de bord › le Worker › Deployments › Rollback (le code seulement :
  une migration de la base ne se défait pas ; d'où des migrations qui n'effacent rien d'utile).
- **Réparer la base après une erreur** (pas une sauvegarde : aucune n'est gardée, décision de
  l'utilisateur) : D1 garde son historique 30 jours (Time Travel), `npx wrangler d1 time-travel
  restore`. Pour celle du site, relever ensuite les numéros des collections (`UPDATE collections
  SET version = version + <Date.now()>`) : sans cela, un appareil qui garde un numéro plus récent
  que la base remise écraserait ou perdrait des changements (`docs/compte-et-synchronisation.md`).

## En développement

`bun run dev` dans `pokedex-data`, puis `bun dev` ici (`README.md`). Les deux Workers tournent en
local dans le moteur de Cloudflare, chacun sa D1 et son R2 dans `.wrangler/`, reliés par Wrangler ;
la CSP n'y est pas posée (Vite écrit ses propres scripts dans la page).
