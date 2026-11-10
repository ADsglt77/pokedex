# Audit de pokedex-data — 9 novembre 2026

**Périmètre** : le Worker des données (`pokedex-data/worker/`, environ 3 800 lignes hors tests).
- Hono, D1, R2, le Cron horaire et le Workflow `ingest`.
- Les cinq tâches d'ingestion : espèces, catalogue, images, prix, historique.
- Le cache HTTP, la sécurité et les performances.
- Les contrats avec le site `pokedex`.

**Méthode**
- **Contrôles locaux** :
  - `bun run test` (Vitest dans workerd) : 123 tests réussis sur 123, 11 fichiers, 13,8 s ;
  - `bun run typecheck`, `bun run lint` (ESLint et knip) : sans erreur ;
  - `bun run contracts` côté site : sans erreur.
- **Relecture** de l'entrée du Worker, des tokens, des limites, du Workflow, des passages, des
  prix, de l'historique et de l'état des tâches.
- **Quatre agents d'audit en lecture seule** : sécurité, fiabilité (reprises, idempotence,
  intégrité), performances, contrats avec le site.
- **Vérification** : chaque constat repris ici a été revérifié à la ligne citée, et reproduit en
  local quand c'était possible.
- **Volumes de la D1 locale** (lus sur une copie, en lecture seule) : 695 séries (445 japonaises,
  250 françaises), 54 103 cartes, 63 975 prix du jour.

**Rien n'a été modifié ni lancé** : aucune ingestion, même locale (elle interrogerait les sources),
aucun `wrangler` distant, aucune requête vers la production. Les constats de
`docs/audit-2026-11.md` déjà corrigés ne sont pas repris.

## En bref

- **Rien de critique ni d'élevé.** Le fond est sain :
  - un seul passage à la fois (`startRun`, d'un seul tenant) ;
  - l'historique écrit année par année, seulement si personne n'y a touché ;
  - les prix du jour remplacés d'un seul tenant ;
  - des étapes rejouables sans double effet ;
  - aucun accès sans token, aucune injection, aucune source nommée.
- **SEC-04 : confirmé, toujours ouvert** (`worker/limits.ts:18`), la décision DEC-12 n'est pas
  tranchée. Sans token, son effet est négligeable. Avec un token, ou un token qui a fui,
  `/v1/wants` devient sans plafond. Correction : la clé /64, et mieux, les routes lourdes comptées
  par client.
- **Le risque réel de perte de données (moyen), FIA-01** : un guide des prix tronqué chez la source
  serait accepté. Un tiers des cartes perdrait alors son point du jour pour toujours. La correction
  tient en une ligne.
- **Au prochain changement (moyen)** :
  - INTEG-01 : une génération ajoutée d'un seul côté fait planter le Pokédex du site ;
  - INTEG-02 : `FORMAT` ne protège pas les réponses gardées dans R2 ;
  - FIA-02 : les étapes longues gardent le délai de 10 min de Cloudflare.
- **Tests (moyen)** : le Workflow lui-même et le conflit d'écriture côté `history` ne sont pas
  testés.
- **Performances** : deux logos français envoient 3 Mo de métadonnées XMP (vérifié), et les
  illustrations en PNG pèseraient 81 % de moins en WebP. Aucun coût au-delà de l'abonnement.
- **Environnement local** : votre Worker des données sur 8787 n'est pas migré (0000 et 0001
  seulement) et répond 301 vers lui-même. Il faut le relancer avec `bun run dev`.

## Reprises, idempotence et intégrité de l'ingestion

### FIA-01 — Un guide des prix tronqué est accepté comme complet (moyen)
- **Où** : `worker/ingest/json-stream.ts:20-62`. La boucle s'arrête quand le flux s'arrête, et
  `return rest` (`:62`) part même si `state === 'inside'`, c'est-à-dire si le `]` n'a jamais été
  lu. Ensuite :
  - `prices.ts:109` trouve `createdAt`, placé avant le tableau, dans `rest` ;
  - `:202` : la règle de la moitié laisse passer un guide coupé à plus de 50 % ;
  - `:227-235` : les prix du jour sont remplacés et `sources` noté.
- **Preuve** : relu à la ligne. L'agent l'a reproduit sur une copie du module : un document de 10
  objets coupé avant le 8e, flux fermé proprement, rend 7 objets et `createdAt` sans erreur.
- **Scénario** : le guide arrive coupé à 70 %.
  1. Les 30 % de cartes restantes perdent leur prix du jour et leur point du jour dans
     l'historique.
  2. `sources.stamp` est noté : les passages suivants disent « Guide des prix inchangé »
     (`prices.ts:129`) jusqu'au guide suivant.
  3. Ce jour-là manque pour toujours à leur historique.
  4. La liste des produits, coupée de même, retire leur extension aux produits manquants.
- **Déclencheur** : un fichier déjà tronqué chez la source (une coupure réseau, elle, lève une
  erreur dans workerd). Plausible, non observé.
- **Correction**, après la boucle de `streamArray` :
  `if (state !== 'after') throw new Error(\`${key} : document tronqué\`)`.
  - Le guide fait alors échouer la tâche, que le Cron relance.
  - Une liste tronquée passe par le chemin « illisible » (`prices.ts:137-140`), qui garde
    l'ancienne.
  - Test : le même document coupé est refusé.

### FIA-02 — Les étapes longues gardent le délai par défaut de 10 min par essai (moyen, plausible)
- **Où** : `worker/ingest/workflow.ts:53`, `RETRIES = { retries: { limit: 2, … } }`, sans
  `timeout`. D'après la documentation de Cloudflare (Workflows › Sleeping and retrying), le délai
  par défaut d'un essai est de « 10 minutes ».
- **Preuve** : la seule étape de `prices` télécharge le guide (16 Mo) et la liste (14 Mo), puis
  écrit environ 64 000 prix et années par paquets de 200 (`prices.ts:223-226`). L'audit du
  2 novembre l'a mesurée à 4 à 6 min (DATA-01).
- **Effet** :
  - une source lente fait dépasser 10 min : l'étape est réessayée deux fois, puis la tâche
    échoue ;
  - si l'essai coupé continue d'écrire pendant que le suivant commence (non vérifié), les deux
    partagent la table `cardmarket_prices_next`.
- **Correction** : `timeout: '30 minutes'` dans `RETRIES` (le signe de vie, lui, reste à 5 min).
  Ou découper l'étape des prix en deux : lecture, puis écriture.

### FIA-03 — Le Workflow lui-même n'a aucun test (moyen)
- **Où** : `worker/ingest/workflow.ts:57-102`. Aucun test n'importe `Ingest`, seulement le type
  `Step` (`catalog-run.test.ts:14`, `history-run.test.ts:17`, `images.test.ts:23`).
- **Effet** : retirer `await beat(id)` (`:76`), inverser `< MINUTE` (`:79`), retirer
  `finishRun(id, reason)` (`:97`) ou changer `continue` en `break` (`:71`) ne fait échouer aucun
  test. Sans `beat`, par exemple :
  1. les étapes courtes du catalogue ne donnent plus de signe de vie ;
  2. au bout de 5 min, le passage est tenu pour arrêté ;
  3. un `history` lancé à la main démarre en même temps : le rythme convenu avec Pokécardex
     double.
- **Correction** : un `workflow.test.ts` qui fait tourner `Ingest.run` avec une fausse étape.
  Exemple : `prices` lève une erreur après `alive()`, `species` réussit. Attendu : `prices` avec
  `ok = 0` et son message, `species` avec `ok = 1`, et `alive_at` noté.

### FIA-04 — Le cas « `prices` écrit pendant la reprise de l'historique » n'est pas testé côté `history` (moyen)
- **Où** : `worker/ingest/history.ts:102`
  (`if (writes.length && unwritten(…).length) continue`). `history.test.ts` n'épie pas
  `readYears`, contrairement à `prices.test.ts`, qui couvre le cas symétrique.
- **Effet** : une refonte qui ignorerait `unwritten` ici passerait les tests. Les jours repris ne
  seraient pas écrits, la carte serait pourtant notée lue (`history_imports`, `:205`) et jamais
  relue : ses 180 jours seraient perdus.
- **Correction** : épier `readYears` comme `prices.test.ts:27-33`, écrire un prix du jour entre la
  lecture et l'écriture, puis vérifier que les deux restent.

### FIA-05 — Les prix repartent toutes les 7 h et non toutes les 6, et 1 h après un échec et non 10 min (faible)
- **Où** : `worker/ingest/runs.ts:80`
  (`Date.now() - Date.parse(last.finishedAt) >= wait`), `src/config/jobs.ts:27`
  (`every: 6 * HOUR`) et le Cron `0 * * * *`.
- **Preuve** : un passage fini à 07:00:20 n'est pas dû à 13:00 (5 h 59), il repart à 14:00. Après
  un échec, les 10, 20 et 40 min deviennent 1 h, 1 h et 1 h.
- **Effet** : aucun jour perdu (7 h, c'est moins que 24 h), mais ni la décision (« toutes les
  6 h ») ni la doc ne décrivent ce qui se passe réellement.
- **Correction** : mesurer depuis `started_at`, ou retirer une marge de 10 min à l'attente. Test :
  « réussi il y a 5 h 59 : dû ».

### FIA-06 — Rejouée, l'étape « début » est bloquée par son propre passage (faible)
- **Où** : `worker/ingest/workflow.ts:61-71`, `runs.ts:27-43`. Cette étape a les réglages par
  défaut (5 essais).
- **Scénario** (déduit du code ; Workflows garantit une exécution au moins, pas une seule) :
  1. `startRun` écrit son passage, puis la réponse se perd.
  2. Rejouée, l'étape trouve ce passage en vie et rend `null` : « Tâche déjà en cours ».
  3. La tâche est sautée, et le passage orphelin est noté interrompu 5 min plus tard.
- **Effet** : pour une tâche à la demande, `/v1/status` dit « failed » jusqu'au prochain
  lancement ; pour `prices`, le Cron rattrape une heure après.
- **Même famille** : rejouée, l'étape d'une série du catalogue recompte les cartes déplacées
  après que le premier essai a remis leur `image` à `NULL` (`catalog.ts:361-366`, `:454`). Seule
  la ligne de journal « Série renumérotée » se perd.
- **Correction** :
  - une colonne `instance` dans `runs` (`ALTER TABLE … ADD`, sans reconstruction) ;
  - `startRun(job, event.instanceId)` rend d'abord le passage ouvert de cette instance ;
  - test : deux appels avec la même instance rendent le même id, une autre instance reçoit
    `null`.

### Vérifié sans défaut
- **Exclusion des passages** : `startRun`, d'un seul tenant (`batch`), testé.
- **Deux tâches sur la même année** : `INSERT … ON CONFLICT DO NOTHING` puis
  `UPDATE … WHERE prices = old`, testés des deux côtés.
- **Prix du jour** : remplacés d'un seul tenant depuis `cardmarket_prices_next`. Arrêtée en
  route, la tâche n'a rien changé ; relancée, elle refait l'historique à l'identique (testé).
- **Aucun prix inventé** :
  - une carte sans prix ce jour n'est pas écrite (`prices.ts:196`) ;
  - `mainHistory` vérifie le produit (`history.ts:48-49`) ;
  - `withPrice` complète une année sans rien retirer.
- **Format changé** : un guide avec moins de la moitié des prix d'avant fait échouer la tâche sans
  rien écrire. Des pages d'historique sans données ne font noter aucune carte comme lue
  (`formatChanged`).
- **Limite d'étapes des Workflows** : 10 000 par passage sur l'offre payante (25 000 au plus
  configurables). Un `setup` complet en compte de 2 000 à 2 900.

## Contrats avec le site

Aujourd'hui, rien ne casse. L'agent a lu les réponses réelles par le site local, à travers `DATA`,
et elles suivent le contrat champ par champ :
- espèces et leurs détails ;
- séries japonaises et françaises ;
- une série, le catalogue d'un Pokémon ;
- prix, un historique et des historiques groupés.

Les 304 traversent le relais, et chaque erreur (404, 422, 429, 500) a son traitement côté site.
Les risques sont au prochain changement.

### INTEG-01 — Une génération ajoutée d'un seul côté fait planter le site (moyen)
- **Où** :
  - `pokedex/src/config/pokedex.ts:24` : `TOTAL_SPECIES = 1025` écrit en dur, et `GENERATIONS`
    (`:11-21`) sans bornes ;
  - côté données, tout part de `GENERATIONS.at(-1).last` (`pokedex-data/src/config/pokedex.ts:5-17`).
- **Preuve**, relue :
  - `pokedex/scripts/check-data-contracts.ts` ne compare que le type `GenerationId`.
  - `pokedex/src/lib/filters.ts:327-329` (`groupByGeneration`) appelle
    `generationById(…)!` : pour une 10e génération, `undefined`, puis une `TypeError`. La grille
    du Pokédex tombe.
  - `pokedex/src/lib/transfer.ts:137-138` refuse tout `dexIds` au-delà de 1 025, dans le
    navigateur comme sur le serveur. Une carte d'un nouveau Pokémon dans une collection fait donc
    refuser chaque envoi.
- **Scénario** : l'ordre documenté (les données d'abord, `deploiement.md`) est justement celui qui
  casse. Dans l'ordre inverse, ce n'est pas grave : 422 sur les nouveaux numéros, réessayé, et des
  sprites absents.
- **Correction** :
  - un type `TotalSpecies = 1025` dans `contract.ts`, copié dans `types.ts` et vérifié par
    `check-data-contracts.ts`, avec `TOTAL_SPECIES: TotalSpecies` des deux côtés ;
  - les `GENERATIONS` du site avec `satisfies Record<GenerationId, …>` ;
  - l'ordre noté dans `docs/donnees.md` : le site, puis les données, puis `species` avant
    `catalog`.

### INTEG-02 — `FORMAT` ne protège pas les réponses gardées dans R2 (moyen)
- **Où** : `worker/snapshots.ts:47-53`. Seul `serveTagged` lit `FORMAT`. Espèces et catalogue
  (`:62-76`) sont servis tels qu'écrits dans R2.
- **Écart avec la doc** : `CLAUDE.md:40-42` dit qu'« une réponse qui change de forme change
  `FORMAT` ».
- **Preuve** : le site ne contrôle la forme que des prix et de l'état. `readSet` et `loadSets`
  (`pokedex/src/lib/card-catalog.ts`) lisent les tuples par position.
- **Scénario** : un champ est ajouté à `CatalogSetRow`. R2 garde l'ancienne forme jusqu'à un
  `ingest catalog` lancé à la main (la tâche n'a pas de rythme). Un site déployé entre-temps lit
  `undefined`, et la page Catalogue tombe.
- **Correction** :
  - dire dans `CLAUDE.md` et `deploiement.md` que `FORMAT` ne vaut que pour les prix et les
    historiques ;
  - décrire le changement d'une forme gardée dans R2 en trois temps : les données, la tâche
    relancée, puis le site, qui lit les deux formes d'ici là ;
  - n'ajouter qu'en fin de tuple.

### INTEG-03 — Le contrôle du contrat garantit l'égalité, pas la compatibilité pendant un déploiement (moyen)
- **Où** :
  - `pokedex/scripts/check-data-contracts.ts:5-10` : `Equal` compare deux copies de travail,
    pas ce qui est en ligne ;
  - `pokedex-data/package.json` ne le lance jamais ;
  - les deux constructions de Workers Builds sont indépendantes.
- **Scénario** : un champ est renommé dans les deux dépôts, et la construction des données échoue.
  Le site part seul et lit l'ancienne forme. Dans l'autre sens, les onglets ouverts depuis des
  jours lisent la nouvelle forme jusqu'à leur rechargement.
- **Correction** :
  - la règle « élargir puis restreindre » dans `deploiement.md` : un champ ajouté d'abord en
    facultatif, retiré plus tard, jamais un tuple réordonné ;
  - `lint` de `pokedex-data` lance aussi le contrôle quand `../pokedex` existe ;
  - `satisfies PriceFile` sur les faux de `DATA` des tests du site
    (`pokedex/worker/tests/collection.test.ts:569-571`, `:618-621`).

### INTEG-04 — Des copies entre les dépôts, dont les chemins d'images gardés dans les collections, sans signalement ni contrôle (faible)
- **Où** :
  - `pokedex/src/lib/card-images.ts:25-68` ↔ `pokedex-data/src/lib/image-paths.ts:22-53` ;
  - `pokedex/src/config/catalog.ts` ↔ `pokedex-data/src/config/catalog.ts` ;
  - `pokedex/src/lib/card-code.ts:36-37` ↔ `worker/ingest/catalog.ts:68-69`.
- **Preuve** : ces copies sont identiques aujourd'hui, mais aucune ne porte l'en-tête « même règle
  que » (DOC-03), et `bun run contracts` n'en voit aucune. Or les chemins des images sont écrits
  dans les collections des comptes.
- **Effet** : un gabarit changé côté données, et chaque carte enregistrée montre la carte de
  substitution, sans erreur.
- **Correction** : les gabarits en types littéraux dans le contrat, vérifiés par `Equal`, et
  l'en-tête « même règle que » sur les autres copies.

## Sécurité

Aucune faille critique, élevée ou moyenne.
- **Entrée d'Internet** : on vérifie d'abord le verbe, puis la limite, puis le token. Aucune
  lecture de D1 ni de R2 sans token, sauf `/v1/health`.
- **Tokens** : comparés à temps constant, jamais écrits au journal.
- **Paramètres** : bornés ; ils reçoivent 422 sinon.
- **Clés R2** : elles ne sortent pas de `images/`. Un chemin `%2e%2e` ou une image française
  inexistante reçoivent 404.
- **SQL** : toutes les valeurs sont liées.
- **Anonymat** : rien de ce que rend l'API ne nomme une source.

### SEC-04 (suivi) — Les limites comptent toujours l'adresse IPv6 entière (faible, confirmé, non corrigé)
- **Où** : `worker/limits.ts:18`, `const key = request.headers.get('cf-connecting-ip') ?? 'local'`.
  DEC-12 n'a ni commit ni trace dans la doc.
- **Ce qui reste derrière la limite** : l'ordre est verbe, puis `limited`, puis `guard` (SHA-256
  et comparaison, aucune lecture), puis l'API (`index.ts:47-48`).
  - **Sans token** : en changeant d'adresse dans son /64, on n'obtient que des 401 bon marché, et
    `/v1/health` sans limite (un `batch` D1). Cette même requête est déjà joignable sans limite par
    le site (`pokecodex.fr/api/health`, voir SEC-10).
  - **Avec un token, ou un token qui a fui** : chaque adresse du /64 a ses propres 300 demandes et
    20 demandes lourdes par 10 s. `/v1/wants` (environ 80 ms de D1 par appel, SEC-02 du
    2 novembre) devient sans plafond, et occupe la D1 que partagent les images, les prix et les
    souhaits du site.
- **Correction** :
  1. Une fonction `networkOf(ip)` copiée de `visitorOf`
     (`pokedex/worker/journal.ts:189-199`, expansion de `::` comprise), qui garde `'local'`, comme
     clé de `ANY_LIMIT`.
  2. Mieux : compter les routes lourdes par client, après le token. `guard` rend le nom du client,
     et `HEAVY_LIMIT.limit({ key: client })`, avec `/v1/wants` à 5 par 10 s comme sur le site.
  3. Tests (`api.test.ts`) : `2001:db8:1:2::5` et `2001:db8:1:2:aaaa::1` donnent la même clé ;
     une IPv4 reste inchangée.

### SEC-08 — La limite des routes lourdes ne voit pas un chemin encodé (faible)
- **Où** : `worker/limits.ts:19-22`. `new URL(request.url).pathname` garde `%77` tel quel, alors
  que Hono route sur le chemin décodé.
- **Preuve** : rejouée par l'agent avec le Hono installé (4.13.14) : `/v1/%77ants?ids=1` sert
  `/v1/wants` sans passer par `HEAVY_LIMIT`.
- **En ligne** : neutralisé tant que la normalisation d'URL de la zone reste active (le réglage par
  défaut de Cloudflare ; à vérifier dans le tableau de bord, Rules › Settings).
- **Correction** : `getPath(request)` (`hono/utils/url`) dans `limits.ts`, et de même dans
  `auth.ts:67`. Test : `/v1/%77ants` reçoit 429 quand `HEAVY_LIMIT` refuse.

### SEC-09 — Des données des sources écrites avec des contrôles incomplets (faible, mais sans sauvegarde)
- **Un seul libellé du menu efface des séries entières.**
  - Où : `worker/ingest/catalog.ts:516-531` (`saveBlocks`) efface cartes et séries pour chaque code
    que le menu japonais range en « Asia Exclusive » (`:613`). Aucune garde, alors que
    `saveSeries` refuse de perdre plus de la moitié d'une série.
  - Effet : `card_species` part en cascade, les séries ne sont plus relues (`:667`), et leurs
    images japonaises répondent 404.
  - Correction : refuser (une erreur) un retrait qui toucherait plus de quelques séries, ou une
    série connue de plus de N cartes.
- **Prix sans bornes.**
  - Où : `worker/ingest/prices.ts:85`, `amount = (value) => (value ? toCents(value) : null)`.
    Ce code accepte un prix négatif ou aberrant, et l'écrit dans l'historique du jour. La reprise,
    elle, exige `price > 0` (`history.ts:61`).
  - Correction : `typeof v === 'number' && v > 0 && v < 100_000`, puis garder les dates reprises
    d'au plus 200 jours avant `until`.
- **Champs numériques des cartes non typés à l'ingestion** (`id_card`, `sort`, `id_cardmarket`…).
  - Effet : dans des tables sans `STRICT`, un texte entre dans une colonne `integer`. Un `sort`
    hors de 1 à 9 999 fait échouer `imagePathOf(path)!` (`ingest/images.ts:71`).
  - Correction : dans `saveSeries`, écarter une carte dont ces champs ne sont pas des entiers
    positifs.
- **Pourquoi ça compte** : sans sauvegarde (décision de l'utilisateur), seul le Time Travel de
  30 jours rattraperait une mauvaise écriture.

### SEC-10 — `/api/status` et `/api/health` du site atteignent la D1 des données sans aucune limite (faible)
- **Où** :
  - `pokedex/worker/limits.ts:7`, `:23-37` : aucune règle, une décision documentée ;
  - `pokedex/worker/data.ts:21` : le relais ;
  - `worker/status.ts:52-61` : `SCAN runs USING INDEX runs_by_job`, sur une table qui grandit
    sans fin.
- **Effet** : ce sont les seuls chemins anonymes et illimités vers cette D1. Le coût par appel est
  faible aujourd'hui, environ 1 500 lignes lues par appel dans un an.
- **Correction** : `/api/(status|health)` dans `DATA_LIMIT` du site ; purger les passages de plus
  d'un an. C'est le même chantier que SEC-01 de l'audit du backend.

### SEC-11 — En http, un script suit la redirection après avoir envoyé son token en clair (faible)
- **Où** : `worker/index.ts:43-46` ; une requête http reçoit 301 avant toute vérification.
- **Correction** : en http, une requête qui porte `Authorization` reçoit 403 sans `Location`, et
  une ligne au journal invite à changer ce token.

### SEC-12 — Les lectures des sources n'ont ni plafond de taille ni hôte fixé (faible)
- **Où** :
  - `worker/ingest/pokecardex.ts:104`, `:136`, `:162-164` : l'adresse du script vient de la page,
    et `new URL(script, SITE)` accepte une adresse absolue ;
  - `net.ts:23-27` : toute redirection est suivie ;
  - `images.ts:91-95` : tout `image/*` est accepté, de toute taille ;
  - `.text()` et `.arrayBuffer()` lisent sans plafond.
- **Effet** : aucune exécution de code (expressions régulières, WebCrypto, `JSON.parse`).
  Mais une réponse énorme épuise les 128 Mo, et une « image » de plusieurs dizaines de Mo serait
  gardée dans R2 et servie.
- **Correction** :
  - un script seulement de l'origine de la source ;
  - `redirect: 'manual'` ;
  - une lecture plafonnée (5 Mo) ;
  - seulement `image/webp`, `image/png` et `image/jpeg` ;
  - `streamArray` lève une erreur au-delà de 1 Mo par objet.

## Performances et coût

**Aucun poste ne coûte plus que l'abonnement payant.** Ces volumes sont estimés par l'agent ; rien
n'a été mesuré en ligne :
- D1 : environ 11 M de lignes écrites par mois, sur 50 M incluses ;
- R2 : environ 3 Go stockés, sur 10 Go inclus.

Les lots 23, 24 et 26 font l'effet attendu : le décompte des cartes renumérotées d'une série de
774 cartes passe de 26 s à 1,9 ms, et `MAX(sort)` de 37 à 5 µs. Les gains possibles portent
surtout sur les octets envoyés au site.

### PERF-01 — Deux logos français pèsent 1,5 Mo chacun, dont 99,6 % de métadonnées (moyen)
- **Où** : `worker/ingest/images.ts:93`. `mirror()` garde les octets reçus tels quels.
- **Preuve**, mesurée sur le site local : `/images/sets/fr/SVP-md.webp` fait 1 535 992 octets. Ses
  blocs : `VP8X` 10, `ALPH` 1 880, `VP8` 4 858 et `XMP` 1 529 200, pour une image de 214 × 99 px.
  `MEP` est pareil (1 534 592 octets), à côté de 7 508 pour `SVI`. Selon l'agent, 438 logos sur
  1 376 ont des métadonnées (6,9 Mo sur 20,6 Mo).
- **Effet** : 3 Mo de plus à la première ouverture de la liste française des extensions (MEP est
  dans le premier bloc). Environ 15 s sur une 4G lente.
- **Correction** :
  1. Dans `mirror()`, retirer les blocs RIFF `XMP ` et `EXIF`, effacer leurs drapeaux du `VP8X` et
     réécrire la taille RIFF (une quinzaine de lignes).
  2. Recopier ensuite ces logos : `logos()` ne revisite pas un logo déjà copié. Il faut supprimer
     les objets et remettre `sets.logo = NULL` pour (fr, SVP) et (fr, MEP), puis relancer
     `images`. C'est une ingestion : à faire par vous.

### PERF-02 — Les illustrations des Pokémon sont des PNG (moyen)
- **Où** : `src/lib/image-paths.ts:37` (`UPSTREAMS.artwork`) ; affichées par
  `pokedex/src/pages/pokemon/SpeciesAbout.tsx:36`.
- **Preuve** : 1 025 PNG de 475 × 475, 132,7 Mo en tout. Sur 20 échantillons, le WebP qualité 0,9
  fait −81 %.
- **Effet** : environ 110 Ko de trop à la première vue de chaque fiche, sans doute son image
  principale (LCP).
- **Correction** : une conversion ponctuelle hors du Worker, puis des chemins `.webp` dans les deux
  dépôts. Ces chemins changent le contrat (INTEG-04).

### PERF-03 — `/v1/histories` relit et réécrit tout son JSON à chaque demande (faible)
- **Où** : `worker/history.ts:21-42`.
- **Preuve** (banc de l'agent) : pour 1 000 cartes sur un an, `JSON.parse` prend 27 ms,
  `JSON.stringify` 39 ms, environ 90 ms en tout (168 ms sur deux ans). La même réponse assemblée
  en texte se ferait en 1 ms.
- **Correction** : enchaîner les `prices` tels qu'en base, avec les `null` calculés entre deux
  années, sans `JSON.parse`.

### PERF-04 — Une requête D1 avant chaque image (faible)
- **Où** : `worker/images.ts:23-29`, `:45`, `:62-63`. Le contrôle de vraisemblance, puis
  `FILES.get` : de 80 à 300 allers-retours D1 en série par page de catalogue. La requête des
  raretés (`WHERE id = ?`) parcourt sa table.
- **Correction** : garder en mémoire du module les `MAX(sort)` par série et les raretés,
  rechargés toutes les 10 min.

### PERF-05 — Le catalogue réécrit toutes ses réponses R2, même inchangées, deux fois par passage `cards` (faible)
- **Où** : `worker/ingest/catalog.ts:173`, `ingest/images.ts:261-262`. Environ 5 500 écritures R2
  par passage, et plus d'une minute.
- **Correction** : comparer le MD5 de chaque JSON à l'ETag de R2 avant d'écrire.

### PERF-06 — Le relevé des prix envoie deux fois le même JSON par paquet (faible)
- **Où** : `worker/ingest/years.ts:45-62`. Le même texte va à l'`INSERT` et à l'`UPDATE`, soit
  environ 0,8 Mo par paquet de 200 en fin d'année.
- **Correction** : à l'`INSERT`, seulement les années nouvelles (`old === null`) ; à
  l'`UPDATE`, les autres.

(Le rythme réel des prix, toutes les 7 h et non 6, relevé aussi par cet agent : FIA-05.)

## Environnement local (pas un défaut du code)

- **Le Worker des données sur le port 8787** répond 301 vers lui-même à toute requête
  (`Location: http://127.0.0.1:8787/v1/health`). Il ne semble pas avoir été lancé par
  `bun run dev`, qui passe `--infer-origin-from-routes=false`.
- **Sa D1 locale** n'a reçu que les migrations 0000 et 0001 (relu dans `d1_migrations`). D'où
  `/api/wants` en 500 en local (colonne `expansion_slug` absente). En ligne, `deploy` applique les
  migrations avant de déployer.
- **À faire** : relancer `bun run dev` dans `pokedex-data` (il migre d'abord la D1 locale).
- **Bun** : le poste a la 1.3.10, alors que les deux dépôts déclarent la 1.4.4 (même constat que
  ENV-01 de l'audit du backend). Un `bun.lock` réécrit en 1.3.10, puis relu en
  `--frozen-lockfile` par la 1.4.4 de Workers Builds, peut bloquer un déploiement.

## Corrections de l'audit du 2 novembre

| Id | État |
|---|---|
| DATA-01 (signe de vie) | ✔ `workflow.ts:74-83`, `prices.ts:134`, `:141`, `:224`, `history.ts:200` |
| DATA-02 (journal dans les étapes) | ✔ |
| DATA-03 / DEC-13 | Noté dans la doc, et le code s'y conforme |
| DATA-04, DATA-05 | ✔ |
| DB-02, DB-03, DB-05 | ✔ (mesurés) |
| DB-06 (`runs`) | ✔ partiel : index `runs_open` ; la table grandit toujours, lue en entier par `status` et `health` (SEC-10) |
| SEC-02 / DEC-04 (`/wants`) | ✔ 5 par 10 s côté site ; 20 par 10 s sur l'entrée d'Internet, et le précalcul n'est pas fait |
| SEC-04 / DEC-12 | ✘ non corrigé, décision non tranchée (ci-dessus) |
| TEST-02 à TEST-06, TEST-09, TEST-10, TEST-13 | ✔ |
| CONF-01 (contrat) | ✔ côté site ; pas lancé par `pokedex-data` (INTEG-03) |
| CONF-05 / DEC-19 (Bun) | ✘ incomplet sur le poste |

## Tests manquants les plus utiles

1. **`prices.test.ts`** : un guide coupé avant la fin du tableau est refusé (FIA-01).
2. **`workflow.test.ts`** :
   - une tâche qui échoue après `alive()` et une qui réussit : `ok`, message et `alive_at`
     notés (FIA-03) ;
   - avec FIA-06 : deux appels de `startRun` avec la même instance rendent le même id.
3. **`history.test.ts`** : un prix du jour écrit entre la lecture et l'écriture d'une reprise ;
   les deux restent, et cinq conflits font lever une erreur sans noter la carte lue (FIA-04).
4. **`api.test.ts`** :
   - deux IPv6 du même /64 donnent la même clé de limite (SEC-04) ;
   - `/v1/%77ants` est limité (SEC-08) ;
   - http avec token reçoit 403 (SEC-11).
5. **`catalog.test.ts`** : un menu qui range une série connue en « Asia Exclusive » n'efface rien
   (SEC-09).
6. **`prices.test.ts`** : `avg30: -5` ne donne pas de prix (SEC-09).
7. **`runs.test.ts`** : un passage réussi il y a 5 h 59 est dû (FIA-05).
8. **`prices.test.ts`** : au passage de l'année, le prix d'il y a 30 jours se lit dans l'année
   d'avant (trou relevé par l'agent fiabilité).

## Ordre proposé

1. **Une ligne chacun** :
   - FIA-01 (document tronqué) ;
   - FIA-02 (`timeout: '30 minutes'`) ;
   - SEC-08 (`getPath`) ;
   - FIA-05 (marge de `isDue`) ;
   - SEC-09 (bornes des prix).
2. **SEC-04, à trancher (DEC-12)** : la clé /64, et mieux, les routes lourdes comptées par client.
3. **Contrats, avant toute nouvelle génération ou tout nouveau champ** : INTEG-01 (`TotalSpecies`
   dans le contrat), puis la doc d'INTEG-02 et INTEG-03.
4. **Tests** : FIA-03, FIA-04 et la liste ci-dessus.
5. **Performances** : PERF-01 (retirer les XMP, puis recopier deux logos, ce qui demande une
   ingestion de votre part), puis PERF-03 et PERF-04.
6. **À décider** : PERF-02 (illustrations en WebP, des chemins à changer dans les deux dépôts),
   SEC-09 (garde sur les séries retirées), SEC-12 (plafonds des lectures), SEC-11.

## Annexes

- **Contrôles exécutés** : `bun run test` (123 réussis), `bun run typecheck`, `bun run lint` et
  `bun run contracts` (côté site), tous sans erreur.
- **Reproductions** :
  - sur le site local (`localhost:5173`, relais `SiteEntrypoint`) ;
  - sur des copies de modules (le document tronqué, sous Node) ;
  - sur une copie en lecture seule de la D1 locale.
- **Nettoyage** : les fichiers de travail des agents sont dans
  `C:\Users\a.segalat\AppData\Local\Temp\claude-audit\`. Deux processus d'analyse de l'agent
  performances, restés en marche, ont été arrêtés.
- **Rien d'exécuté qui touche aux sources ou à la production** : aucune ingestion, même locale,
  aucun `wrangler` distant, aucune requête vers `api.pokecodex.fr`.
