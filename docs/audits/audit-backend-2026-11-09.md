# Audit du backend de pokedex — 9 novembre 2026

**Périmètre** : le Worker du site (`pokedex/worker/`, environ 1 600 lignes) et ce qu'il importe de
`src/lib` : Hono, Better Auth 1.7.11, D1 et Drizzle, sécurité, permissions, sessions,
synchronisation des collections (avec son côté client, `src/store/account.ts`), intégrité des
données, erreurs et migrations.

**Méthode**
- Tests locaux exécutés : `bun test` (règles du site, 174 tests) et `bun run test:worker` (Vitest
  dans workerd, 78 tests). Tous passent.
- Relecture complète du Worker, des migrations et du store de synchronisation.
- Deux agents d'audit en lecture seule : sécurité, puis synchronisation et intégrité.
- Chaque constat repris ici a été revérifié à la ligne citée, et reproduit en local quand c'était
  possible.

**Aucun code ni aucune donnée de production modifiés** : aucune requête vers `pokecodex.fr`, aucun
`wrangler` distant. Les constats de `docs/audit-2026-11.md` déjà corrigés ne sont pas repris.

## En bref

- **Le backend est sain.** Aucune faille de contrôle d'accès, aucune injection, aucune fuite du
  Pokédex public. L'enregistrement est atomique (rejoué en concurrence) et les sessions sont bien
  tenues. Les corrections de l'audit du 2 novembre sont en place, sauf la ligne de better-call au
  journal (pour information).
- **Un risque réel de perte de données (élevé), SYNC-01** : après une connexion sur un autre
  appareil, les modifications faites pendant « Reconnectez-vous » sont jetées à la reconnexion si
  l'autre appareil a écrit entre-temps, alors que l'app promet qu'elles partiront.
- **Deux défauts de sécurité moyens** :
  - SEC-01 : `/api/auth` (sans barre finale), `/api/account` et `/api/journal` n'ont aucune limite
    par visiteur, et chacune de leurs requêtes interroge D1.
  - SEC-02 : rien ne limite les tentatives de connexion par compte visé. En changeant de réseau
    IPv6, on devine un mot de passe à grande échelle, alors que les pseudos sont publics.
- **Un trou de tests (moyen), SYNC-02** : rien ne protège l'atomicité de l'enregistrement.
- **Sept constats faibles** : la taille de l'import, la version du format, la remise à zéro des
  tests, le volume du journal, les mentions légales, l'ETag du Pokédex public et la version de Bun
  du poste. Plus deux pistes plausibles non prouvées.
- **Tests** : 174 et 78 réussis.

## Synchronisation et intégrité des collections

### SYNC-01 — Après une connexion ailleurs, se reconnecter jette les modifications que l'app promet d'envoyer (élevé)
- **Où** :
  - `src/store/account.ts:398-403` : `changed()` compte toute modification, même en `expired`.
  - `:237-240` : `push` n'envoie rien en `expired`.
  - `:312-318` : `signIn` sur le même compte renvoie depuis l'ancienne version.
  - `:212-217` et `:156-164` : `reloadAfterConflict`, puis `load`, remplacent le document.
  - `src/components/AccountMenu.tsx:35` et `:178-179` : les textes.
- **Preuve** : rejoué deux fois par l'agent dans deux navigateurs locaux isolés, sur un compte de
  test local ; je l'ai relu à la ligne.
  1. A enregistre (version 1). B se connecte au même compte : la session de A est supprimée
     (`worker/auth.ts:176-186`). B enregistre (version 2).
  2. A continue d'ajouter des cartes : l'état passe à `expired` et l'app les accepte toutes en
     mémoire.
  3. Le menu de A dit « reconnectez-vous à ce compte, et celles en attente partiront » ; la
     confirmation, « elle partira si vous vous reconnectez avec le pseudo … ».
  4. A se reconnecte. L'envoi part de la version 1, le serveur répond 409, l'app relit la
     version 2 et remplace tout. Toutes les modifications faites depuis le dernier
     enregistrement sont perdues, sans moyen de les récupérer.
- **Effet** : c'est le cas normal du « un seul appareil à la fois ». La cause de l'expiration (une
  connexion ailleurs) rend probable une écriture de l'autre appareil. Plus largement, tout 409 jette
  tout ce qui attend, et pas seulement « votre dernière modification » (`AccountMenu.tsx:40`).
- **Correction**, sans fusion (le modèle « le serveur gagne » reste) :
  1. Dans `reloadAfterConflict`, avant `load`, garder la version locale si quelque chose attend :
     `const mine = hasUnsavedChanges() ? currentDocument() : null`, dans le store.
  2. L'état `reloaded` (menu et toast) propose alors « Exporter ma version »
     (`ExportCollectionButton` sur ce document). Cette version gardée est oubliée à la modification
     suivante et par `leave()`.
  3. Corriger les textes :
     - « … sauf si la collection a changé ailleurs entre-temps : elles seraient remplacées,
       exportez-la d'abord » ;
     - « vos modifications en attente » au lieu de « votre dernière modification ».
  4. Ne plus accepter de modification en `expired` : bannière, et actions désactivées. Ou au
     minimum un toast au passage en `expired` ; sur téléphone, il n'y a aujourd'hui qu'une icône.
  5. Test : dans `sync.test.ts`, « se reconnecter après une écriture ailleurs » (le n° 1 de la
     liste des tests).

### SYNC-02 — Aucun test ne protège l'atomicité de l'enregistrement (moyen)
- **Où** : `worker/collection.ts:192-206`. La seule garde entre deux envois simultanés est
  `setWhere: eq(collections.version, baseVersion)`, suivie de `meta.changes === 0`.
- **Preuve** : aucun `Promise.all` dans `worker/tests` (recherche faite) ; tous les tests envoient
  l'un après l'autre. La lecture de la ligne 192 suffit donc à les faire passer. L'agent a rejoué en
  local six tours de trois PUT simultanés : chaque fois `200, 409, 409`, et la version n'avance que
  d'un cran. La garde marche aujourd'hui, mais rien ne la tient.
- **Effet** : une refonte qui la perdrait (un `select` puis un `update`) écraserait sans un mot la
  version d'un autre onglet ou d'un autre appareil.
- **Correction** : dans `collection.test.ts`, cinq PUT partis de la même version, en
  `Promise.all` ; attendu `[200, 409, 409, 409, 409]` et la version n'avance que d'un cran. Ce test
  doit échouer quand on retire `setWhere`.

### SYNC-03 — Un import de plus de 1,9 Mo est accepté, puis chaque envoi est refusé (faible)
- **Où** : `src/lib/transfer.ts:311-317` (`readImport` ne contrôle pas la taille) et
  `src/pages/data/ImportSection.tsx:72` (fichiers jusqu'à 20 Mo).
- **Effet** : « Collection remplacée par celle du fichier. », puis « Envoi refusé : elle dépasse
  1,9 Mo » à chaque modification. Rien n'est perdu sur le serveur, mais l'app reste bloquée tant
  que la collection n'est pas allégée.
- **Correction** : `readImport` refuse au-delà de `MAX_DOCUMENT` octets, avec la raison, avant
  « Remplacer ».

### SYNC-04 — Un onglet resté sur l'ancien code effacera le prochain champ ajouté au document (faible, à prévoir)
- **Où** : `src/lib/transfer.ts:60-88`. `readCollection` ne garde que les champs qu'il connaît et
  force `schemaVersion: 1`.
- **Scénario** :
  1. On ajoute un champ, et le site est déployé.
  2. Un onglet ouvert la veille relit la collection et perd ce champ en mémoire.
  3. Sa modification suivante l'envoie sans ce champ ; le serveur l'accepte.
  4. Le champ disparaît de tous les appareils.
- Rien ne versionne le format envoyé. Ce n'est pas un bug aujourd'hui, mais un piège pour le
  premier nouveau champ.
- **Correction** : avant ce champ, le client envoie la version de son format, et le serveur refuse
  un format plus ancien (426 « Rechargez la page »). Un test le vérifie.

### SYNC-05 — `sync.test.ts` ne remet pas à zéro ses doublures entre deux tests (faible)
- **Où** : `worker/tests/sync.test.ts:51-86` (`browser.failNextPut`, `loseNextAnswer`,
  `duringNextGet`, `cookie`, `page.visibilityState`) ; aucun `beforeEach` dans le fichier.
- **Effet** : un test qui échoue avant d'avoir consommé sa doublure fait échouer le suivant à
  tort, ce qui donne une cascade trompeuse.
- **Correction** : un `beforeEach` qui remet `browser` et `page` à zéro.

### Plausible, non prouvé
- **Un renvoi peut croiser l'envoi d'origine encore en cours au serveur** : le délai du client
  (15 s) est passé, et D1 est lente.
  1. Le renvoi lit la version 5, puis l'original écrit la version 6.
  2. L'upsert du renvoi n'écrit rien : le serveur répond 409.
  3. L'app affiche « Rechargée » à tort, et jette ce qui a été modifié depuis.
- **À confirmer** : il faut que le Worker poursuive une requête après la déconnexion du client.
- **Parade peu coûteuse** : quand `meta.changes === 0`, relire la ligne et refaire la
  reconnaissance du renvoi (`collection.ts:185-190`) avant de répondre 409.

## Sécurité, permissions et sessions

### SEC-01 — Des routes qui interrogent D1 échappent à toute limite par visiteur (moyen)
- **Où** : `worker/limits.ts:23-37`, en particulier la règle `:29`,
  `/^\/(api\/(auth|vitrine)\/|[A-Za-z0-9_-]+$)/`, qui exige une barre après `auth`. La route de
  Better Auth, `.all('/auth/*')` (`worker/auth.ts:351`), reçoit pourtant aussi `/api/auth`.
  `/api/account` et `/api/journal` ne sont dans aucune règle.
- **Preuve**, rejouée en local avec un en-tête `cf-connecting-ip` simulé (Miniflare simule les
  liaisons `ratelimits`) :
  - `/api/auth/zzz` reçoit 429 passé la limite ;
  - `/api/auth`, sans barre finale, reçoit 50 réponses sur 50 sans jamais de 429.
  - L'agent a obtenu de même 120 × 200 sur `GET /api/account` avec une session, et 60 × 204 sur
    `POST /api/journal`.
- **Ce que coûte chaque requête**, en production :
  - Une requête qui atteint Better Auth passe d'abord par son limiteur, compté dans D1 : un
    `SELECT`, puis un `INSERT` ou un `UPDATE` sur `rateLimit`, et trois requêtes une fois bloquée.
  - `/api/account` et `/api/journal` lisent la session dans D1.
- **Effet** : une seule adresse IPv4 peut envoyer des milliers de requêtes par seconde qui finissent
  toutes dans D1, sans compte pour `/api/auth`. La base du site traite ses requêtes l'une après
  l'autre. Si elle sature, sessions et collections tombent pour tout le monde. La saturation est
  plausible, mais non mesurée (aucun essai de charge).
- **Correction** :
  - Dans `limits.ts` :
    - `api\/(auth|vitrine)(\/|$)` ;
    - `[/^\/api\/(account|journal)\/?$/, 'COLLECTION_LIMIT']` ;
    - plus sûr encore : une limite par défaut pour toute adresse `/api/*` qui n'en a pas.
  - Test : la 41e requête vers `/api/auth`, `/api/account` et `/api/journal` reçoit 429.
  - `/api/status` et `/api/health` n'ont pas de limite, par décision (`limits.ts:7`). Mais ils
    parcourent la table `runs` de l'API des données, qui grandit sans fin. À revoir avec le même
    défaut.

### SEC-02 — Les tentatives de connexion ne sont pas limitées par compte visé (moyen)
- **Où** : `worker/auth.ts:204-216`. Better Auth compte ses tentatives par clé
  `${ip}|${path}` (`@better-auth/core/dist/utils/ip.mjs:228-230` ;
  `better-auth/dist/api/rate-limiter/index.mjs:248`), en ramenant l'IPv6 à son /64.
- **Scénario** : les pseudos sont publics (`/pseudo`), et un mot de passe peut n'avoir que 8
  caractères.
  1. Un robot envoie `POST /api/auth/sign-in/username` en forgeant
     `Origin: https://pokecodex.fr`. `sameOrigin` protège d'un autre site, pas d'un robot.
  2. Il change de /64 à chaque essai : un /56 d'hébergeur en donne 256, un /48 de tunnel IPv6
     65 536.
  3. Depuis un /56 : 5 × 256 = 1 280 essais par minute, environ 1,8 million par jour sur un seul
     compte.
  4. Au journal, une seule ligne « Connexion refusée » par visiteur et par minute, sans alerte.
- **Effet** : un compte au mot de passe courant est pris : collection lue ou effacée, pseudo changé,
  compte supprimé.
- **Correction** :
  - Dans `accountRoutes`, avant `auth.handler`, pour `/sign-in/username`, compter les refus par
    pseudo visé. Le pseudo tapé est déjà lu (`typed`, `auth.ts:358`).
  - Par exemple 20 refus par heure et par pseudo, comptés dans D1 : les liaisons `ratelimits` de
    Cloudflare comptent par emplacement, donc mal face à un attaquant réparti.
  - Contrepartie : un tiers peut bloquer une heure la connexion à un pseudo. Garder un seuil
    modéré et le dire dans le message de refus.
  - Test : 21 refus sur le même pseudo depuis 21 adresses différentes ; le 21e reçoit 429.

### SEC-03 — Chaque envoi accepté écrit jusqu'à 21 lignes au journal, sans plafond par compte (faible)
- **Où** : `worker/collection.ts:213-215`, `worker/journal.ts:237-266` (`MAX_LINES = 20`, plus
  « Autres changements »).
- **Scénario** : un compte alterne deux documents qui diffèrent sur plus de 20 cartes.
  `COLLECTION_LIMIT` laisse passer 4 envois par seconde, soit environ 84 lignes par seconde et par
  adresse.
- **Effet** : des Workers Logs facturés au-delà du quota inclus, et les 7 jours de journal noyés.
- **Correction** : une clé `journalOnce` par compte pour le détail des changements (le détail une
  fois par minute, sinon une ligne de synthèse).

### SEC-04 — Les mentions légales ne disent pas que l'IP de chaque visiteur de `/api/auth/*` est gardée en base (faible)
- **Où** : `worker/auth.ts:204-207` (`storage: 'database'`) ; la clé de `rateLimit` contient l'IP
  en clair ; purge par Better Auth après la plus longue fenêtre, une heure
  (`rate-limiter/index.mjs:174-184`). `src/pages/LegalPage.tsx:66-82` et `:111-119` ne citent que
  l'IP de la session et celle du journal.
- **Correction** : ajouter « tentatives de connexion : l'adresse IP, environ une heure » aux
  sections « Ce que le site garde » et « Combien de temps ».

## Autres constats

- **VIT-01 — Le Pokédex public demande les prix avant de comparer l'ETag (faible).**
  - Où : `worker/vitrine.ts:231-232`.
  - Effet : une réponse 304 coûte quand même jusqu'à cinq appels à l'API des données.
  - Correction : calculer l'ETag sur le document montré et la date du guide des prix (une
    requête légère), et ne demander les prix qu'en l'absence de 304.
- **ENV-01 — Le poste lance Bun 1.3.10, alors que DEC-19 demande la 1.4.4 (faible).**
  - Constat : `bun --version` affiche 1.3.10, sous Git Bash comme sous PowerShell
    (`~/.bun/bin/bun.exe`), alors que `package.json` déclare `packageManager: bun@1.4.4`. Les
    tests de ce rapport ont donc tourné sous 1.3.10.
  - Correction : `bun upgrade` vers la 1.4.4, ou corriger la note DEC-19.
- **Pour information** :
  - **Reste de SEC-05** : better-call écrit encore l'erreur entière d'une requête SQL en panne
    (ligne `# SERVER_ERROR:`, `router.mjs:93`), valeurs comprises. C'est noté « à décider » dans
    `worker/journal.ts:23-25`.
  - **Méthodes HTTP** : `SiteEntrypoint` (`pokedex-data/worker/index.ts:69-73`) accepte toute
    méthode, et `worker/data.ts:23-27` relaie toute méthode. C'est sans risque aujourd'hui (l'API
    n'a que des routes de lecture), mais une future route d'écriture y serait
    ouverte à tout visiteur.
  - **Mémoire de plusieurs envois simultanés** (plausible, non prouvé) : un document forgé
    de 1,9 Mo occupe environ 42 Mo une fois lu par `JSON.parse` (mesure de l'agent sous Node),
    contre 8 Mo pour un document normal. Plusieurs envois traités par le même exemplaire du Worker
    approcheraient ses 128 Mo. Le partage des exemplaires ne se reproduit pas en local.

## Vérifié sans défaut

- **Contrôle d'accès** :
  - toutes les routes de la collection partent de `c.var.user.id` ;
  - un `account` différent de la session reçoit 401 (testé) ;
  - aucune route ne prend un id de compte dans l'adresse.
- **Pokédex public** : `shownCollection` recopie chaque champ un à un : ni prix payé, ni commande,
  ni budget, ni statut « commandée » (testé). `__proto__` dans le document : au pire, son auteur
  casse son propre Pokédex public.
- **Garde du pseudo** (`guard`) : rejouée par l'agent. `name` et l'adresse e-mail imposés par la
  requête sont écrasés, et `update-user` sans pseudo reçoit 400. Better Auth refuse `//` et la
  barre finale dans ses chemins, et son limiteur les normalise pareil.
- **Sessions** :
  - Une seule session par compte, effacée juste après la création d'une autre : deux connexions
    simultanées n'en laissent jamais deux.
  - Le changement de mot de passe révoque les autres sessions (`revokeOtherSessions: true`,
    `AccountSection.tsx:149`).
  - La suppression du compte exige le mot de passe ; collection et sessions partent en cascade.
  - Les cookies sont `HttpOnly`, `SameSite=Lax`, `Secure` et `__Secure-`.
- **Limites de Better Auth** : actives en production (DEC-01), clé ramenée au /64 en IPv6 (valeur
  par défaut de `ipv6Subnet`), table `rateLimit` purgée par Better Auth (`deleteExpiredRows`).
- **Enregistrement** :
  - L'upsert conditionnel est atomique : six tours de trois envois simultanés donnent chaque fois
    `200, 409, 409`.
  - Une réponse perdue est reconnue au renvoi.
  - Une modification faite pendant un envoi part ensuite.
  - Une collection ne peut jamais partir dans un autre compte (401 serveur, contrôle de `account`
    à la lecture, `leave()`).
- **Entrées** :
  - SQL : seulement des paramètres liés, aucun `sql.raw`.
  - Corps : plafonnés avant lecture (16 Ko pour l'auth, 1 Ko pour le journal, 1,9 Mo pour la
    collection), et la décompression s'arrête au plafond.
  - XSS : aucun `dangerouslySetInnerHTML` ; liens limités à http et https ; l'aperçu pour les
    robots échappe ses valeurs.
- **Erreurs** : 500 sans corps et jamais en cache ; la requête SQL au journal sans ses valeurs
  (`loggable`) ; une panne de session donne 500, jamais un faux 401 (testé).
- **Migrations** :
  - `0000` à `0003` ne reconstruisent aucune table.
  - Les déclencheurs des pseudos tiennent la réservation d'un seul tenant avec l'écriture.
  - Le piège des reconstructions (DB-02) est couvert par `tests/migrations.test.ts` et la marque
    `-- reconstruction vérifiée`.
- **Dépendances** : `bun audit` signale deux avis moyens (minimatch, esbuild), seulement dans
  l'outillage. Better Auth 1.7.11 et Hono 4.13.14 sont postérieurs aux correctifs publiés.
- **Écarté** : « une carte d'une nouvelle génération ferait refuser chaque envoi ». L'API des
  données filtre déjà les numéros du Pokédex à 1–1 025 (`pokedex-data/worker/ingest/catalog.ts:413-414`).

## Corrections de l'audit du 2 novembre

| Id | État |
|---|---|
| SEC-01 (limites de Better Auth) | ✔ `auth.ts:205` |
| DB-01 (plafond sous 2 Mo) | ✔ `types.ts:408`, `collection.ts:84`, `:178` |
| SEC-02 (`/api/wants`) | ✔ `limits.ts:34`, 5 par 10 s |
| SEC-03 (taille des corps) | ✔ `auth.ts:351` (couvre aussi `/api/auth`), `collection.ts:219` |
| SEC-05 (valeurs SQL au journal) | ✔ pour le Worker ; reste la ligne de better-call (ci-dessus) |
| SEC-06 (routes de Better Auth inutilisées) | non fait, par décision (commit c225ece) |
| BACK-02, BACK-03, BACK-04, DB-04 | ✔ |
| ARCH-09, ARCH-10, DUP-17 (synchronisation) | ✔ |
| SEC-04 (IPv6 entière dans l'API des données) | ✘ hors de ce périmètre : `pokedex-data/worker/limits.ts:18` compte toujours l'IP entière ; DEC-12 n'a pas de commit |

## Tests manquants les plus utiles

1. **`sync.test.ts` — se reconnecter après une écriture ailleurs.** On modifie, la session
   tombe, on modifie encore, l'autre appareil écrit, on se reconnecte. Attendu : `reloaded`, et la
   version locale proposée à l'export (SYNC-01).
2. **`collection.test.ts` — cinq envois simultanés de la même version** (SYNC-02).
3. **`sync.test.ts` — une réponse perdue, puis une connexion à un autre compte.** Attendu :
   enregistrée, jamais `expired`. Aujourd'hui, retirer `unanswered = null` de `leave()`
   (`account.ts:374`) ne fait échouer aucun test.
4. **`sync.test.ts` — une réponse 200 coupée.** Attendu : `offline`, puis enregistrée, jamais
   `reloaded`. Aujourd'hui, déplacer `unanswered = null` avant `response.json()`
   (`account.ts:262-263`) passe inaperçu.
5. **Tests du Worker, avec `cf-connecting-ip`** : la 41e requête vers `/api/auth`, `/api/account`
   et `/api/journal` reçoit 429 (SEC-01) ; 21 refus sur un même pseudo depuis 21 adresses
   (SEC-02).
6. **`tests/import.test.ts`** : un export de plus de 1,9 Mo est refusé (SYNC-03).

## Ordre proposé

1. **SYNC-01**, le seul risque réel de perte. Commencer par les textes et le toast `expired`
   (petit), puis « Exporter ma version » dans l'état `reloaded`.
2. **SEC-01** : trois lignes dans `limits.ts` et leur test.
3. **SEC-02** : compteur de refus par pseudo, et son test.
4. **SYNC-02** et les autres tests manquants (sans changement de comportement).
5. **Petits** : SYNC-03, SEC-03, SEC-04 (texte), VIT-01, SYNC-05, ENV-01.
6. **À prévoir avant le premier nouveau champ du document** : SYNC-04.

## Annexes

- **Tests exécutés** :
  - `bun test` : 174 réussis, 0 échec, 10 fichiers.
  - `bun run test:worker` : 78 réussis, 6 fichiers, 42 s, aucun avertissement.
- **Reproductions** : sur le site local seulement (Vite 5173, Worker des données 8787, D1 locale).
- **Comptes de test** :
  - `audit-sync-a1`, de l'agent synchronisation, reste dans la D1 locale (`.wrangler/`), avec des
    cartes `manual:race-*`.
  - `AudSec1b`, de l'agent sécurité, a été supprimé.
  - `audit0934`, de l'audit du frontend, reste aussi.
- **Production** : aucun code ni aucune donnée modifiés, aucune requête envoyée.
