# Audit technique complet : Pokédex (React + TypeScript + Elysia + Bun)

- **Date** : 19 octobre 2026
- **Révision auditée** : `041e4d5` (branche `main`, arbre propre ; les 4 commits « Performance » ne sont pas encore poussés)
- **Périmètre** : tout le dépôt, pas seulement un diff : 357 fichiers suivis, dont 22 401 lignes dans `src/`, `server/` et `tests/`
- **Règle de l'audit** : lecture seule. **Aucun fichier de code n'a été modifié**, rien n'a été supprimé ni refactorisé. Les seuls fichiers écrits sont :
  - ce rapport ;
  - les produits du scan de sécurité, dans `CLAUDE-SECURITY-20261019-084618/` à la racine, ignoré par git via son propre `.gitignore` ;
  - des essais dans le dossier temporaire de la session, hors du dépôt.

## Sommaire

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Méthode, agents et skills](#2-méthode-agents-et-skills)
3. [Vérifications exécutées et non exécutées](#3-vérifications-exécutées-et-non-exécutées)
4. [Matrice de couverture par dossier](#4-matrice-de-couverture-par-dossier)
5. [Problèmes P0](#5-problèmes-p0)
6. [Problèmes P1](#6-problèmes-p1)
7. [Problèmes P2](#7-problèmes-p2)
8. [Problèmes P3](#8-problèmes-p3)
9. [Code mort](#9-code-mort)
10. [Vérifié sans problème](#10-vérifié-sans-problème)
11. [Plan de correction priorisé](#11-plan-de-correction-priorisé)
12. [Ce qui n'a pas été audité, et pourquoi](#12-ce-qui-na-pas-été-audité-et-pourquoi)

Les sévérités suivent le barème demandé :
- **P0** : critique (perte de données massive, faille exploitable, panne) ;
- **P1** : bug sérieux ou risque élevé ;
- **P2** : bug mineur ou dette notable ;
- **P3** : style ou amélioration.

Le **type** distingue trois cas :
- **bug confirmé** : avec une preuve ou une reproduction ;
- **risque plausible** : mécanisme vérifié dans le code, déclenchement non reproduit ;
- **recommandation** : style ou maintenabilité.

L'**effort** se lit ainsi : XS < 30 min, S < 2 h, M < 1 jour, L > 1 jour.

---

## 1. Résumé exécutif

**État général : bon, au-dessus de la moyenne pour une application de cette taille.**
- Les vérifications statiques sont toutes vertes : TypeScript strict avec `noUncheckedIndexedAccess`, ESLint, knip, Prettier, 132 tests, build, et `bun audit` sans vulnérabilité.
- Les couches sont tenues sans exception :
  - aucun cycle d'imports à l'exécution ;
  - `lib` n'importe jamais `store`, `components` ni `pages` ;
  - le serveur n'importe que `src/types`, `src/config` et `src/lib`.
- Toutes les requêtes SQL sont paramétrées. Il n'y a ni `innerHTML` ni `dangerouslySetInnerHTML`. La CSP est stricte (`script-src 'self'`).
- La synchronisation repose sur une fonction pure testée (`decide`) et une garde 409 transactionnelle.
- Le code mort est quasi nul, et la documentation suit le code de près.

| Priorité | Nombre | Dont confirmés |
|---|---|---|
| P0 | 0 | — |
| P1 | 1 | 1 (reproduit dans Chromium) |
| P2 | 16 | 8 |
| P3 | 54 | 12 (dont 1 écart doc/code) |

**Les 5 risques à traiter en premier :**

1. **P1-01. Perte silencieuse de modifications entre deux onglets** (`src/store/persist.ts`).
   - Deux onglets ouverts, dont un occupé ou gelé : la reprise des évènements `storage` réécrit des valeurs périmées. Les onglets se renvoient la balle (environ 160 écritures), puis se figent sur une **valeur ancienne**.
   - Reproduit dans le Chromium intégré : les 2 dernières modifications ont été perdues, et l'état faux est ensuite synchronisé au serveur.
   - Le correctif (un drapeau `restoring`, XS) a été validé dans les mêmes conditions.
2. **P2-01. Des prix partiels toute la session.** Le service worker garde une seule copie des prix par chemin (sans les ids), et le client marque comme « connus » tous les ids demandés. Après un 502 ou un réseau lent, toute la collection passe « sans prix » : valeur et plan d'achat faux, sans signal.
3. **P2-02 et P2-03. Le journal et la boucle d'évènements exposés sans authentification.**
   - Le journal peut être falsifié (injection de séquences ANSI et de sauts de ligne via le `callbackURL` que Better Auth recopie dans son message).
   - Il peut aussi être effacé par rotation : aucune limite sur les refus de connexion ou de création.
   - `/api/histories`, qui coûte 0,7 à 0,9 s de travail synchrone pour 1 025 ids, n'a aucune limite de rythme.
4. **P2-04 et P2-07. Deux chemins d'écrasement de la collection sur tous les appareils.**
   - Une clé locale illisible devient une collection vide, qui est envoyée au serveur.
   - Après une restauration de `app.db`, les numéros de version sont réutilisés et la garde 409 ne voit plus rien.
5. **P2-05 et P2-10. L'historique des prix, irremplaçable, sans filet.**
   - `/api/health` reste à 200 quand le guide Cardmarket est figé : des jours d'historique peuvent manquer sans alerte.
   - L'écriture quotidienne de l'historique (`server/jobs/prices.ts:90-147`) n'a aucun test.

**Verdict.** Aucun blocage de mise en production n'est identifié. Le correctif P1 (une ligne logique) et les P2 « données » (lots 0 et 1 du plan, environ 1,5 jour) devraient passer avant de nouvelles fonctionnalités.

---

## 2. Méthode, agents et skills

L'audit a été mené par lots :
1. vérifications outillées, lancées en premier ;
2. un scan de sécurité complet ;
3. huit agents spécialisés en parallèle, un par domaine, tous sous le même cahier des charges : lecture seule, jamais `.data` ni `.env`, vérifier chaque hypothèse dans le code, distinguer confirmé, plausible et recommandation ;
4. une contre-vérification manuelle des constats principaux (section 10, et les mentions « vérifié » dans les fiches).

| Domaine (phase demandée) | Outil, agent ou skill |
|---|---|
| 1. Architecture, 7. maintenabilité, 8. code mort | `pr-review-toolkit:code-reviewer` ; graphe des imports des 207 fichiers TS/TSX ; knip (normal et production) ; vérification automatique des identifiants cités dans CLAUDE.md, README et `docs/` |
| 2. Bugs, asynchrone, courses, mémoire, erreurs | Agent « bugs et concurrence » (simulations à évènements discrets) ; `pr-review-toolkit:silent-failure-hunter` (échecs silencieux, avec une passe de simplification façon `code-simplifier`) |
| 3. React, accessibilité, UX, performance | Agent React, guidé par les skills du projet `vercel-react-best-practices`, `vercel-composition-patterns` et `camply-ui` ; lecture de react-dom 19.3, camply et react-router 8.4 dans `node_modules` pour vérifier les comportements |
| 4. Elysia, API, contrats, ETag | Agent API : app construite en mémoire sur un dossier de données temporaire, requêtes rejouées (origines, 413, 422, priorité des routes) |
| 5. Sécurité (OWASP) | **Claude Security** : 12 composants, 38 chercheurs, balayage d'ensemble, panel de 3 vérificateurs par candidat. S'y ajoute un agent OWASP indépendant |
| 6. TypeScript | `pr-review-toolkit:type-design-analyzer` ; `tsc` du serveur sans la lib DOM, sur une configuration temporaire |
| 9. Tests | `pr-review-toolkit:pr-test-analyzer` ; `bun test --coverage` ; `--randomize` avec 4 graines |
| 10. Build et exploitation | Agent build et ops : build analysé (morceaux, précache), Dockerfile, compose, nginx, workflow, sauvegardes |
| Méthode | `superpowers` : skills de processus (vérifier avant d'affirmer, débogage systématique pour la reproduction du P1) |

Quand deux agents se contredisaient, le code a tranché. Un exemple : selon l'agent OWASP, Better Auth n'accepterait que du JSON sur `/sign-up/email`. C'est faux : `node_modules/better-auth/dist/api/routes/sign-up.mjs:30` accepte aussi `application/x-www-form-urlencoded`, et `better-call/dist/utils.mjs` le lit comme un formulaire. Le constat P3-S1 de Claude Security tient donc.

---

## 3. Vérifications exécutées et non exécutées

| Vérification | Commande | Résultat |
|---|---|---|
| Typecheck (3 projets) | `bunx tsc -b` | ✅ 0 erreur |
| Lint | `bunx eslint .` | ✅ 0 alerte |
| Code mort | `bun run knip` | ✅ rien |
| Code mort, mode production | `bunx knip --production` | ⚠️ 21 fichiers et 2 dépendances « inutilisés » : faux positifs d'une configuration incomplète (entrées sans `!`, `server/ingest.ts` absent ; P3-B4) |
| Formatage | `bunx prettier --check src server tests` | ✅ |
| Tests | `bun test` | ✅ 132 réussis, 0 échec, 304 `expect`, 3,8 s |
| Tests en ordre aléatoire | `bun test --randomize --seed 1` (puis 2, 3, 5) | ❌ 1 échec à chaque graine dans `tests/prices.test.ts` (P3-Q1) |
| Couverture | `bun test --coverage` | 76,85 % des lignes, 69,6 % des fonctions, **sur les seuls fichiers chargés par les tests** (stores, composants et la plupart des tâches n'y figurent pas) |
| Build | `bun run build` | ✅ 3,3 s ; démarrage ≈ 156 kB gzip de JS (`index` 108 kB, `shopping` 37 kB), CSS 22 kB ; précache de 48 fichiers (856 Kio) |
| Vulnérabilités des dépendances | `bun audit` | ✅ aucune |
| Dépendances en retard | `bun outdated` | better-auth 1.7.11 (correctif), knip 6.42, @types/node 26, typescript 7 (P3-B6) |
| Serveur sans DOM | `tsc` sur une configuration temporaire | 2 erreurs : `src/lib/transfer.ts:36-37` et `server/auth.ts:174` (P3-M1) |
| Sécurité | Claude Security, scan complet, effort moyen | 3 constats (1 moyen, 2 faibles), vérifiés par le panel (3/3, 2/3, 2/3) |
| Reproduction du P1 | Chromium intégré, 2 onglets, logique de `persist` recopiée | ❌ perte reproduite ; ✅ correctif validé |
| Comportements rejoués | app Elysia en mémoire, `curl` | 413, 422 avant 403, 404 d'OpenAPI en production, priorité des routes |

**Non exécutées, et pourquoi :**

| Vérification | Raison |
|---|---|
| `docker build`, `docker compose up`, `nginx -t` | Ni Docker ni nginx sur le poste. La configuration nginx a été relue, pas exécutée |
| Essai de bout en bout de l'app réelle (service worker, hors ligne, lecteur d'écran, CLS mesuré) | Il faut le serveur sur `.data`, interdit, ou une base d'essai complète. Ces constats viennent de la lecture du code et des spécifications |
| Lighthouse, Web Vitals en production | Pas d'accès au site déployé |
| Configuration Cloudflare (WAF, HSTS, cache) et du VPS (`authorized_keys`, pare-feu, journaux) | Absentes du dépôt |
| Tests sous Alpine (image Docker) | Lancés seulement sous Windows |
| Tests de mutation | Pas d'outil installé ; non demandé |

---

## 4. Matrice de couverture par dossier

Profondeur : **E** = lu en entier ; **P** = lu en partie (passages ciblés) ; **R** = recherche ciblée ou analyse automatique ; **—** = ignoré, avec la justification.

| Dossier | Fichiers suivis | Domaines | Profondeur | Remarques |
|---|---|---|---|---|
| `src/lib/` | 26 | 1, 2, 3, 5, 6, 7, 8, 9 | **E** (tous lus par au moins un agent) | Règles métier, API, synchronisation, transfert, prix |
| `src/store/` | 7 | 2, 3, 6, 9 | **E** | `persist`, `sync`, `prices`, `document`, `collection`, `shopping`, `theme` |
| `src/hooks/` | 10 | 3, 2 | **E** | |
| `src/components/` | 53 (TSX et CSS) | 3, 5, 7 | **E** pour les `.tsx` ; **P** pour les CSS (classes mortes vérifiées automatiquement, contrastes calculés sur les jetons) | |
| `src/pages/` | 88 (TSX et CSS) | 3, 2, 5, 9 | **E** pour les `.tsx` ; **P** pour les CSS | 3 CSS (`AuthPage`, `ErrorPage`, `VitrinePage`) non examinés par la passe sécurité, sans enjeu de sécurité |
| `src/config/` | 4 | 1, 6 | **E** | |
| `src/styles/` | 2 | 3, 7 | **E** | `theme.css` : contrastes calculés par script |
| `src/` (racine : `main.tsx`, `router.tsx`, `types.ts`) | 3 | 1, 3, 4, 6 | **E** | `types.ts` comparé aux réponses du serveur |
| `server/` | 13 | 4, 5, 2, 6, 7, 9 | **E** pour `app`, `reference`, `snapshots`, `collection`, `vitrine`, `images`, `history`, `index`, `ingest`, `legacy-prices` ; **E/P** pour `db`, `auth`, `journal` | |
| `server/jobs/` | 5 | 2, 4, 6, 9, 10 | **E** pour `prices`, `images`, `backups`, `species` ; **P** pour `catalog` (l. 94-150, 270-460) | |
| `server/lib/` | 2 | 2, 5 | **E** | `net`, `pokecardex` |
| `tests/` | 14 | 9 | **E** | Couverture mesurée, ordre aléatoire essayé |
| `public/` | 8 | 2, 5, 10 | **E** pour `sw.js`, `theme.js`, `manifest.webmanifest` ; **—** pour les 5 images binaires (rien à auditer) | |
| `deploy/` | 2 | 4, 5, 10 | **E** | `nginx.conf`, `security-headers.conf` |
| `.github/` | 1 | 5, 10 | **E** | `deploy.yml` |
| Racine (configuration) | 22 | 1, 8, 10 | **E** (`package.json`, `tsconfig*`, `vite.config.ts`, `eslint.config.js`, `knip.json`, `Dockerfile`, `compose.yaml`, `.gitignore`, `.dockerignore`, `bunfig.toml`, `index.html`, `CLAUDE.md`) ; **P** pour `README.md` (déploiement, sauvegardes) ; **R** pour `bun.lock` (via `bun audit`) | |
| `docs/` | 6 | 1, 7 | **P/R** : lus comme du texte de référence ; identifiants vérifiés automatiquement contre le code | Pas de code exécutable |
| `.claude/` | 91 | — | **E** pour `launch.json`, `settings.json` et `skills/camply-ui/SKILL.md` (référence du projet) ; **—** pour `skills/vercel-*` (88 fichiers) | Skills tiers vendus (`npx skills`, verrouillés par `skills-lock.json`) : pas du code de l'application |
| `node_modules/` (non suivi) | — | — | **—**, sauf lecture ciblée pour vérifier un comportement (better-auth, better-call, rou3, react-dom, camply, react-router, Elysia) | Dépendances tierces. La chaîne d'approvisionnement n'est couverte que par `bun audit` |
| `dist/` (non suivi) | — | 10 | **R** : sortie du build analysée (tailles, précache, réécriture d'`og:image`) | Généré |
| `.data/` (non suivi) | — | — | **—** | Données réelles, interdites en lecture et en écriture. Volumes et codes de séries non vérifiés |
| `.env` (non suivi) | — | — | **—** (noms de clés seulement, jamais les valeurs) | Secrets |
| `CLAUDE-SECURITY-20261019-084618/` (non suivi) | — | — | Produit de cet audit | À conserver ou supprimer selon votre choix |

---

## 5. Problèmes P0

**Aucun.** Aucune faille exploitable à distance qui expose des données, aucune perte de données massive, aucune panne reproductible.

---

## 6. Problèmes P1

### P1-01. Entre deux onglets, la reprise des changements réécrit des valeurs périmées : boucle, puis perte des dernières modifications

- **Sévérité** : P1 · **Type** : bug confirmé (reproduit dans Chromium) · **Confiance** : haute pour le mécanisme et la perte ; moyenne pour la fréquence réelle (il faut un onglet occupé ou gelé)
- **Emplacement** : `src/store/persist.ts:49-61`. Le commentaire des lignes 39-41 est faux.
- **Explication** :
  - À chaque évènement `storage`, `store.setState(restore(event.newValue))` déclenche le `subscribe`. Celui-ci réécrit la valeur reprise par une microtâche, puisque `restore` crée un nouvel objet et que la comparaison `pick(state) === pick(previous)` échoue toujours.
  - Le commentaire suppose que « `localStorage` ne signale pas une valeur identique ». C'est vrai seulement si la clé n'a pas changé entre-temps.
  - Prenons un onglet B qui traite à la suite deux évènements en attente, X1 puis X2. Il réécrit X1 alors que la clé vaut déjà X2 : la valeur change, ce qui déclenche un évènement dans A, puis il réécrit X2.
  - A fait de même : les deux onglets se renvoient la paire jusqu'à converger sur une valeur qui **n'est pas forcément la dernière**.
- **Preuve** (Chromium intégré, deux onglets de la même origine, logique de `persist` recopiée à l'identique, zustand réduit à `setState` et `subscribe`) :

  | Essai | Ce qui se passe | Résultat |
  |---|---|---|
  | Témoin | Une modification dans A | 1 écriture, B converge. ✅ |
  | B occupé 1,5 s | A fait deux modifications à 100 ms d'écart | 12 à 15 écritures et évènements par onglet, convergence sur la bonne valeur |
  | B occupé 3 s | A fait quatre modifications à 50 ms d'écart (10, 11, 12, 13) | **≈ 160 écritures et 160 évènements par onglet**, puis les deux onglets et le stockage se figent sur `{"n":11}` : **les modifications 12 et 13 sont perdues** |
  | Même scénario, avec le correctif | Drapeau `restoring` autour du `setState` du gestionnaire `storage` | 4 écritures, 4 évènements, valeur finale `{"n":13}`. ✅ |

- **Scénario réel** : l'app est ouverte dans deux onglets, ou installée et dans un onglet. Un onglet en arrière-plan, gelé par le navigateur ou occupé (le premier rendu des 1 025 pochettes), traite ses évènements en retard. Pendant ce temps, vous cochez « Je possède » puis vous changez le prix payé.
- **Impact réel** :
  - perte silencieuse des dernières modifications dans **les deux onglets et le stockage** ;
  - la synchronisation, réarmée à chaque changement (délai d'1 s), envoie ensuite l'état ancien au serveur, donc sur tous les appareils ;
  - pendant la boucle, processeur occupé et interface qui clignote ;
  - « Annuler » agit sur un état qui change sous lui.
- **Correction** : ne pas réécrire une valeur reprise.
  ```ts
  let restoring = false
  store.subscribe((state, previous) => {
    if (restoring || pick(state) === pick(previous) || pending) return
    // … inchangé
  })
  window.addEventListener('storage', (event) => {
    if (event.key !== key) return
    restoring = true
    try { store.setState(restore(event.newValue)) } finally { restoring = false }
  })
  ```
  En complément, on peut ignorer un évènement périmé (`event.newValue !== localStorage.getItem(key)`). Corriger aussi le commentaire. Un test `bun test` avec un faux `localStorage` et deux stores est possible : la règle « tests où une erreur coûte de l'argent » s'applique, puisque ce sont les commandes et les prix payés.
- **Effort** : XS (le test : S)

---

## 7. Problèmes P2

### P2-01. Prix : la copie du service worker et la mémoire `known` laissent des cartes « sans prix » toute la session

- **Sévérité** : P2 · **Type** : bug confirmé (trace du code, établie par 4 agents indépendants et revérifiée) · **Confiance** : haute
- **Emplacement** :
  - `public/sw.js:86-87` : `fresh(DATA, event, url.pathname)`, clé sans les ids, et `150-169` ;
  - `src/store/prices.ts:50-70`, ligne 66 : `known: new Set([...state.known, ...wanted])` ;
  - `server/jobs/prices.ts:70` : `readPrices` omet les cartes sans prix.
- **Explication** :
  - Le client ne demande que les ids encore inconnus. Après l'ajout d'une carte, `/api/prices/collection?ids=<cette carte>` **remplace** la copie gardée de toute la collection, puisque la clé est le seul chemin.
  - Au démarrage suivant, sur un 502 (déploiement) ou sans réponse en 4 s, `networkFirst` sert cette copie d'une carte.
  - Le store marque alors tous les ids demandés comme connus, y compris ceux absents de la réponse. Ils ne sont plus jamais redemandés jusqu'au rechargement.
  - `/selection` a le même défaut : une extension servie avec la copie d'une autre.
- **Preuve** : lecture croisée du service worker, du store et de `readPrices`. Le chemin est déterministe une fois la copie partielle servie. Il n'a pas été rejoué dans un navigateur.
- **Impact réel** :
  - valeur de la collection fortement sous-estimée (accueil, Valeur) ;
  - le plan de la prochaine commande range les cartes concernées dans « sans prix » ;
  - « Ce qui bouge » est vide ;
  - `CardmarketCheck` conseille « vérifiez l'id » ;
  - `usePricesMissing` reste à faux : **rien n'est signalé**.
  - Aucun prix n'est attribué à une mauvaise carte : la règle testée tient.
- **Correction** : faire comme `/api/histories`. Le serveur rend une clé par id demandé (`null` sans prix). Le client ne marque connus que les ids présents comme clé, et met les autres dans `failed` pour les redemander. Adapter `tests/prices.test.ts` : un id sans prix reçoit `null`, jamais le prix d'une autre carte.
- **Effort** : S

### P2-02. Journal du serveur : falsification, injection de séquences ANSI et effacement par rotation, sans authentification

- **Sévérité** : P2 · **Type** : bug confirmé (lecture du code ; Claude Security F1 retenu 3 voix sur 3 ; agent OWASP et agent ops concordants) · **Confiance** : haute
- **Emplacement** :
  - `server/journal.ts:126` : `message` écrit sans échappement ; seuls les détails le sont, l. 97-104 ;
  - `server/auth.ts:41-45` : `Better Auth : ${message}`, puis `console.error(...args)` brut ;
  - `server/auth.ts:122-137` et `180-198` : une ligne par refus, par 429 et par création refusée ;
  - `compose.yaml:9, 26, 47` : journaux limités à 3 × 10 Mo.
- **Explication** :
  - Le contrôle d'origine de Better Auth recopie le `callbackURL` du corps dans son message (« Invalid callbackURL: … »). Ce message arrive tel quel sur la sortie standard : sauts de ligne, codes ANSI, jusqu'à environ 5 Mo.
  - Par ailleurs, chaque refus de connexion, chaque 429 et chaque création refusée écrivent une ligne sans aucune limite. La création refusée répond même 403 **avant** le limiteur de Better Auth.
  - Le bridage `journalVisit` de la vitrine se contourne lui aussi : sa clé est l'IPv6 complète, et `noted.clear()` remet tout à zéro au-delà de 10 000 entrées.
- **Preuve** :
  - `POST /api/auth/sign-out` sans cookie, avec un `callbackURL` qui contient `\n<fausse ligne « Connexion »>\x1b[2J` : fausse ligne dans le journal, et effacement de l'écran du terminal qui suit `docker compose logs -f`.
  - Environ 7 corps de 5 Mo, ou environ 75 000 petites requêtes, font tourner les 30 Mo.
- **Impact réel** : le journal est le seul audit des connexions (le README s'en sert pour vérifier « Compte créé »). Il peut être falsifié, ou vidé pour couvrir une tentative de force brute. La force brute elle-même reste limitée (5 par minute et par /64).
- **Correction** :
  1. dans `journal()`, appliquer au `message` le remplacement des caractères de contrôle et la troncature ; ou garder un message constant dans `auth.ts:43` et passer le texte de Better Auth en détail (`details: { cause: message }`) ; échapper aussi `...args` ;
  2. une fonction partagée `journalOnce(key, entry, windowMs)` : une ligne par IP (/64) et par minute pour les refus, les blocages et les créations refusées ;
  3. une `limit_req` nginx sur `/api/auth/`, de clé `$http_cf_connecting_ip` (voir P2-03), ou une règle WAF Cloudflare.
- **Effort** : S

### P2-03. Routes publiques coûteuses sans aucune limite de rythme

- **Sévérité** : P2 · **Type** : risque plausible (coûts mesurés) · **Confiance** : moyenne
- **Emplacement** :
  - `server/reference.ts:202-229` (`/histories`, 1 025 ids ; `/wants`, 2 000 ids) ;
  - `server/history.ts:76-95` ;
  - `deploy/nginx.conf:3, 67` : la seule zone `limit_req` porte sur les copies d'images, et sa clé `$binary_remote_addr` est l'adresse du tunnel.
- **Explication** : sans session, tout le travail SQLite et JSON est synchrone, sur l'unique boucle d'évènements de Bun. L'ETag ne protège que les clients qui envoient `If-None-Match`.
- **Preuve** (données synthétiques : 1 025 cartes avec 22 mois d'historique, machine Windows) :
  - `/api/histories` : 741 à 914 ms par appel, pour 3,95 Mo (≈ 480 ms de lecture, ≈ 250 ms de `JSON.stringify`) ;
  - `/api/wants` : 63 à 86 ms.
- **Impact réel** : deux ou trois requêtes par seconde d'un anonyme suffisent à figer la synchronisation, la connexion et la vitrine. Le coût grandit chaque année d'historique.
- **Correction** :
  - une zone `limit_req` de clé `$http_cf_connecting_ip`, par exemple 2 r/s avec un burst de 10, sur `/api/histories`, `/api/wants` et `/api/auth/` ;
  - en option, garder en mémoire le dernier corps calculé par ETag.
- **Effort** : S

### P2-04. Une clé locale illisible devient une collection vide, qui est poussée sur le serveur

- **Sévérité** : P2 · **Type** : risque plausible · **Confiance** : haute pour le mécanisme, basse pour le déclencheur
- **Emplacement** :
  - `src/store/collection.ts:14-15` (`?? rules.emptyCollection()`) ;
  - `src/store/shopping.ts:17` ;
  - `src/lib/sync.ts:85-86` ;
  - `server/collection.ts:86-97`.
- **Explication** :
  - `loadCollection` et `loadShopping` remplacent un texte présent mais refusé par `readCollection` par un document vide, sans le signaler.
  - Si la clé `.sync` est intacte, `decide` voit `base.version === server.version` et `changedHere`, et répond `push` : le document vide remplace celui du serveur.
  - `keep()` ne garde au plus qu'une version remplacée par heure.
- **Scénario** : la clé `.collection` est retouchée (extension, outils du navigateur), ou une future version refuse une forme ancienne. La synchronisation part une seconde plus tard.
- **Impact réel** : perte de la collection ou des commandes sur tous les appareils, récupérable seulement à la main dans `collection_versions`, et jusqu'à une heure de modifications perdue.
- **Correction** : distinguer « absent » et « illisible ». Si c'est illisible :
  - garder le texte brut, exportable ;
  - lever le bandeau ;
  - passer la synchronisation en `refused`, sans rien envoyer ;
  - ne jamais tenir un document vide issu d'une erreur de lecture pour un effacement voulu.
- **Effort** : S

### P2-05. `/api/health` reste à 200 quand les prix sont figés

- **Sévérité** : P2 · **Type** : bug confirmé (lecture du code) · **Confiance** : haute
- **Emplacement** : `server/jobs/prices.ts:90-96` (« guide inchangé » : `return` sans erreur), `server/reference.ts:139-152`, `src/lib/jobs.ts:9-10`
- **Explication** : un `Last-Modified` inchangé termine la tâche comme une réussite. `/api/health` ne regarde que la date de la dernière réussite, jamais l'âge de `pricesDate`.
- **Scénario** : Cardmarket cesse de régénérer le fichier, ou abandonne l'adresse en laissant l'ancien. La tâche « réussit » toutes les 6 h, et la santé reste verte pendant des jours.
- **Impact réel** : des jours d'historique qui ne se rattraperont jamais (Cardmarket n'en garde pas). Cela contredit le README : un trou dans l'historique doit être signalé.
- **Correction** : dans `/health`, compter `prices` en retard si `readSource(data, 'cardmarket').date` a plus de 2 jours.
- **Effort** : XS

### P2-06. Une étape du schéma modifiée après son application est ignorée sans rien dire

- **Sévérité** : P2 · **Type** : bug confirmé (**survenu aujourd'hui** sur le poste de développement : « no such column: brotli ») · **Confiance** : haute
- **Emplacement** : `server/db.ts:295-308` (`migrate`) et la convention des lignes 8-9
- **Explication** : `migrate` ne regarde que `PRAGMA user_version`. `bun --watch` relance le serveur à chaque enregistrement de `db.ts`. Une étape enregistrée à moitié, valide en l'état, est appliquée et numérotée, et les lignes ajoutées ensuite ne passent jamais. De même, un `user_version` plus grand que le nombre d'étapes (code plus ancien redéployé) n'est pas signalé.
- **Preuve** : l'étape 13 a été appliquée sur `.data` sans sa colonne `brotli`. `serveSnapshot` et `saveSnapshot` levaient une erreur, et l'ingestion était en échec jusqu'à la commande corrective manuelle.
- **Impact réel** : une base incohérente et difficile à diagnostiquer, en développement. En production, seulement si un code plus ancien est redéployé.
- **Correction** :
  - garder l'empreinte (SHA-256) de chaque étape appliquée dans une table `schema_steps` ;
  - refuser de démarrer si une empreinte diffère, avec un message qui nomme l'étape ;
  - refuser aussi `user_version` supérieur au nombre d'étapes.
- **Effort** : S

### P2-07. La version de `/api/collection` n'est qu'un compteur : écrasement silencieux après une restauration

- **Sévérité** : P2 · **Type** : risque plausible · **Confiance** : haute pour la logique ; le cas est rare
- **Emplacement** : `server/collection.ts:65-69` (ETag `"v${version}"`), `:86-97` (garde `baseVersion`), `src/store/sync.ts:221-248`
- **Explication** : l'ETag et la garde supposent qu'un numéro désigne toujours le même document. Après une restauration de `app.db` (cas prévu par `decide`), les numéros sont réutilisés.
- **Scénario** :
  1. L'appareil A est en v45, avec des modifications pas encore envoyées.
  2. La base est restaurée en v40.
  3. L'appareil B résout le conflit, puis remonte jusqu'à v45 avec un autre contenu.
  4. A revient avec `If-None-Match: "v45"` : le serveur répond 304, `decide` dit `push`, et le PUT `baseVersion: 45` est accepté.
- **Impact réel** : les commandes de B sont écrasées sans question.
- **Correction** :
  - XS : dans la procédure de restauration du README, `UPDATE collections SET version = version + 1000`.
  - S : une époque ou une empreinte dans l'ETag et la garde (`"v45-<hash>"`).
- **Effort** : XS à S

### P2-08. Synchronisation : un 403, un 413 ou une exception s'affichent « Hors ligne », sans trace

- **Sévérité** : P2 · **Type** : bug confirmé (413 rejoué ; 403 et exceptions par lecture) · **Confiance** : haute
- **Emplacement** :
  - `src/store/sync.ts:181-190`, l. 187 : `if (!response.ok) return offline()` ;
  - `src/store/sync.ts:204-209` : `catch { offline() }` muet ;
  - `server/auth.ts:229-236` : le 403 de la macro n'est pas journalisé.
- **Explication** : `push` ne classe que 401, 409, 400 et 422. Le reste (403 d'origine, 413 de Bun ou de nginx au-delà de 5 Mo, exception de programmation, `crypto.subtle` absent hors https) devient « Le serveur ne répond pas », avec un nouvel essai toutes les 30 s, sans fin.
- **Scénario** : `BETTER_AUTH_URL` modifié par erreur (http ou https). Les GET passent, chaque PUT reçoit un 403. L'utilisateur voit « Hors ligne », et le serveur ne note rien.
- **Impact réel** : des modifications qui n'atteignent jamais le serveur, présentées comme une panne passagère et impossibles à diagnostiquer.
- **Correction** :
  - traiter 403 et 413 comme `refused`, avec un texte dédié ;
  - `console.error(error)` dans le `catch` de `sync()` ;
  - journaliser le 403 de la macro (route, origine reçue) ;
  - attraper le rejet de `hasUnsentChanges` et de `keepThisDevice`.
- **Effort** : S

### P2-09. `parseEuros` accepte une espace n'importe où : « 12 50 » est lu 1 250 €

- **Sévérité** : P2 · **Type** : bug confirmé (`bun -e` : `parseEuros('12 50') === 1250`, `parseEuros('1 2 3') === 123`) · **Confiance** : haute
- **Emplacement** : `src/lib/format.ts:99-103` ; tests `tests/input.test.ts:12-30`
- **Explication** : `text.replace(/[\s€]/g, '')` retire toutes les espaces, pas seulement les séparateurs de milliers. Les tests ne vérifient que des groupes de trois chiffres valides.
- **Impact réel** : une espace tapée au lieu d'une virgule multiplie le montant par 100.
  - Le prix payé et le budget n'ont aucune alerte (le formulaire de commande demande seulement une confirmation au-delà du plafond).
  - Cela contredit la règle « un montant mal lu fausserait le budget ».
- **Correction** : `^\d{1,3}( \d{3})*(\.\d{1,2})?$` après normalisation des espaces fines et insécables, ou aucune espace. Ajouter `'12 50' → null` aux tests.
- **Effort** : XS

### P2-10. L'écriture quotidienne de l'historique des prix n'a aucun test

- **Sévérité** : P2 · **Type** : risque plausible (couverture) · **Confiance** : haute
- **Emplacement** : `server/jobs/prices.ts:90-147` (couverture du fichier : 21,7 %)
- **Explication** : seuls les morceaux purs sont testés (`withPrice`, `splitYears`, `joinYears`, `historyReader`). Ce qui les assemble ne l'est pas :
  - relecture de l'année puis upsert ;
  - garde « moins de la moitié des prix d'avant » ;
  - tendance, sinon moyenne sur 30 jours ;
  - `0` lu comme « pas de prix » ;
  - filtre `SINGLES` ;
  - `sources` mis à jour dans la même transaction.
- **Scénario** : deux paramètres de `readYear.get(id, year)` inversés. `known` vaut alors `undefined`, et l'upsert remplace l'année de **chaque** carte par un seul prix. Les 132 tests restent verts.
- **Impact réel** : perte silencieuse d'un historique irremplaçable, avec 7 sauvegardes de `data.db` seulement.
- **Correction** : séparer le téléchargement de l'écriture (`savePriceGuide(db, guide, products)`), puis tester sur la base temporaire :
  - une année existante gardée et le jour ajouté ;
  - les autres ids intacts ;
  - une relance le même jour qui remplace le prix ;
  - la garde qui lève une erreur sans rien écrire ;
  - le repli sur la moyenne, et les produits scellés ignorés.
- **Effort** : S

### P2-11. Des trous dans les tests de la liste de référence (CLAUDE.md)

- **Sévérité** : P2 · **Type** : risque plausible (couverture) · **Confiance** : haute
- **Emplacement et explication** :
  - **Mise à jour d'une collection existante** (`server/collection.ts:86-97`, `keep`, réponse 400) : seule la branche `INSERT` (v0 → v1) est exécutée. Rien ne teste :
    - v1 → v2 puis un envoi parti de v1 → 409 ;
    - un `baseVersion` en avance (base restaurée : un `!==` changé en `>` passerait inaperçu) ;
    - un document invalide refusé sans écriture ;
    - la ligne gardée dans `collection_versions`.
  - **SQL de `/api/wants`** (`server/reference.ts:60-102`) : les tests fournissent `sameCard` et `expansions` à la main ; aucune requête n'est exécutée. Une erreur ferait **désigner une autre version, donc acheter une autre carte**.
  - **Route `/api/vitrine`** (`server/vitrine.ts:82-139`) : seules `shownCollection` et `vitrineSummary` sont testées. Une route qui lirait la collection brute rendrait publics les prix payés et les commandes.
  - **Quantité d'une ligne importée** (`src/lib/transfer.ts:148-153`) : aucun test négatif (`0`, `-1`, `1.5`, `"2"`).
- **Impact réel** : une régression de l'argent ou de la confidentialité passerait le build Docker, dont les tests sont la seule barrière.
- **Correction** :
  - ajouter ces cas, en réutilisant le serveur entier de `collection.test.ts` ;
  - pour `/wants`, quelques lignes dans `sets`, `cards` et `cardmarket_products` (Rebellion Crash 037 et 107, un produit retiré, deux séries « Beginning Set ») ;
  - pour la vitrine, un `GET` sans cookie : ni `paidPrice`, ni `ordered`, ni `shopping`, des prix limités aux cartes possédées.
- **Effort** : S (chaque bloc, XS à S)

### P2-12. Le contrat de l'API n'a pas de version, alors que le service worker garde les réponses pour toujours

- **Sévérité** : P2 · **Type** : risque plausible (latent) · **Confiance** : moyenne
- **Emplacement** :
  - `public/sw.js:38` (`DATA = 'donnees'`) et `:72` (`activate` ne supprime que les caches `app-*`) ;
  - `src/lib/api.ts:38-58` (`getJson<T>` : un simple cast) ;
  - `src/lib/card-catalog.ts:97-113, 155-171`.
- **Explication** : le cache `donnees`, clé par chemin, n'est jamais purgé. Il est servi après 4 s ou sur une erreur 5xx. Seuls les prix (`file?.cards`) et l'état des tâches (`status?.jobs`) vérifient la forme reçue.
- **Scénario** : un tuple positionnel change d'ordre (`CatalogRow`, `CatalogSetsFile.sets`), puis un réseau lent pendant un déploiement. Les champs sont décalés sans erreur, ou une page plante sur `.slice` de `undefined`.
- **Impact réel** : latent. Il apparaîtra au premier changement de forme, précisément dans l'usage hors ligne voulu.
- **Correction** :
  - une constante `API_FORMAT` dans `src/config`, injectée dans `sw.js` comme `__PRECACHE__`, qui nomme le cache (`donnees-${API_FORMAT}`) ;
  - la même constante dans `TAGGED_FORMAT` ;
  - au-dessus des types de réponses de `types.ts`, la règle : changer une forme, c'est augmenter ce nombre.
- **Effort** : S

### P2-13. Service worker : un échec d'écriture du cache fait échouer la réponse

- **Sévérité** : P2 · **Type** : risque plausible · **Confiance** : moyenne
- **Emplacement** : `public/sw.js:137-143` (`kept`), `:190-200` (`image`), et le tri des images, lancé seulement après 100 ajouts dans une même vie du service worker
- **Explication** : `await cache.put(...)` est attendu dans la promesse passée à `respondWith`. Un `QuotaExceededError` la rejette, et la page reçoit une erreur réseau alors que le réseau avait répondu. Le compteur `added` repart à 0 à chaque réveil, si bien que le cache peut dépasser les 3 000 images prévues.
- **Scénario** : un téléphone presque plein. Les morceaux de `/assets/` ne se chargent plus, et la page d'erreur revient même après un rechargement.
- **Impact réel** : une interface bloquée, sans explication.
- **Correction** :
  - `try { await put } catch {}`, ou `event.waitUntil(put)` sans l'attendre ;
  - trier en comptant `cache.keys()` toutes les N écritures, ou à l'activation.
- **Effort** : XS

### P2-14. Un déploiement peut mettre le site hors ligne, sans filet

- **Sévérité** : P2 · **Type** : risque plausible · **Confiance** : haute
- **Emplacement** : `Dockerfile:34-37`, `.github/workflows/deploy.yml:30-48`
- **Explication** :
  - `nginx.conf` n'est jamais validé au build. Une faute ne se voit qu'après `up -d`, une fois l'ancien conteneur remplacé.
  - Aucun contrôle après le déploiement.
  - `docker image prune -f` supprime l'image précédente, d'où aucun retour arrière rapide.
  - `appleboy/ssh-action` coupe la commande au bout de 10 min par défaut.
  - ESLint et knip ne tournent jamais.
- **Scénario** : une faute de frappe dans `nginx.conf`. Le conteneur `web` redémarre en boucle, et le site renvoie 502 partout jusqu'à une correction manuelle sur le VPS.
- **Impact réel** : une panne. La promesse « l'ancien conteneur reste en ligne » ne couvre que les échecs de build.
- **Correction** :
  - `RUN nginx -t` dans l'étape `web` ;
  - `command_timeout: 30m` dans le workflow ;
  - en fin de script, `curl -fsS localhost:8080/ && curl -fsS localhost:8080/api/account` ;
  - des images étiquetées par commit, pour revenir en arrière ;
  - `bun lint` dans l'étape de test (P3-B4).
- **Effort** : S

### P2-15. Copie des sauvegardes hors du VPS : croissance sans fin et fichiers partiels

- **Sévérité** : P2 · **Type** : bug confirmé (la procédure) ; ampleur non chiffrée · **Confiance** : haute pour le mécanisme, moyenne pour l'ampleur
- **Emplacement** : `README.md:233-246` (crontab, `rclone copy`), `server/jobs/backups.ts:24-32, 50-55`
- **Explication** :
  - `./sauvegardes` n'est jamais purgé, et `rclone copy` ne supprime rien : un `app-*.db` et un `data-*.db.gz` de plus chaque jour, sur le disque des bases.
  - `VACUUM INTO` et le gzip écrivent directement sous le nom final. L'heure de la sauvegarde dérive chaque jour : la copie de 4 h 30 finira par emporter une base tronquée ou le `data-*.db` temporaire non compressé.
  - Aucun contrôle d'intégrité.
- **Impact réel** : un disque plein fait échouer les écritures SQLite (historique perdu, synchronisation impossible). Ou bien une sauvegarde inutilisable, sans le savoir.
- **Correction** :
  - écrire dans `*.tmp`, puis renommer ;
  - `PRAGMA quick_check` sur le fichier produit ;
  - vider le dossier de transfert avant la copie ;
  - une rétention côté stockage distant ;
  - documenter la restauration de `data.db` (gunzip, `-wal` et `-shm`, propriétaire des fichiers).
- **Effort** : S

### P2-16. Le focus est perdu quand une action fait disparaître son propre bouton

- **Sévérité** : P2 · **Type** : bug confirmé (lecture du code de camply et de react-dom) · **Confiance** : haute
- **Emplacement** :
  - `src/pages/pokedex/PokedexToolbar.tsx:307-321` (Tag `onRemove`, « Réinitialiser ») ;
  - `src/pages/pokedex/PokedexPage.tsx:94-101` ;
  - `src/components/CardFilters.tsx:93-97` ;
  - `src/pages/catalog/CatalogPage.tsx:218-224` ;
  - `src/pages/shopping/WishlistPanel.tsx:269-278` ;
  - `src/pages/data/ImportSection.tsx:131-135`, `EraseSection.tsx:28-50`, `MissingImages.tsx:197`.
- **Explication** : le bouton cliqué est démonté, ou désactivé (« Effacer » quand `cards === 0`). Après une confirmation, camply rend le focus par `e?.focus?.()` à un élément détaché ou désactivé, ce qui ne fait rien. Le focus tombe sur `body`.
- **Scénario** : Pokédex, filtre « Type Feu », Tab jusqu'à « Réinitialiser », Entrée : `document.activeElement === body`, et le Tab suivant repart du haut de la page.
- **Impact réel** : l'utilisateur au clavier ou au lecteur d'écran perd sa position (WCAG 2.4.3). Cela tranche avec le soin apporté ailleurs (`keepFocusInList`, `focusFirstError`).
- **Correction** : un utilitaire `focusAfter(action, cible)` (un `flushSync`, puis le focus) dans `lib/focus.ts`, à côté de `keepFocusInList`. Cibles : le champ de recherche de la page, ou le titre du panneau (`Panel titleRef`).
- **Effort** : S

---

## 8. Problèmes P3

Chaque problème donne son type, sa confiance, son emplacement, le constat avec sa preuve, l'impact, la correction et l'effort. Les P3 sont regroupés par domaine.

### 8.1 Sécurité

**P3-S1. Fenêtre de première visite : la garde de création repose sur une adresse e-mail, qui n'est pas un secret, et ses refus ne sont pas freinés** (Claude Security F2 et F3)
- **Type** : risque plausible · **Confiance** : moyenne · **Effort** : S
- **Emplacement** : `server/auth.ts:101` (`bodyOf`, toujours `request.json()`), `:174` (lecture de l'e-mail), `:184` (comparaison avec `ACCOUNT_EMAIL`), `:197` (403 avant `auth.handler`, l. 200)
- **Constat** :
  - Tant qu'aucun compte n'existe (déploiement neuf, `app.db` remise à zéro), qui connaît ou devine `ACCOUNT_EMAIL` crée le seul compte.
  - La garde lit le corps en JSON, alors que Better Auth accepte aussi `x-www-form-urlencoded` sur `/sign-up/email` (vérifié : `better-auth/dist/api/routes/sign-up.mjs:30`, `better-call/dist/utils.mjs`). Un corps polyglotte peut donc faire contrôler une adresse et en enregistrer une autre.
  - Les mauvaises adresses reçoivent un 403 sans limite.
- **Impact** : le propriétaire est bloqué jusqu'à une intervention manuelle sur `app.db`. Aucune donnée privée n'est exposée, puisque le compte est encore vide.
- **Correction** :
  - refuser tout `Content-Type` autre que `application/json` sur `/sign-up/email` avant la garde ;
  - faire porter la garde sur la valeur réellement enregistrée (`databaseHooks.user.create.before`) ;
  - freiner les refus (P2-02) ;
  - un jeton de mise en service reste l'option la plus sûre, mais un code a été retiré à votre demande : ce choix vous revient.

**P3-S2. La macro `auth` s'exécute après la lecture et la validation du corps**
- **Type** : bug confirmé (rejoué) · **Confiance** : haute · **Effort** : S
- **Emplacement** : `server/auth.ts:227-240`, `server/collection.ts:129-136`
- **Constat** : `PUT /api/collection` depuis `https://evil.example`, avec `{}`, reçoit **422** et non 403, et la réponse renvoie l'entrée telle quelle (`found`). Un `POST /api/journal` de 4 Mo d'une autre origine n'est refusé qu'après sa lecture complète. Avec un corps valide, on obtient bien 403 ou 401 : pas de contournement CSRF.
- **Impact** : un anonyme fait analyser jusqu'à 5 Mo de JSON et reçoit l'écho de ce qu'il a envoyé. Faible.
- **Correction** : contrôler l'origine dans un `onRequest` ou un `transform` local au plugin, avant l'analyse du corps.

**P3-S3. Service worker : la réponse partagée au démarrage peut être périmée après un rechargement rapide**
- **Type** : risque plausible · **Confiance** : moyenne · **Effort** : XS
- **Emplacement** : `public/sw.js:49-52, 98-109`
- **Constat** : `/api/account?demarrage` est gardé 10 s, avec l'URL seule pour clé. Un rechargement dans les 10 s qui suivent une déconnexion ou une connexion peut recevoir la réponse d'avant.
- **Impact** : surtout de l'ergonomie : un 401 « Reconnectez-vous », ou un renvoi à tort vers `/connexion`. Sur un appareil partagé, le pseudo du compte précédent réapparaît brièvement.
- **Correction** : clé `${event.clientId || event.resultingClientId}|${url}`, ou durée ramenée à environ 2 s.

**P3-S4. Pokédex public : l'objet `image` d'une carte est recopié tel quel**
- **Type** : recommandation · **Confiance** : haute · **Effort** : XS
- **Emplacement** : `server/vitrine.ts:171-174`, `src/lib/transfer.ts:142-143`
- **Constat** : `shownCollection` reconstruit chaque carte champ par champ, sauf `image`. `isCard` laisse passer toute clé en plus de `small` et `large`.
- **Impact** : une clé ajoutée à `CardImage`, ou un fichier importé retouché, deviendrait public sans que `tests/vitrine.test.ts` le voie.
- **Correction** : `image: image && { small: image.small, large: image.large }`, et un test avec une clé en trop.

**P3-S5. Le serveur de développement écoute sur toutes les interfaces**
- **Type** : risque plausible · **Confiance** : moyenne · **Effort** : XS
- **Emplacement** : `server/index.ts:26` (`.listen(Number(process.env.PORT ?? 3000))`)
- **Constat** : Bun écoute sur `0.0.0.0`. En développement, `ACCOUNT_EMAIL` est facultatif, il n'y a pas de limite de tentatives, et OpenAPI est actif.
- **Impact** : sur un Wi-Fi public, l'API et `.data/app.db` sont exposées (création du compte si elle n'est pas faite). Le pare-feu Windows atténue en partie.
- **Correction** : `listen({ port, hostname: process.env.HOST ?? '127.0.0.1' })`, et `HOST: 0.0.0.0` pour le service `server` de `compose.yaml`.

**P3-S6. Le journal note l'e-mail saisi, et masque les avertissements de Better Auth**
- **Type** : recommandation · **Confiance** : haute · **Effort** : XS
- **Emplacement** : `server/auth.ts:174-177, 127` ; logger `level: 'error'` (l. 40-46)
- **Constat** : un mot de passe collé par erreur dans le champ e-mail atterrit en clair au journal (coupé à 200 caractères). Les avertissements « secret trop court » ou « faible entropie » de Better Auth (`create-context.mjs:44-45`) sont masqués.
- **Impact** : fuite possible d'un mot de passe dans les journaux, et un secret faible qui passe inaperçu.
- **Correction** : écrire `email=?` si la valeur n'a pas de `@`, et laisser passer les `warn` au démarrage.

**P3-S7. Pas d'en-tête HSTS côté nginx**
- **Type** : recommandation · **Confiance** : moyenne (la configuration Cloudflare n'est pas visible) · **Effort** : XS
- **Emplacement** : `deploy/security-headers.conf`
- **Constat** : le TLS se termine chez Cloudflare. Sans HSTS, une première visite en http reste interceptable.
- **Impact** : faible si « Always Use HTTPS » est actif chez Cloudflare.
- **Correction** : `add_header Strict-Transport-Security "max-age=31536000" always;`, ou l'option Cloudflare.

**P3-S8. Durcissement des conteneurs et de la clé de déploiement**
- **Type** : recommandation · **Confiance** : haute · **Effort** : S
- **Emplacement** : `compose.yaml:5-55`, `Dockerfile:34`, `.github/workflows/deploy.yml`
- **Constat** :
  - ni `read_only`, ni `cap_drop: [ALL]`, ni `no-new-privileges` ;
  - le processus maître de nginx tourne en root ;
  - aucun `HEALTHCHECK` ni `mem_limit` (la tâche des prix lit deux gros fichiers JSON en parallèle) ;
  - la clé SSH donne un shell complet à un membre du groupe `docker`, ce qui équivaut à root ;
  - les lignes d'`ingest` n'ont pas d'horodatage.
- **Impact** : une compromission serait plus large que nécessaire.
- **Correction** :
  - ajouter les trois options de sécurité, avec un `tmpfs` pour `/tmp` ;
  - un healthcheck sur `/api/account` ;
  - `mem_limit` ;
  - `restrict,command="…/deploy.sh"` dans `authorized_keys` ;
  - un « Environment » GitHub avec un relecteur ;
  - lire les journaux avec `docker compose logs -t`.

**P3-S9. `.env.production` n'est ignoré par aucun des deux fichiers d'exclusion**
- **Type** : recommandation (vérifié avec `git check-ignore`) · **Confiance** : haute · **Effort** : XS
- **Emplacement** : `.gitignore:13`, `.dockerignore:7`
- **Constat** : seul `.env` est ignoré. Les images restent saines grâce aux `COPY` sélectifs.
- **Impact** : un `.env.production` ajouté par erreur pourrait être commité.
- **Correction** : `.env*`, avec `!.env.example`.

### 8.2 API, serveur et ingestion

**P3-A1. `/api/wants` : un `metacard` NULL fait échouer toute la demande en 500**
- **Type** : risque plausible (lu) · **Confiance** : moyenne · **Effort** : XS
- **Emplacement** : `server/reference.ts:60-63` (requête `product`, sans filtre sur `metacard`), `:89-99` (`group.find(…)!.number`), `server/db.ts:176` (colonne qui accepte NULL)
- **Constat** :
  - Un produit dont la `metacard` est NULL : `products.metacard = NULL` ne ramène rien, et le `!` lève une erreur.
  - Une fenêtre réelle existe : les lignes antérieures à l'ajout de la colonne gardent `expansion` mais pas `metacard`, jusqu'au passage suivant des prix.
  - Il en va de même si Cardmarket envoie un jour `idMetacard: null` (`ProductList` est castée sans contrôle).
- **Impact** : « Copier pour Cardmarket » échoue pour toute la commande.
- **Correction** : `AND metacard IS NOT NULL` dans `product`. La carte retombe alors dans « pas de ligne sûre ».

**P3-A2. La longueur de la ligne de requête est bornée par nginx (8 Ko), pas par la doc**
- **Type** : recommandation · **Confiance** : haute · **Effort** : XS
- **Emplacement** : `deploy/nginx.conf` (pas de `large_client_header_buffers`), `server/reference.ts:226` (`idsPattern(2000)`), `docs/prix.md:49-56, 128-133`
- **Constat** :
  - 1 025 ids de 7 chiffres font 8 218 caractères, refusés par nginx (414) alors que Bun les accepte.
  - Les « 2 000 ids » de `/wants` sont inatteignables au-delà d'environ 1 150 ids de 6 chiffres.
  - Le commentaire de `proxy_buffers 128 8k` (1 Mo) promet une réponse sans disque, alors que celle des historiques fait environ 4 Mo.
- **Impact** : des 414 inattendus sur les plus grosses demandes.
- **Correction** : `large_client_header_buffers 4 16k;`, aligner la limite de `/wants` et la doc sur 1 025, et corriger le commentaire.

**P3-A3. Petites fragilités d'ETag**
- **Type** : risque plausible · **Confiance** : moyenne · **Effort** : XS
- **Emplacement** : `server/snapshots.ts:74-89`, `server/vitrine.ts:100-106`, `server/reference.ts:108-111`
- **Constat** :
  - `serveSnapshot` lit l'ETag puis le corps en deux requêtes : une écriture de l'ingestion entre les deux étiquette le corps neuf avec l'ancien ETag (cela se corrige seul à la requête suivante). La vitrine a le même décalage entre version et collection.
  - `pricesTag` repose sur `stamp|date`, qui serait identique pour deux guides du même jour sans `Last-Modified`.
- **Impact** : une copie un peu ancienne gardée une requête de trop.
- **Correction** : une seule requête (`SELECT etag, CASE WHEN etag = ? THEN NULL ELSE body END`), et `guide.createdAt` complet dans le tampon.

**P3-A4. `inTurn` peut dépasser `MAX_COPIES`**
- **Type** : bug confirmé (simulation : pic à 5 pour une limite de 4) · **Confiance** : haute · **Effort** : XS
- **Emplacement** : `server/images.ts:112-121`
- **Constat** : `copying--` passe avant la reprise de l'attente. Un nouvel appel dans la même rafale de microtâches prend la place, et la requête reprise s'y ajoute.
- **Impact** : faible, puisque nginx limite déjà le débit des copies.
- **Correction** : transmettre la place sans décrémenter : `const next = queued.shift(); if (next) next(); else copying--`, et n'incrémenter que si l'appel n'a pas attendu.

**P3-A5. Catalogue : une page sans `cartes` échappe à la garde « format changé »**
- **Type** : risque plausible · **Confiance** : moyenne · **Effort** : XS
- **Emplacement** : `server/jobs/catalog.ts:405-409` (garde aux lignes 375-380)
- **Constat** : si le champ est renommé, chaque série fait `continue`. La tâche réussit (« 0 séries relues »), `read_at` n'est pas mis à jour, et tout est relu chaque jour, à 3 s par série.
- **Impact** : un catalogue figé, sans signal.
- **Correction** : compter les pages vides de séries connues, et lever une erreur au-delà de la moitié.

**P3-A6. La cause d'un échec de tâche n'est jamais montrée**
- **Type** : recommandation · **Confiance** : haute · **Effort** : S
- **Emplacement** : `server/ingest.ts:55-66, 100-103`, `server/reference.ts:49-53`
- **Constat** : `runs.message` est écrit mais lu nulle part ; la page Données dit « En échec » sans dire pourquoi. Une reprise ratée des anciens prix met la tâche `prices` de côté jusqu'au redémarrage, sans ligne dans `runs`.
- **Impact** : il faut lire les journaux Docker (30 Mo) pour comprendre un échec.
- **Correction** : exposer le dernier message dans une route du compte (pas dans `/api/status`, qui est publique).

**P3-A7. Petits silences du serveur**
- **Type** : recommandation · **Confiance** : haute · **Effort** : XS chacun
- **Emplacement et correction** :
  - `server/images.ts:87-90` : un `.tmp` reste quand l'écriture échoue, ce qui aggrave un disque plein ; le retirer dans un `finally` ;
  - `server/collection.ts:77-84` : « ne passe pas les contrôles », sans dire lequel ; nommer la règle (le client pourrait l'afficher en état `refused`).

**P3-A8. Données PokéAPI : un `!` et un `as` laissent passer `null` ou un type inconnu**
- **Type** : risque plausible · **Confiance** : moyenne · **Effort** : XS
- **Emplacement** : `server/jobs/species.ts:60, 68-69, 74`
- **Constat** : `firstName(…)!` enregistre `names.fr: null`, et `type.name as PokemonTypeId` accepte un type absent de `POKEMON_TYPES`.
- **Impact** : à l'ajout d'une génération, quand PokéAPI n'a pas encore les noms français, le client plante partout (`.toLowerCase()` de la recherche).
- **Correction** : lever une erreur dans `normalize`. La tâche échoue, et l'instantané précédent reste.

### 8.3 Client : synchronisation, données, navigation

**P3-C1. Faux conflit après un envoi réussi dont la réponse s'est perdue**
- **Type** : bug confirmé (logique) · **Confiance** : haute · **Effort** : S
- **Emplacement** : `src/store/sync.ts:179-194`, `src/lib/sync.ts:84-87`
- **Constat** : le PUT est enregistré (v+1), mais la réponse se perd (délai de 15 s). La base reste à v. À la modification suivante, `decide` voit le serveur à v+1 et un changement local, et répond `conflict`.
- **Impact** : une question inutile ; choisir « celle du serveur » perdrait la dernière modification.
- **Correction** : garder l'empreinte de l'envoi en cours, et traiter `server.hash === envoi` comme la base.

**P3-C2. Un conflit reste ouvert dans les autres onglets**
- **Type** : risque plausible · **Confiance** : moyenne · **Effort** : S
- **Emplacement** : `src/store/sync.ts:201-202, 247, 270-276`
- **Constat** : l'état `conflict` vit en mémoire, onglet par onglet. Une fois le conflit résolu dans A, « Garder celle du serveur » dans B réapplique l'ancien `conflict.document`. Hors ligne, cela écrase les modifications faites dans A.
- **Impact** : perte de modifications, dans un cas étroit.
- **Correction** : fermer la fenêtre quand la clé `.sync` change, et vérifier dans `keepServer` que la base n'a pas bougé.

**P3-C3. Changement de mot de passe : une session expirée est présentée comme un mauvais mot de passe**
- **Type** : bug confirmé (Better Auth 1.7.10 : 400 pour un mauvais mot de passe, 401 sans session) · **Confiance** : haute · **Effort** : XS
- **Emplacement** : `src/pages/data/AccountSection.tsx:79-84` (et 44-48 pour le pseudo)
- **Constat** : une connexion sur le téléphone ferme la session de l'ordinateur (une seule session). Sur l'ordinateur, le bon mot de passe actuel donne alors « Mot de passe actuel incorrect. ».
- **Impact** : sans « mot de passe oublié », l'utilisateur peut croire son mot de passe perdu.
- **Correction** : 401 → « Session expirée : reconnectez-vous », avec un lien `loginPath(...)`.

**P3-C4. Les réponses gardées en mémoire s'accumulent, et les prix d'un onglet ouvert plusieurs jours ne sont jamais rafraîchis**
- **Type** : recommandation · **Confiance** : moyenne · **Effort** : S
- **Emplacement** : `src/lib/api.ts:29-59`, `src/store/prices.ts:50-70`
- **Constat** : `requests` garde chaque série, chaque liste `/selection` et chaque historique ouvert pour la vie de la page. `known` garde les prix, et `prices.date` reste celle du premier jour.
- **Impact** : la mémoire de l'app installée grossit, et elle affiche des prix d'avant-hier.
- **Correction** : une limite (LRU) ou `forget` au démontage pour les grosses réponses, et vider `known` au retour sur la page si `prices.date` est antérieure au jour.

**P3-C5. Position perdue en revenant au Pokédex par un lien après un rechargement**
- **Type** : bug confirmé (lecture du code) · **Confiance** : moyenne · **Effort** : S
- **Emplacement** : `src/pages/pokedex/PokedexPage.tsx:45-49`, `src/components/AppShell.tsx:262-267`
- **Constat** : un premier montage par lien ne dessine que 60 pochettes. La position gardée dans `sessionStorage` est ramenée à leur hauteur.
- **Impact** : il faut redescendre dans la liste.
- **Correction** : tout dessiner quand une position est gardée pour cette clé, ou restaurer la position après le second rendu.

**P3-C6. Le stockage n'est relu que superficiellement : une collection refusée par le serveur ne se réimporte pas**
- **Type** : risque plausible · **Confiance** : moyenne · **Effort** : S
- **Emplacement** : `src/lib/transfer.ts:67-91` (`as unknown as`), `src/store/collection.ts:14-15`, `src/components/AccountMenu.tsx:52`
- **Constat** : une donnée enregistrée avant une règle passe la relecture du stockage, mais reçoit un 400 au PUT. Le menu conseille alors « exportez-la », mais `parseImport` applique le même `readable` : l'export ne se réimporte pas. De plus, `...value` garde des champs anciens que le commentaire dit ignorés.
- **Impact** : une impasse pour l'utilisateur.
- **Correction** : en état `refused`, appeler `readDocument(currentDocument())` côté client pour nommer la règle en échec, et documenter la relecture superficielle (`readStoredCollection`).

### 8.4 React, accessibilité, UX et performance de rendu

**P3-R1. Retour au Pokédex : le focus va à `<main>`, pas à la pochette ouverte**
- **Type** : recommandation · **Confiance** : haute · **Effort** : S
- **Emplacement** : `src/components/AppShell.tsx:143-147`, `src/hooks/useFollowLinks.ts`, `src/pages/catalog/CardDetails.tsx:89-93`
- **Constat** : l'`<Activity>` garde le défilement, mais au clavier il faut retraverser toute la page. Dans le catalogue, après ← et →, le focus revient à la première tuile ouverte.
- **Impact** : le gain « même position » ne profite qu'à la souris.
- **Correction** : mémoriser le dernier lien suivi dans `useFollowLinks`, et le focaliser au retour avec `preventScroll`.

**P3-R2. La marque « tamponnée » se rejoue à chaque retour et à chaque filtre**
- **Type** : bug confirmé (spécification CSS Animations, `display:none` → visible) · **Confiance** : haute · **Effort** : XS
- **Emplacement** : `src/components/PossessionMark.tsx:106-115`, `PossessionMark.module.css:17-19`
- **Constat** : la classe `.stamp` reste après un changement de statut. L'Activity cachée et les `hidden` des filtres relancent l'animation à chaque réapparition.
- **Impact** : cosmétique, et contraire à `docs/interface.md`.
- **Correction** : `onAnimationEnd={() => setShown({ status, changed: false })}`.

**P3-R3. Saut de mise en page au premier affichage du Pokédex**
- **Type** : bug confirmé (lecture du code) · **Confiance** : haute · **Effort** : XS
- **Emplacement** : `src/components/PokedexGrid.tsx:146-148, 163`, `src/pages/pokedex/PokedexPage.tsx:46-49`
- **Constat** : 60 entrées d'une seule génération, donc pas d'intertitre. Le rendu différé ajoute ensuite « Kanto génération I » au-dessus des pochettes déjà peintes (environ 4rem de décalage).
- **Impact** : un décalage visuel (CLS) juste après l'affichage.
- **Correction** : calculer le nombre de groupes depuis `visible`, dans `PokedexPage`.

**P3-R4. Le nombre de résultats n'est pas annoncé dans le catalogue et les fenêtres de choix**
- **Type** : recommandation (WCAG 4.1.3) · **Confiance** : haute · **Effort** : XS
- **Emplacement** : `src/pages/catalog/CatalogPage.tsx:213-217`, `src/pages/pokemon/CatalogPicker.tsx:292-300`, `src/pages/catalog/SetPicker.tsx:479-485`
- **Constat** : le Pokédex et la liste d'achats annoncent leur décompte via `aria-live`, pas ces trois vues.
- **Impact** : avec un lecteur d'écran, on n'apprend « aucune extension » que visuellement.
- **Correction** : `aria-live="polite"`, présent dès le premier rendu, et un décompte dans `SetList`.

**P3-R5. La mémoïsation de `CatalogTile` ne sert à rien dans la fenêtre d'ajout ; `useWanted` s'abonne trop largement**
- **Type** : bug confirmé (performance) · **Confiance** : haute · **Effort** : S
- **Emplacement** : `src/pages/pokemon/CatalogPicker.tsx:310` (`onPick={() => onPick(card)}`), `src/pages/pokemon/CardForm.tsx:68-73`, `src/store/prices.ts:107-111`
- **Constat** : une nouvelle fonction est créée à chaque rendu, alors que le commentaire de `CatalogTile` l'interdit. Les 60 à 382 tuiles se redessinent à chaque sélection, filtre ou arrivée de prix. `useWanted` s'abonne à toute la collection, même quand des `ids` sont fournis.
- **Impact** : des rendus inutiles, sensibles sur téléphone.
- **Correction** : passer `onPick={onPick}`, stabiliser `pick` avec `useEffectEvent`, et utiliser le sélecteur `(s) => (ids ? null : s.collection)`.

**P3-R6. Contraste insuffisant du badge « Reçue » en thème clair**
- **Type** : bug confirmé (WCAG 1.4.3, calculé : 4,43:1 sur le fond, 4,16:1 sur `surface-2`) · **Confiance** : moyenne · **Effort** : XS
- **Emplacement** : `src/styles/theme.css:161-164`, `src/pages/shopping/OrdersPanel.tsx:113`
- **Constat** : badge de 12 px en graisse 600, sous le seuil de 4,5:1.
- **Impact** : lisibilité réduite pour les malvoyants.
- **Correction** : `--camply-success: #036c4e` en clair (5,17:1 sur le fond).

**P3-R7. Des attentes sans aucun retour visible**
- **Type** : recommandation · **Confiance** : haute · **Effort** : S
- **Emplacement** : `src/router.tsx:138-164`, `src/pages/pokemon/CardActions.tsx:141-145`, `src/components/AccountMenu.tsx:125-131`, `src/pages/catalog/CatalogPage.tsx:80-89`
- **Constat** :
  - pages chargées à la demande sans indicateur `useNavigation` ;
  - « Modifier la carte » : `<Suspense>` sans fallback, et module non préchargé ;
  - « Se déconnecter » attend jusqu'à 15 s sans signal ;
  - « Catalogue indisponible » sans « Réessayer ».
- **Impact** : l'interface semble figée sur un réseau lent.
- **Correction** : une barre fine ou `aria-busy` pendant la navigation, précharger `CardForm` au repos, un état « en cours » pour la déconnexion, et « Réessayer » (`forget`).

**P3-R8. « Annuler » difficile à atteindre au clavier dans les 12 s**
- **Type** : risque plausible (WCAG 2.2.1) · **Confiance** : moyenne · **Effort** : S
- **Emplacement** : `src/hooks/useNotify.ts:59-76`
- **Constat** : les toasts sont en portail, à la fin de `body`.
- **Impact** : au clavier, le délai expire avant qu'on atteigne le bouton.
- **Correction** : Ctrl+Z tant qu'un toast d'annulation est affiché, ou garder ouvert un toast qui porte une action.

**P3-R9. `RarityIcon` mémorise l'échec par position, pas par icône**
- **Type** : bug confirmé (mineur) · **Confiance** : moyenne · **Effort** : XS
- **Emplacement** : `src/components/CatalogIcons.tsx:118-130`
- **Constat** : `missing` est un booléen. Dans `CardDetails`, la carte suivante affiche le nom de sa rareté sans essayer son icône.
- **Impact** : des icônes manquantes à tort.
- **Correction** : `useState<string | null>`, comparé à `rarityIcon(rarity.id)`.

### 8.5 Build, déploiement et exploitation

**P3-B1. Service worker : précache fragile, et onglets restés ouverts cassés après un déploiement**
- **Type** : risque plausible · **Confiance** : moyenne · **Effort** : S
- **Emplacement** : `public/sw.js:54-62` (`cache.add(url).catch(() => {})`, puis `skipWaiting`), `:64-77`, `src/main.tsx:30` (échec d'enregistrement avalé), `public/manifest.webmanifest` (pas d'`id`)
- **Constat** :
  - une installation partielle fait perdre le démarrage hors ligne jusqu'au prochain `sw.js` modifié ;
  - l'ancien cache `app-*` est supprimé, et un onglet ancien qui charge une page à la demande reçoit un 404, puis `ErrorPage`.
- **Impact** : le hors-ligne n'est pas garanti, contrairement à ce que dit le README, et une page d'erreur apparaît après chaque déploiement.
- **Correction** : faire échouer l'installation si `/index.html` manque, recharger une fois sur `vite:preloadError`, un `console.warn` à l'enregistrement, et `"id": "/"`.

**P3-B2. Le plugin `precache` de Vite manque de robustesse, et `sw.js` n'est ni typé ni analysé**
- **Type** : recommandation · **Confiance** : haute · **Effort** : XS
- **Emplacement** : `vite.config.ts:24-26, 42-45`, `eslint.config.js`
- **Constat** :
  - `join(config.root, outDir)` est faux si `outDir` est absolu ;
  - le remplacement de `self.__PRECACHE__` n'est pas vérifié : un marqueur absent donne `PRECACHE = []` sans erreur ;
  - la chaîne de remplacement interprète `$&` ;
  - `public/**/*.js` échappe à ESLint et à TypeScript.
- **Impact** : une régression du hors-ligne passerait sans erreur de build.
- **Correction** : `resolve`, une erreur si le marqueur n'apparaît pas exactement une fois, `.replace(marker, () => json)`, et `// @ts-check` ou un bloc ESLint.

**P3-B3. Les variables d'environnement sont mal documentées et contrôlées**
- **Type** : recommandation · **Confiance** : haute · **Effort** : XS
- **Emplacement** : `server/index.ts:15-21`, `compose.yaml:19-20`, `README.md:86-90`
- **Constat** :
  - `PORT`, `BACKUP_DIR`, `IMAGES_DIR` et `DATA_DIR` ne sont documentées nulle part ;
  - `PORT` est figé à 3000 dans nginx ;
  - `BETTER_AUTH_URL` en `http://` en production n'est pas refusé (cookies non sécurisés, chaque écriture en 403 : voir P2-08) ;
  - compose parle de « deux secrets » pour trois variables exigées.
- **Impact** : une mauvaise configuration silencieuse.
- **Correction** : un tableau dans `docs/deploiement.md`, exiger `https:` en production, et corriger le commentaire.

**P3-B4. Lint et code mort ne tournent qu'à la main ; `knip --production` est mal configuré**
- **Type** : recommandation (la configuration est fautive, c'est confirmé) · **Confiance** : haute · **Effort** : XS
- **Emplacement** : `Dockerfile:11` (`bun test && bun run build`), `knip.json:3`
- **Constat** :
  - aucune CI au push, et le build Docker ne lance pas `bun lint` ;
  - les entrées knip n'ont pas de `!`, et `server/ingest.ts` manque.
- **Impact** : une régression de lint ou du code mort peut partir en production.
- **Correction** : `RUN bun test && bun lint && bun run build`, et `"entry": ["server/index.ts!", "server/ingest.ts!", "public/sw.js!"]`.

**P3-B5. L'image du serveur installe les dépendances du front**
- **Type** : recommandation (vérifié sur le graphe des imports) · **Confiance** : haute · **Effort** : XS
- **Emplacement** : `package.json:17-27`, `Dockerfile:19`
- **Constat** : `bun install --production` installe `react`, `react-dom`, `react-router`, `zustand`, `@camply/ui` et `@fontsource/*`, que le serveur n'importe jamais.
- **Impact** : une image plus lourde, et une surface plus large.
- **Correction** : passer ces paquets en `devDependencies` (l'étape de build installe tout).

**P3-B6. Dépendances**
- **Type** : recommandation · **Confiance** : haute · **Effort** : XS
- **Constat** : better-auth 1.7.11 est un correctif (lire le changelog). Rester en TypeScript 6 tant que typescript-eslint ne prend pas en charge la 7. @types/node 26 est sans risque. `bun audit` est propre.
- **Correction** : mettre à jour better-auth, et suivre typescript-eslint.

**P3-B7. Les tests ne protègent que l'image `web`**
- **Type** : risque plausible · **Confiance** : moyenne · **Effort** : XS
- **Emplacement** : `Dockerfile:6-30`
- **Constat** : l'étape `server` ne dépend pas de l'étape qui lance `bun test`. Un `docker compose run --rm ingest …` (README) pourrait donc utiliser une image non testée sur la base irremplaçable.
- **Impact** : du code non testé qui touche la base.
- **Correction** : `COPY --from=build /app/package.json /tmp/.tested` dans l'étape `server`.

### 8.6 TypeScript

**P3-T1. Les instantanés des espèces ne sont pas typés à l'écriture**
- **Type** : recommandation · **Confiance** : haute · **Effort** : XS
- **Emplacement** : `server/jobs/species.ts:107-108`, `server/snapshots.ts:18` (`data: unknown`)
- **Constat** : renommer la clé `species` ne serait pas détecté. Eden n'est pas recommandé : 11 routes sur 15 rendent une `Response` brute.
- **Correction** : ajouter `satisfies SpeciesFile` et `satisfies SpeciesDetailsFile` aux deux appels.

**P3-T2. `Plan<T>` perd l'invariant « carte avec un prix »**
- **Type** : recommandation · **Confiance** : haute · **Effort** : XS à S
- **Emplacement** : `src/lib/purchase-planner.ts:30-37, 61-66`, `src/pages/shopping/PlannerPanel.tsx:340` (`row.price!`), `src/pages/shopping/WantsDialog.tsx:27, 104` (`card.cardmarket!`)
- **Constat** : `picked`, `left` et `covered` repassent en `T[]`, d'où ces deux `!` en aval.
- **Impact** : si l'invariant cassait, `unitPrice: null` ferait refuser tout le document synchronisé.
- **Correction** : `type Priced<T> = T & { price: number }`, et un prédicat de type.

**P3-T3. Des invariants du store de synchronisation portés par des `!`**
- **Type** : recommandation (vérifié branche par branche : ils tiennent aujourd'hui) · **Confiance** : haute · **Effort** : S
- **Emplacement** : `src/store/sync.ts:42-54, 179-194, 228-247`
- **Constat** : `base!` et `server!` ne sont sûrs que parce que `decide` ne rend jamais `adopt` ni `conflict` sur un 304. `push` rend `true | false | void`, et le statut `'conflict'` n'est pas lié à `conflict !== null`.
- **Impact** : une modification future pourrait les rompre sans erreur de compilation.
- **Correction** : `push` rend `'saved' | 'stale' | 'stopped'`, le 304 dans sa propre branche, et `conflict` dans l'union du statut.

**P3-T4. Des `any` implicites issus de `JSON.parse`**
- **Type** : recommandation · **Confiance** : haute · **Effort** : XS
- **Emplacement** : `server/vitrine.ts:89`, `server/collection.ts:94-95`
- **Constat** : ces `any` arrivent dans `shownCollection` et `documentChanges` sans que ce soit écrit. Les règles ESLint qui lisent les types sont inactives. Les environ 40 casts de lignes SQLite sont justifiés (c'est le schéma du projet).
- **Correction** : écrire `as CollectionData` pour rendre cette confiance visible ; en option, `db.query<Row, Params>()`.

### 8.7 Architecture, maintenabilité, simplification

**P3-M1. La frontière serveur ↔ navigateur n'est pas tenue par l'outillage**
- **Type** : recommandation (preuve : `tsc` sans DOM donne 2 erreurs ; `eslint --print-config server/index.ts` montre `window` et `document`) · **Confiance** : haute · **Effort** : S
- **Emplacement** : `src/lib/transfer.ts:31-42` (`downloadExport` utilise `document`), `tsconfig.server.json:6` (`"DOM"`), `src/lib/species.ts:39-40`, `src/lib/pokedex.ts:10`, `server/vitrine.ts:21`, `eslint.config.js:19, 29`
- **Constat** : le serveur charge `api.ts` et le singleton `SPECIES`, vide côté serveur, via `pokedex.ts` puis `species.ts`.
- **Impact** : une future dépendance de la vitrine à `SPECIES` fausserait son aperçu sans erreur.
- **Correction** :
  - déplacer `downloadExport` dans `useExportCollection` ;
  - déplacer `findCard` dans `lib/collection.ts` ;
  - retirer `"DOM"` et corriger `auth.ts:174` ;
  - n'appliquer `globals.browser` qu'à `src/**`.

**P3-M2. Le schéma des chemins d'images est écrit trois fois, avec des motifs différents**
- **Type** : risque plausible · **Confiance** : basse (codes de séries réels non vus) · **Effort** : S
- **Emplacement** : `src/lib/card-images.ts:13, 25-34`, `server/images.ts:29-49, 79` (`upstreamUrl(path)!`), `:128-144`, `server/lib/pokecardex.ts:89`, `server/reference.ts:175`
- **Constat** : les motifs divergent :

  | Endroit | Motif |
  |---|---|
  | Plan du site | `[\w-]+` |
  | Front | `[\w-]+` |
  | Route | `[A-Za-z0-9_-]{1,32}` |
  | Serveur | `[A-Z0-9_-]+`, numéro `\d{1,4}` |

  Une série avec une minuscule dans son code donne un 404 permanent, et la tâche `images` appelle `fetch(null)`.
- **Impact** : des images manquantes sans cause évidente.
- **Correction** : une seule table `[motif local, adresse d'origine]`, et une erreur explicite à la place du `!`.

**P3-M3. Des commentaires citent encore `/api/prices`, une route retirée**
- **Type** : écart entre doc et code (confirmé) · **Confiance** : haute · **Effort** : XS
- **Emplacement** : `src/types.ts:272, 286-287`, `server/vitrine.ts:8`, `public/sw.js:114`
- **Correction** : mettre ces trois commentaires à jour (`docs/prix.md:19` est juste).

**P3-M4. Le code de compatibilité n'a pas de critère de retrait**
- **Type** : recommandation · **Confiance** : haute · **Effort** : S
- **Emplacement** :
  - reprise des anciens prix : `server/legacy-prices.ts`, `server/ingest.ts:96-104, 114-115`, `compose.yaml` (volume `prices`, `LEGACY_PRICES`), `vite.config.ts:60` ;
  - images TCGplayer : `src/lib/card-images.ts:15-18, 30-33`, `server/images.ts:60-64, 154`, `src/pages/data/MissingImages.tsx:12-13`.
- **Constat** : ce code sert des migrations uniques, et rien ne dit quand le retirer.
- **Correction** :
  - retirer la reprise des anciens prix une fois « Vérifié : … cartes » lu dans les journaux du VPS ;
  - retirer TCGplayer quand « Chercher les images » ne trouve plus rien ;
  - ne jamais toucher aux étapes de `db.ts`.

**P3-M5. Rangement et nommage**
- **Type** : recommandation · **Confiance** : haute · **Effort** : XS chacun
- **Constat** :
  - `lib` n'est pas que des « règles pures » (CLAUDE.md) : `api`, `auth`, `auth-client`, `clipboard`, `focus`, `species`, `card-catalog` et `transfer` font des entrées-sorties. Corriger la formulation plutôt que créer un nouveau dossier.
  - `lib/auth-client.ts` ne contient pas le client Better Auth, que contient `lib/auth.ts` : renommer le premier (`account.ts`).
  - `lib/auth.ts:55` importe `better-auth/react` sans hook : `better-auth/client` suffit.
  - `PricePoint` (`lib/prices.ts:210`) crée le seul cycle de types côté front (`pokedex` ↔ `prices`) : le déplacer dans `lib/chart.ts`.
  - `wantsLine` et `wantsVersion` (`lib/cardmarket.ts:71, 107`) ne servent qu'au serveur et aux tests.

**P3-M6. Une fonction longue, et une documentation coûteuse à tenir**
- **Type** : recommandation · **Confiance** : moyenne · **Effort** : S (fonction) ; M (doc)
- **Emplacement** : `server/jobs/catalog.ts:299-455` (`catalog()`, environ 157 lignes) ; `CLAUDE.md` (27,5 Ko, dont une cellule de 4 445 caractères)
- **Constat** : la documentation est exacte (seules des mentions historiques volontaires restent), mais chaque changement touche trois ou quatre endroits.
- **Correction** : extraire un `seriesWriter(db)`. Réduire le tableau Architecture aux responsabilités et aux règles de dépendance, et laisser la liste des fonctions aux en-têtes des modules.

**P3-M7. Simplifications possibles (non appliquées)**
- **Type** : recommandation · **Confiance** : haute · **Effort** : XS chacune
- **Liste** :
  1. un `authCall()` et une table `{ [status]: message }` pour `LoginPage`, `WelcomePage` et `AccountSection` (`.catch(() => ({ error: { status: 0 } }))` répété, ternaires imbriqués) ;
  2. un seul `readBaseRecord()` dans `store/sync.ts` (trois lectures de `BASE_KEY`) ;
  3. `compare()` (`store/sync.ts:228-236`) teste `304` deux fois ;
  4. un `cacheFirst(name, request)` partagé par `kept()` et `image()` dans `sw.js` ;
  5. `retryDue(known)` pour la condition de `api.ts:40` ;
  6. un `usePriceState(ids)` qui rend `{ prices, missing }` (tous les appelants de `usePrices` appellent aussi `usePricesMissing`) ;
  7. factoriser `parseImport` et `readDocument` dans `transfer.ts` ;
  8. une table chemin → message dans `server/auth.ts`, à la place de `WATCHED` et des `if/else` de `journalAuth` ;
  9. rattacher `plausible()` à chaque entrée d'`UPSTREAMS` dans `server/images.ts` ;
  10. dans `MissingImages.tsx:33-43`, `setSearching(false)` dans un `finally`.

### 8.8 Tests

**P3-Q1. Les tests des routes de prix dépendent de leur ordre**
- **Type** : bug confirmé (fragilité) · **Confiance** : haute · **Effort** : XS
- **Emplacement** : `tests/prices.test.ts:77-118`
- **Preuve** : `bun test --randomize --seed 1` (et les graines 2, 3, 5) donne 1 échec. `bun test tests/prices.test.ts -t ETag` seul reçoit 404 au lieu de 304.
- **Correction** : chaque test pose son propre état (`DELETE FROM sources`, puis `DELETE FROM cardmarket_prices`), ou les trois deviennent un seul test séquentiel. `collection.test.ts`, lui, résiste à l'ordre aléatoire.

**P3-Q2. Des règles d'argent vivent dans des composants, et la non-mutation n'est pas testée**
- **Type** : recommandation · **Confiance** : moyenne · **Effort** : S
- **Emplacement** : `src/pages/catalog/CardDetails.tsx:50-55, 263-279`, `src/pages/pokemon/CardActions.tsx:53-55, 126`, `src/pages/shopping/OrderForm.tsx:93-141` (`readDraft` lit la quantité avec `Number()`, donc `"1e1"` vaut 10), `src/pages/shopping/PlannerPanel.tsx:84-88`
- **Constat** : « une carte retenue par une commande ne peut pas être retirée » est écrite deux fois. « Annuler » repose sur l'immutabilité de `removeCard`, `setCardStatus` et `applyOrder`, jamais testée.
- **Correction** : déplacer la règle dans `lib/orders.ts`, avec un test, et ajouter des tests de non-mutation (`structuredClone` avant, `toEqual` après).

**P3-Q3. La garde « jamais `.data` » est recopiée dans chaque fichier de test**
- **Type** : recommandation · **Confiance** : haute · **Effort** : XS
- **Emplacement** : `tests/collection.test.ts:21`, `tests/prices.test.ts:70`, `tests/setup.ts`
- **Constat** : un futur test serveur qui oublierait la garde toucherait les vraies données si `bun test` était lancé hors de la racine. `setup.ts` ne fixe pas `IMAGES_DIR`, `BACKUP_DIR` ni `LEGACY_PRICES`.
- **Correction** : un seul `tests/server.ts` qui vérifie le dossier puis ouvre les bases, et ces variables fixées dans `setup.ts`.

**P3-Q4. Les migrations ne sont testées que sur une base neuve**
- **Type** : recommandation · **Confiance** : moyenne · **Effort** : S
- **Emplacement** : `server/db.ts:18-308`
- **Constat** : aucun test ne vérifie qu'une base existante garde ses lignes de `cardmarket_history` et de `collections` en passant les étapes suivantes.
- **Correction** : à ajouter avant la prochaine étape qui touche ces tables (exporter `migrate`, rejouer les étapes sur une base remplie). Cela complète P2-06.

---

## 9. Code mort

- **`knip` en mode normal** : rien. **Prettier** : propre. `noUnusedLocals` et `noUnusedParameters` sont actifs.
- **`knip --production`**, après correction de la configuration (essayée sur une copie temporaire) : il ne reste que 4 exports utilisés seulement par les tests (`joinYears`, `shownCollection`, `vitrineSummary`, `wantsVersion`), tous légitimes. Les 21 fichiers « inutilisés » du rapport brut sont un artefact de configuration (P3-B4).
- **CSS** : toutes les classes des modules et de `global.css` ont été contrôlées. Aucune n'est morte ; les seules alertes venaient d'accès dynamiques comme `styles[status]`.
- **Données écrites jamais lues** :
  - `runs.message` (P3-A6) ;
  - `CollectionData.schemaVersion: 1`, jamais relue : à garder, c'est le format du stockage.
- **Code de compatibilité volontaire**, documenté mais sans échéance : `legacy-prices`, TCGplayer (P3-M4).
- **Recommandation** : rien à supprimer aujourd'hui. Retirer le code de compatibilité une fois ses critères atteints.

---

## 10. Vérifié sans problème

Ces points ont été examinés expressément, et le plus souvent rejoués ou tracés jusque dans les dépendances. Ils sont listés pour montrer la couverture.

- **Injection SQL** : toutes les requêtes sont paramétrées, et les listes passent par `json_each(?)`. Les trois interpolations sont des constantes ou de la configuration (`SET_SNAPSHOT`, `user_version`, le chemin de `VACUUM INTO`, échappé).
- **XSS** :
  - aucun `innerHTML` ;
  - liens validés en http(s) à la saisie, à l'import et à la synchronisation (`readDocument`), avec `rel="noreferrer noopener"` ;
  - `/api/vitrine/apercu` échappe ses attributs ;
  - la CSP interdit les scripts en ligne.
- **CSRF et CORS** : origine contrôlée pour PUT et POST (403 avec un corps valide). Cookie `__Secure-`, httpOnly, SameSite Lax. Aucun en-tête CORS. L'origine de Better Auth est fixée par `BETTER_AUTH_URL`.
- **IDOR** : `/api/collection` et `collection_versions` sont liés au `user.id` de la session.
- **SSRF et traversée de chemin** (`server/images.ts`) : chemins normalisés par `new URL`, liste blanche d'hôtes, `image/*` contrôlé, fichier temporaire au nom UUID puis renommé.
- **Redirection ouverte** : `returnPath` exige `/` en tête et la même origine (`/\exemple.fr` est refusé).
- **Routage de la création du compte** : `/sign-up/email/`, `//sign-up/email`, un changement de casse et `%2F` donnent tous 404 ou 403. Un corps illisible est refusé, et le déclencheur `one_account` empêche un second compte.
- **OpenAPI en production** : 404. Une erreur 422 en production ne renvoie que `{type, on, found}`.
- **Priorité des routes Elysia** : `/prices/collection` passe avant `/prices/:id`.
- **Macro `auth`** : `no-store` sur 200, 304, 401, 403 et 409. Le cookie renouvelé est fusionné, même dans un 304.
- **Contrats** : catalogue, espèces, prix, historiques, wants, vitrine, compte, collection et statut correspondent aux types de `src/types.ts`.
- **React 19.3** :
  - un `<title>` dans l'`<Activity>` cachée ne prend pas la main (React insère le nouveau avant le premier `head > title`) ;
  - les effets de l'arbre caché sont bien détruits ;
  - les liens délégués fonctionnent au clavier ;
  - `IntersectionObserver` fonctionne dans une `Modal` ;
  - `useNavigate` est stable.
- **nginx** :
  - `gzip_types` sur plusieurs lignes est valide ;
  - `proxy_buffers 128 8k` respecte la contrainte des tampons occupés ;
  - `limit_req … nodelay` est valide dans la location nommée ;
  - `immutable` n'atteint ni les 404 ni le repli ;
  - `sub_filter` trouve `og:image` ;
  - l'ETag affaibli par nginx est bien géré par `matchesEtag`.
- **Workflow** : `permissions: {}`, action épinglée sur un commit, empreinte d'hôte exigée, un seul déploiement à la fois.
- **Secrets** : `.env` est ignoré par git et par Docker ; l'historique git ne contient que l'exemple du README ; aucun mot de passe n'est lu par `bodyOf`.
- **Typage** : aucun `any` explicite. `unknown` et des prédicats de type à toutes les frontières externes. Les `Record<Union, string>` sont exhaustifs.

### Points forts

1. **Des couches tenues à la lettre**, et un seul contrat entre front et serveur (`types.ts`, `readDocument` partagé entre l'import et le `PUT`).
2. **Une synchronisation pensée** : `decide` est pure et testée, le PUT passe par une transaction `immediate`, le document est recomparé avant une adoption, et la déconnexion passe sous verrou.
3. **Une ingestion prudente** : une transaction par série, des gardes « moins de la moitié », une attente qui double après chaque échec, des écritures par fichier temporaire puis renommage, des sauvegardes par `VACUUM INTO`.
4. **Le réflexe de la liste autorisée** : chemins d'images, champs montrés par la vitrine (testés), liens validés.
5. **Une gestion du focus et des régions annoncées très soignée** (`keepFocusInList`, `focusFirstError`, `role="status"` créé avant son contenu).
6. **Des tests du bon niveau** :
   - `collection.test.ts` teste le serveur entier et résiste à l'ordre aléatoire ;
   - `orders.test.ts` est exemplaire (centimes, annulation, identité de l'objet rendu) ;
   - aucun test ne dépend de la date du jour.

---

## 11. Plan de correction priorisé

Chaque lot se termine par `bunx tsc -b`, `bun lint`, `bun test` (une fois P3-Q1 corrigé, aussi avec `--randomize`), `bun run build`, et la mise à jour de la page `docs/` concernée. Un commit par lot.

### Lot 0 : immédiat (≈ 1 h 30)

| # | Problème | Effort | Test à ajouter |
|---|---|---|---|
| 1 | **P1-01** : drapeau `restoring` dans `persist` et commentaire corrigé | XS | Optionnel : deux stores et un faux `storage` (S) |
| 2 | **P2-09** : `parseEuros` refuse `12 50` | XS | `'12 50' → null`, `'1 2 3' → null` |
| 3 | **P2-05** : `/api/health` signale des prix de plus de 2 jours | XS | Un cas dans un test serveur |
| 4 | **P3-A1** : `AND metacard IS NOT NULL` | XS | Couvert par le lot 1, n° 9 |
| 5 | **P2-08** : 403 et 413 en `refused`, `console.error` dans le `catch`, 403 de la macro journalisé | S | — (store non testé) |
| 6 | **P3-C3** : 401 → « Session expirée » | XS | — |

### Lot 1 : protéger les données (≈ 1 jour)

| # | Problème | Effort |
|---|---|---|
| 7 | **P2-01** : prix rendus avec une clé par id demandé, `known` limité aux clés reçues ; adapter `tests/prices.test.ts` | S |
| 8 | **P2-10** : `savePriceGuide` séparé et testé (historique, garde, repli, `SINGLES`) | S |
| 9 | **P2-11** : tests de mise à jour de la collection (v1 → v2, 409, base en avance, 400), du SQL de `/wants`, de la route `/vitrine`, des quantités importées | S |
| 10 | **P2-04** : stockage illisible → texte brut gardé, bandeau, synchronisation `refused` | S |
| 11 | **P2-06** : empreintes des étapes du schéma, et refus d'un `user_version` trop grand ; avec P3-Q4 | S |
| 12 | **P2-07** : procédure de restauration (`version + 1000`) dans le README tout de suite ; époque dans l'ETag plus tard | XS puis S |
| 13 | **P3-Q1** : tests des prix indépendants de l'ordre | XS |

### Lot 2 : exploitation et sécurité (≈ 1 jour)

| # | Problème | Effort |
|---|---|---|
| 14 | **P2-02** : `message` échappé dans `journal()`, `journalOnce` par IP (/64) et par minute | S |
| 15 | **P2-03** : zones `limit_req` sur `$http_cf_connecting_ip` pour `/api/histories`, `/api/wants` et `/api/auth/` | S |
| 16 | **P3-S1** : refuser un `Content-Type` autre que JSON sur `/sign-up/email` ; décider du jeton de mise en service | XS (décision : vous) |
| 17 | **P2-14** : `nginx -t` au build, `command_timeout`, contrôle après déploiement, images étiquetées ; avec P3-B4 (`bun lint` dans le Dockerfile, `knip.json`) et P3-B7 | S |
| 18 | **P2-15** : sauvegardes en `.tmp` puis renommage, `quick_check`, purge et rétention | S |
| 19 | **P2-13** : `cache.put` non bloquant ; avec **P3-B1** (installation, `vite:preloadError`, `id`) et **P3-S3** | S |
| 20 | P3-S5, P3-S6, P3-S7, P3-S9, P3-B3 : petits durcissements | XS chacun |

### Lot 3 : contrat, accessibilité, robustesse (≈ 1 jour)

| # | Problème | Effort |
|---|---|---|
| 21 | **P2-12** : `API_FORMAT` (cache `donnees-N`, `TAGGED_FORMAT`) | S |
| 22 | **P2-16** : `focusAfter` ; avec P3-R1 et P3-R4 | S |
| 23 | P3-S2 (origine avant l'analyse du corps), P3-A2 (nginx 16k et doc), P3-A3, P3-A4, P3-A5 | XS à S |
| 24 | P3-C1, P3-C2 (conflits), P3-C4, P3-C5, P3-C6 | S chacun |
| 25 | P3-R2, P3-R3, P3-R5, P3-R6, P3-R9 (rendu, contraste) | XS à S |

### Lot 4 : dette, au fil de l'eau

- Typage : P3-T1 à P3-T4, P3-A8.
- Architecture : P3-M1, P3-M2, P3-M3, P3-M5.
- Simplifications : P3-M7, à faire seulement en touchant le fichier concerné.
- Tests : P3-Q2, P3-Q3.
- Dépendances : P3-B5, P3-B6.
- Exploitation : P3-S8, P3-A6, P3-A7.
- UX : P3-R7, P3-R8.
- Documentation : P3-M6, au prochain gros changement de CLAUDE.md.
- Code de compatibilité : P3-M4, quand ses critères sont atteints.

**Estimation totale** : environ 4 jours pour les lots 0 à 3. Le lot 4 est à étaler.

---

## 12. Ce qui n'a pas été audité, et pourquoi

- **`.data/`** (données réelles) : interdit en lecture comme en écriture. Conséquences :
  - les volumes réels ne sont pas mesurés (les temps de P2-03 viennent de données synthétiques) ;
  - les codes de séries Pokécardex n'ont pas été vus (P3-M2) ;
  - on ne sait pas si un Pokémon dépasse 1 025 cartes avec un id Cardmarket, auquel cas `/api/prices/selection` répondrait 422 ;
  - la taille de `data.db` n'est pas connue (P2-15).
- **`.env`** : valeurs jamais lues ; seuls les noms de clés ont été consultés.
- **Exécution de Docker, nginx et Cloudflare** : rien n'a été lancé. Le 414 de nginx est déduit de sa valeur par défaut documentée. La configuration Cloudflare (WAF, HSTS, cache, tunnel) et le VPS (`authorized_keys`, pare-feu, journaux réels) ne sont pas dans le dépôt.
- **Comportement réel dans un navigateur** :
  - aucun parcours de bout en bout de l'app (il faudrait le serveur sur une base complète) ;
  - le service worker sur un réseau dégradé (P2-01, P2-12, P2-13, P3-S3), le CLS (P3-R3), l'animation (P3-R2) et un lecteur d'écran (P2-16, P3-R4, P3-R8) sont déduits du code et des spécifications ;
  - seule exception : la reproduction du P1-01 dans Chromium, sur une page isolée qui recopie la logique de `persist`.
- **Navigateurs autres que Chromium** : la livraison des évènements `storage` à un onglet gelé n'a pas été essayée sous Firefox ni Safari.
- **Feuilles de style** : classes vérifiées automatiquement et contrastes calculés sur les jetons, mais pas de revue visuelle ligne par ligne. Trois CSS (`AuthPage`, `ErrorPage`, `VitrinePage`) n'ont pas été examinés par la passe sécurité, sans enjeu identifié.
- **`.claude/skills/vercel-*`** (88 fichiers) : skills tiers vendus, ignorés. Seul `camply-ui/SKILL.md`, écrit pour le projet, a été lu comme référence.
- **`docs/`** : lus comme texte de référence ; trois pages (`collection-et-achats`, `compte-et-synchronisation`, `deploiement`) contrôlées seulement par recherche, pas lues en entier par tous les agents.
- **`node_modules/`** : pas d'audit de la chaîne d'approvisionnement au-delà de `bun audit`. Lectures ciblées seulement, pour vérifier un comportement.
- **`@camply/ui`** (dépôt voisin `../Camply-UI`) : hors périmètre. Ses composants ont été lus là où le comportement de l'app en dépend (focus des fenêtres, toasts).
- **Tests sous Alpine** et **tests de mutation** : non exécutés.
- **La passe « sécurité mémoire » de Claude Security** a été retirée par le workflow pour les 11 groupes, au motif que tout le code est dans des langages managés.

---

*Produits du scan de sécurité :*
- `CLAUDE-SECURITY-20261019-084618/CLAUDE-SECURITY-RESULTS.md`, `.jsonl` et `.sarif` ;
- le tampon de révision `CLAUDE-SECURITY-REVISION-041e4d5bf62a.json` (statut `verified`) ;
- les valeurs sensibles ont été remplacées par `[REDACTED]`. Le dossier n'est pas suivi par git.
