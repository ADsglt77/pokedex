# Plan de revue — audits du 9 novembre 2026

Le plan global tiré des trois audits du 9 novembre 2026. Les rapports, copiés tels quels, sont dans
`docs/audits/` :
- `audit-front-2026-11-09.md` (le site React) ;
- `audit-backend-2026-11-09.md` (le Worker du site) ;
- `audit-donnees-2026-11-09.md` (`pokedex-data`).

Les trois ont été lus en entier ; aucun n'était inaccessible. **Aucun code n'est modifié par ce
plan, et rien n'est déployé.**

**Ce qui a été revérifié pour ce plan.** Les constats dont la gravité change, et les dépendances
entre les rapports, ont été relus dans le code le jour même : `src/store/account.ts`,
`../pokedex-data/worker/ingest/history.ts`, `json-stream.ts`, `catalog.ts`, `worker/images.ts`,
`species.ts`, `src/config/pokedex.ts` des deux côtés, `src/lib/filters.ts`. Les autres constats
gardent la preuve de leur rapport.

**Identifiants.** Plusieurs rapports emploient les mêmes : `SEC-04` ou `PERF-01` ne désignent pas
le même constat d'un rapport à l'autre. Ici, chaque identifiant porte la lettre de son rapport :
`F-` (frontend), `B-` (backend), `D-` (données). Exemples : `B-SYNC-01`, `D-SEC-04`, `F-MOB-01`.

**Priorités**
- **P0** : perte de données de l'utilisateur, ou faille exploitable. À faire d'abord.
- **P1** : risque réel à court terme, ou défaut visible par l'utilisateur.
- **P2** : durcissement, risque peu probable ou latent, cohérence. Un garde-fou d'une ligne y est
  fait tôt, même peu probable.
- **P3** : optimisation, confort, ou changement qui attend une décision.

**Catégories** : Bug, Sécurité, UX (accessibilité comprise), Optimisation.

## Règles appliquées à chaque lot (les CLAUDE.md)

- **Un lot, un dépôt**, sauf L09, qui est la règle du contrat : le site d'abord, puis les données.
- **Vérifications après chaque lot** :
  - site : `bun lint`, `bun test`, `bun run test:worker`, `bun run format` ;
  - données : `bun run test` (pas `bun test`), `bun run typecheck`, `bun run lint`,
    `bun run format`.
- **Tests seulement où une erreur coûte** :
  - argent, règles de la collection, garde du serveur, Pokédex public, schéma ;
  - côté données : prix, historique, passages.
  - Pas de test d'interface : les lots d'UX n'en ont pas.
- **Documentation** : la page du domaine est relue avant le lot, puis tenue à jour (`docs/*.md`,
  `../pokedex-data/docs/donnees.md`).
- **Interface** : `@camply/ui` d'abord (skill `camply-ui`), couleurs seulement dans
  `styles/theme.css`, textes en français et au vouvoiement.
- **Décisions déjà prises, rien de réintroduit** : aucune sauvegarde, pas de hors-ligne, aucune
  source nommée, aucune nouvelle source sans demande.
- **Ingestion** : elle est lancée par l'utilisateur, jamais par un lot.
- **Migrations** : un lot qui ajoute une migration ne part pas sur `main` sans accord (DEC-21) ;
  une migration ne modifie jamais les précédentes.
- **Simplicité** : pas d'abstraction « au cas où », et on factorise dès deux usages.

## 1. Gravités réévaluées

| Constat | Gravité du rapport | Gravité retenue | Priorité | Pourquoi |
|---|---|---|---|---|
| **B-SYNC-01** | élevé | **élevé** (confirmé) | P0 | Les lignes ont été relues : `changed()` compte toute modification en `expired` (`account.ts:398-403`) ; `push` n'envoie rien en `expired` (`:237-240`) ; `signIn` renvoie depuis l'ancienne version (`:312-318`) ; le 409 fait relire et remplacer (`:212-217`, `:156-164`). C'est le cas normal du « un seul appareil à la fois ». La perte est silencieuse jusqu'au toast, elle couvre toutes les modifications en attente, et l'interface promet le contraire (`AccountMenu.tsx:35`, `:178-179`). |
| **D-FIA-01** | moyen | **faible** | P2 (lot L07, tôt) | Code confirmé : `json-stream.ts:62` rend `rest` même sans `]`. Mais le déclencheur est très improbable : le guide est un objet S3 publié d'un bloc, et une coupure réseau lève une erreur. Et la perte n'est pas « pour toujours » : `mergeHistory` (`history.ts`) remplit chaque jour antérieur au dernier relevé avec le prix repris de Pokécardex, qui en garde 180 jours. Le jour manquant se récupère en effaçant les cartes touchées de `history_imports`, puis en relançant `history`. Le correctif tient en une ligne : on le fait quand même tôt. |
| **D-SEC-09.1** (séries « Asia Exclusive ») | faible | **faible** (confirmé) | P2 (lot L07) | Code confirmé : `saveBlocks` efface cartes et séries, et `card_species` part en cascade (`schema.ts:166`). Effet visible : les scans et logos de ces séries répondent 404 (`plausibleScan` et `plausibleLogo`, `worker/images.ts`), donc les cartes des comptes montrent la carte de substitution. Les séries restent sautées tant que le menu les classe ainsi (`catalog.ts:667`). Le déclencheur est une erreur de la source. On rattrape par le Time Travel (30 jours), ou au premier passage du catalogue une fois le menu corrigé. Une garde simple, comme celle de `saveSeries`, suffit. |
| **D-INTEG-01** | moyen | **faible aujourd'hui ; bloquant avant toute nouvelle génération** | P2 (lot L09) | Rien ne le déclenche seul. Les espèces sont relues d'après le `SPECIES_IDS` des données (`species.ts:116`), borné à 1 025, et le catalogue filtre à la même borne (`catalog.ts:413-414`). C'est le cas qu'écarte à raison le rapport du backend. Il ne survient que si l'on ajoute une génération d'un seul côté : la grille du Pokédex tombe alors (`filters.ts:327-329`, `generationById(…)!`), et chaque envoi d'une collection qui contient une carte d'un nouveau Pokémon est refusé (`transfer.ts:137-138`). Le lot doit précéder ce changement. |
| F-MOB-01 | élevé | moyen | P1 | La page défile de côté sur téléphone, mais reste utilisable. Une ligne suffit. |
| F-UX-01 | élevé | moyen | P1 | Le geste principal est mal présenté, sans perte : un mauvais statut se corrige après coup. |
| F-NAV-01 | élevé | fusionné dans B-SYNC-01 | P0 | C'est le même signal (`offline`, `expired`), et la même correction. |
| D-INTEG-02, D-INTEG-03 | moyen | faible | P2 (lot L09) | Seulement au prochain changement de forme ; c'est surtout une règle à écrire. |
| D-SEC-10 | faible | fusionné dans B-SEC-01 | P1 | C'est le même fichier (`worker/limits.ts` du site) et le même risque (D1 sans limite). |

Les autres gravités sont gardées telles quelles.

## 2. Dépendances croisées

1. **B-SYNC-01 et F-NAV-01** : le même état (`expired`, `offline`) mal signalé, et des
   modifications perdues. Ils forment un seul lot (L01).
2. **B-SEC-01 et D-SEC-10, puis D-SEC-04** :
   - les deux premiers sont le même fichier, `worker/limits.ts` du site (L02) ;
   - D-SEC-04 copie la règle /64 de `visitorOf` (`worker/journal.ts:189-199`) dans
     `../pokedex-data/worker/limits.ts` : la copie porte l'en-tête « même règle que » (DOC-03).
3. **B-SEC-02 et B-SEC-04** : le compteur par pseudo et l'adresse IP gardée par Better Auth
   touchent le même stockage, `rateLimit`, et la même page des mentions légales. Ils forment un
   seul lot (L03).
4. **D-INTEG-01, le cas « écarté » de B, `transfer.ts:137-138` et `filters.ts:327-329`** : il n'y a
   pas de contradiction. B écarte le déclenchement automatique, D-INTEG-01 traite un changement
   d'un seul côté. Une seule correction : `TotalSpecies` dans le contrat (L09).
5. **D-INTEG-02, D-INTEG-03 et B-SYNC-04** : c'est la même question, la compatibilité pendant un
   déploiement (R2, deux Workers, onglets ouverts). On écrit une seule règle dans
   `docs/deploiement.md` (L09). La version du format (B-SYNC-04) ne s'écrit qu'avec le premier
   nouveau champ du document.
6. **D-INTEG-04, puis D-PERF-02** : passer les illustrations en WebP change leurs chemins, qui
   sont dans le contrat et dans les collections. Il faut d'abord typer les gabarits (L09), puis
   convertir (L19).
7. **F-UX-04 et l'API des données** : les noms des raretés viennent de Pokécardex. Les normaliser à
   l'ingestion changerait une forme gardée dans R2 (règle de D-INTEG-02). Proposition sans
   changer le contrat : la table d'équivalence côté site, dans `lib/card-catalog.ts` (L17,
   décision D-08).
8. **F-UX-03 et D-FIA-05** : la date des prix sur la fiche rend visible un relevé en retard
   (rythme réel de 7 h, ou panne). Ce sont des lots différents, mais F-UX-03 aide à voir D-FIA-05.
9. **B-ENV-01, la note d'environnement de D et CONF-05 (DEC-19)** : Bun 1.3.10 sur le poste, 1.4.4
   déclaré. Une seule action (A-01), avant tout lot qui réécrirait `bun.lock`.
10. **Note d'environnement de D** : la D1 locale des données n'a reçu que les migrations 0000 et
    0001, et son Worker répond 301 vers lui-même. Relancer `bun run dev` (A-02) avant de vérifier
    en local un lot des données ou `/api/wants`.
11. **D-PERF-01** : le code d'abord (L13), puis une ingestion `images` que lance l'utilisateur
    (A-03).
12. **Dans camply (`../Camply-UI`)** : F-MOB-02, F-MOB-06, le remplissage de `Progress` en
    contraste élevé (F-A11Y-01), `Radio.label` (F-CAMPLY-01, DEC-07), la fermeture au `click` et
    non au `mousedown` (F-A11Y-02), et A11Y-02 du 2 novembre. Ils forment un seul lot, hors de ces
    dépôts (L18).
13. **B-SEC-02 et DEC-21** : stocker le compteur par pseudo dans la table `rateLimit` existante
    évite une migration. Better Auth la purge au-delà de sa plus longue fenêtre, une heure,
    compatible avec un compteur à l'heure.
14. **D-FIA-06 et DEC-21** : sa colonne `runs.instance` est une migration ; elle attend l'accord
    (L16).

## 3. Plan par priorité

Pour chaque lot :
- **Constats** et **fichiers** ;
- **Changement** : ce qu'on fait ;
- **Tests** ;
- **Doc** : la page à tenir à jour ;
- **Dépend de** : ce qui doit être fait avant ;
- **Comportement** : s'il change, et quelle décision il attend ;
- **Effort** : S (petit), M (moyen).

### P0

#### Bug

**L01 — Plus aucune modification perdue sans le dire (site)** — *fait : commit `7dec138`, déployé
le 9 novembre 2026 (Workers Builds), et son test complémentaire `e415041` (une modification
faite pendant la relecture d'un conflit). Décisions retenues : les modifications restent acceptées
en `expired` ; chaque version remplacée est gardée jusqu'à « Oublier » ou la sortie du compte ;
pas de « Reprendre ma version » (export puis import) ; la place des toasts est reportée à L11.
S'y ajoutent : l'avertissement et l'export avant toute sortie du compte (déconnexion, suppression,
connexion ou inscription à un autre compte), l'export proposé par le bandeau, sans dépendre de
`beforeunload`, et la reconnexion au même compte, qui garde les versions mises de côté (corrigé
après la contre-review). Reste, sans perte possible : « votre dernière modification » dans le
bandeau et le menu hors ligne (« vos modifications » au lot L11).*
- **Constats** : B-SYNC-01, F-NAV-01.
- **Fichiers** :
  - `src/store/account.ts` : `reloadAfterConflict`, `leave` ;
  - `src/components/AccountMenu.tsx` (`:35`, `:40`, `:178-179`, `useSaveStatusToasts`) ;
  - `src/components/AppShell.tsx` (`Shell`) ;
  - `src/main.tsx:71` ;
  - le bouton d'export existant (`ExportCollectionButton`).
- **Changement** :
  1. Avant de remplacer la collection après un 409, garder la version locale si quelque chose
     attendait. L'état `reloaded` propose « Exporter ma version ». Cette version gardée est oubliée
     à la modification suivante et par `leave()`.
  2. Une bannière `Banner` de camply quand l'état vaut `offline` ou `expired`, avec son action :
     « Réessayer maintenant » (`save`), ou « Se reconnecter ».
  3. Un toast au passage en `expired`.
  4. Corriger les textes : « vos modifications en attente », et l'avertissement « si la collection
     a changé ailleurs, elles seront remplacées : exportez-la d'abord ».
  5. Toasts en bas à droite, pour ne plus couvrir le pied de la barre latérale.
- **Tests** : dans `worker/tests/sync.test.ts`, « se reconnecter après une écriture ailleurs » :
  - on modifie, la session tombe, on modifie encore, l'autre appareil écrit, on se reconnecte ;
  - attendu : `reloaded`, et la version locale gardée, avec les deux modifications.
- **Doc** : `docs/compte-et-synchronisation.md` (états de l'enregistrement), `docs/interface.md`
  (bannière, place des toasts).
- **Comportement** : oui. Décision D-01 : garder les modifications en `expired` (proposé), ou les
  bloquer.
- **Effort** : M.

### P1

#### Sécurité

**L02 — Les routes sans limite du site (site, Worker)** — *fait le 10 novembre 2026. D-02
validée. `/api/auth` (sans barre finale) rejoint `ACCOUNT_LIMIT`.
`/api/account` et `/api/journal` partagent avec `/api/collection` le même compte de
`COLLECTION_LIMIT` (40 par 10 s et par visiteur), et `/api/status` et `/api/health` celui de
`DATA_LIMIT` (400 par 10 s). Testé : la dernière demande permise passe, la suivante reçoit 429
sans corps, avec `Retry-After: 10` et `Cache-Control: no-store`, et un autre visiteur passe
toujours. Seules les espèces restent sans limite. Hors du lot, non fait : une limite par défaut
pour tout `/api/*` (piste du rapport), et la purge des passages anciens de `runs` (D-SEC-10, dans
l'API des données).*
- **Constats** : B-SEC-01, D-SEC-10.
- **Fichiers** : `worker/limits.ts` (règles `:23-37`, en-tête `:7`).
- **Changement** :
  - `api\/(auth|vitrine)(\/|$)` ;
  - `/api/(account|journal)` dans `COLLECTION_LIMIT` ;
  - `/api/(status|health)` dans `DATA_LIMIT`, après la décision D-02.
- **Tests** : `worker/tests/headers.test.ts` (« les limites par visiteur ») : avec
  `cf-connecting-ip`, la 41e requête vers `/api/auth`, `/api/account` et `/api/journal` reçoit 429.
- **Doc** : l'en-tête de `worker/limits.ts`, et `docs/compte-et-synchronisation.md`.
- **Comportement** : oui, pour `/api/status` et `/api/health` : on revient sur une décision
  documentée (D-02).
- **Effort** : S.

**L03 — Tentatives de connexion par pseudo, et mentions légales (site)** — *fait le 10 novembre
2026. D-03 validée : 20 refus (401) par heure et par pseudo, d'où qu'ils viennent, dans la table
`rateLimit` (sans migration). Chaque essai réserve sa place avant Better Auth, en une seule
requête : refus et essais en cours ne dépassent jamais 20 dans l'heure, même simultanés, et un
essai bloqué n'écrit rien. Pour éviter les blocages abusifs, seul un refus garde sa place : une
connexion réussie, une requête mal formée, la limite de Better Auth ou une panne la rendent, dans
son heure seulement. Un pseudo invalide n'est pas compté, et une connexion coupée par le client va
jusqu'au bout (`waitUntil`). Le blocage tombe une heure après le premier refus, sans que les
essais bloqués le prolongent. Pour ne rien laisser fuir : un pseudo sans compte se bloque de même,
avec la même réponse ; la clé est une empreinte HMAC du pseudo, jamais le texte tapé ; et un essai
qui n'est pas un refus n'ouvre pas l'heure, si bien que `Retry-After` ne dit rien d'une connexion
réussie. La réponse porte `Retry-After` et le code `PSEUDO_LOCKED`, que dit le formulaire. Les
mentions légales disent les compteurs, leur adresse IP et leur rétention réelle : une heure au
moins, sans durée maximale garantie. Contrairement à ce que supposait ce plan, Better Auth ne
purge pas la table toutes les heures, mais quand un visiteur revient sur une même action du
compte. Trois contre-reviews ont relevé onze anomalies ; neuf sont corrigées avec leurs tests : le
blocage par une rafale d'essais mal formés, la rétention annoncée deux fois, les écritures pour un
pseudo invalide et les deux écritures d'un essai bloqué, la place rendue dans l'heure suivante (plus de 20 refus, compteur négatif),
`Retry-After` qui trahissait une connexion récente, une place non rendue (panne de la base) qui
changeait une connexion réussie en erreur 500, et un rejet signalé deux fois au journal du runtime
(`waitUntil`). Accepté, et documenté : après 19 refus dans l'heure, un tiers peut voir qu'une
connexion à ce pseudo est en cours, le prix de la limite stricte. Non corrigé (sans enjeu) : un
pseudo qui commence par le signe kelvin (U+212A), refusé par Better Auth, écrit encore une ligne à
zéro.*
- **Constats** : B-SEC-02, B-SEC-04.
- **Fichiers** :
  - `worker/auth.ts` (`accountRoutes`, `:351-366` ; le pseudo tapé est déjà lu, `:358`) ;
  - `src/pages/LegalPage.tsx` (`:66-82`, `:111-119`) ;
  - le message de refus de la connexion (`refusalMessage`).
- **Changement** :
  - Compter les refus de `/sign-in/username` par pseudo visé, avant `auth.handler`.
  - Stockage proposé : la table `rateLimit` existante, avec une clé `pseudo|<pseudo>`. Elle
    n'exige aucune migration, et Better Auth la purge au-delà d'une heure. Sinon, une table à
    part : migration, et DEC-21.
  - Au-delà du seuil : 429, et le message le dit.
  - Les mentions légales disent ce compteur, et l'adresse IP gardée environ une heure.
- **Tests** : `worker/tests/account.test.ts` : 21 refus sur un même pseudo, depuis 21 adresses ; le
  21e reçoit 429. Ce compteur n'est pas coupé dans les tests, contrairement aux limites de Better
  Auth.
- **Doc** : `docs/compte-et-synchronisation.md`.
- **Comportement** : oui. Décision D-03 : le seuil (proposé : 20 refus par heure).
- **Effort** : S à M.

#### Bug

**L04 — Saisies et navigation sans perte (site)** — *fait le 10 novembre 2026. La fenêtre d'une
carte ne se ferme plus d'un clic à côté (`closeOnBackdrop={false}`). Hors ligne, `vite:preloadError`
ne recharge plus la page. La page d'erreur de l'app le dit (« Pas de connexion »), ramène à la
page précédente plutôt que de recharger, et redevient ordinaire au retour du réseau ; l'app garde
ses modifications en attente, et le détail de l'erreur se coupe sur un téléphone (il débordait de
61 px). `readImport` refuse, avec sa raison et avant de rien remplacer, un export dont l'envoi qui
suivrait dépasserait `MAX_DOCUMENT`. Il mesure le texte même que le site enverrait, enveloppe
comprise (`sentText`, partagé avec `pack`), en octets, sans l'indentation du fichier : refusé si et
seulement si le serveur le refuserait, sans marge. Tests : `tests/import.test.ts` (+4 : la limite
à l'octet près, l'enveloppe, les octets, l'indentation) et `worker/tests/collection.test.ts` (+1 :
face au Worker, l'export accepté est enregistré, compressé, et un octet de plus est refusé par
l'import comme par le serveur, tel quel ou compressé). L'interface n'est pas testée, selon la
règle du projet, mais rejouée avec Playwright sur le site local : hors ligne, la page manquée, le
retour à la page précédente, le retour du réseau puis le rechargement. Contre-review : GO, ses
restes corrigés. Reste, sans perte : la page manquée ne s'ouvre qu'après un rechargement, une
fois le réseau revenu (le routeur garde l'échec), ce que dit la page d'erreur.*
- **Constats** : F-A11Y-02, F-ETAT-03, B-SYNC-03.
- **Fichiers** : `src/pages/pokemon/CardForm.tsx:131-134`, `src/main.tsx:28-37`,
  `src/lib/transfer.ts:311-317`.
- **Changement** :
  - `closeOnBackdrop={false}` sur la fenêtre d'une carte, comme `OrderForm` ;
  - `if (!navigator.onLine) return` dans le gestionnaire de `vite:preloadError` ;
  - `readImport` refuse un document de plus de `MAX_DOCUMENT` octets, avec sa raison.
- **Tests** : `tests/import.test.ts` : un export de plus de 1,9 Mo est refusé, rien n'est
  remplacé.
- **Doc** : `docs/compte-et-synchronisation.md` (import), `docs/interface.md` (rechargement après
  un déploiement).
- **Comportement** : non, sauf le refus d'un import trop gros.
- **Effort** : S.

**L05 — Téléphone et clavier (site)** — *fait le 10 novembre 2026. Le
Catalogue ne déborde plus de côté (`minmax(0, 1fr)` sur `.tools`). « Mes cartes » (Valeur) et les
commandes, rangées en liste, gardent leur tri : un `Select` « Trier par » de camply, branché sur
le tri contrôlé (les commandes y passent). Il paraît exactement quand l'en-tête disparaît, par un
seul conteneur `table` (`.stack-sort`, `lib/table-sort.ts`), plutôt que par `usePhone()` comme le
proposait le plan : il suit ainsi la vraie largeur du tableau. Sur téléphone, l'accueil montre la
liste des régions (des liens de 44 px) au lieu de la réglette ; ce choix, déjà fait par le Pokédex
public, est factorisé dans `RegionProgress`. Le focus va au `<main>` d'une page qui en remplace
une autre (`useFocusOnEntry` : la coquille, `AuthCard`, `StandalonePage`, `ErrorPage`), sauf à la
première page du document. Un filtre rapide se relâche au second appui, et les raccourcis sont
bloqués sous un `[role=menu]`. Pas de test (interface), mais tout est rejoué avec Playwright sur le
site local, avec l'API des données locale et un compte de test :
- **débordement à 320 et 390 px** : aucun sur les treize pages parcourues (accueil, Pokédex,
  fiche, Collections, Catalogue, Valeur, les quatre onglets d'Achats, Réglages, Pokédex public,
  mentions légales) ;
- **le tri** : à chaque largeur entre 570 et 585 px, un seul du choix ou de l'en-tête paraît ; il
  se choisit au clavier ;
- **les régions** : 9 liens de 44 px sur téléphone, la réglette au-delà ;
- **le focus** : il reste sur `body` à la première page, puis va au contenu à l'inscription, au
  retour, après la connexion, vers et depuis les mentions légales, après la déconnexion, et au
  retour de la page d'erreur ;
- **le filtre rapide** relâché au second appui ;
- **sous le menu du compte**, → et « / » sans effet, et → mène à Raichu sans le menu.

Contre-review : NO-GO, puis corrigé. La coquille se redessinait à chaque frappe d'une recherche :
la clé de page est maintenant lue dans `history.state`, et non par `useLocation`. Le choix du tri
manquait sur 2 px pour un tableau bordé : le conteneur du tableau est retiré dans `.stack-sort`.
S'y ajoutent la factorisation des régions et le focus au retour de la page d'erreur. Deux
débordements trouvés en vérifiant, d'avant L05, sont corrigés aussi :
- **Achats**, 167 px à 320 px (97 à 390), sur tous ses onglets : le mot caché d'un badge
  d'onglet, en `position: absolute`, sortait de la rangée d'onglets qui défile, désormais
  positionnée (`ShoppingPage.module.css`) ;
- **l'en-tête des pages seules**, 5 px à 320 px : « Revenir à l'accueil » passe sous la marque
  (`StandalonePage.module.css`).

Seconde contre-review, du diff complet : GO. Corrigés aussi, à sa demande, le retrait du choix
« Trier par » dans un bloc bord à bord (« Mes cartes ») et trois commentaires inexacts.

Reste, hors du lot : les mentions légales disent « Mise à jour le 29 octobre 2026 »
(`LegalPage.tsx:32`), alors que L03 a changé leur texte le 10 novembre.*
- **Constats** : F-MOB-01, F-MOB-03, F-MOB-04, F-A11Y-03, F-A11Y-04, F-A11Y-05.
- **Fichiers** :
  - `src/pages/catalog/CatalogPage.module.css:43` ;
  - `src/pages/value/ValueTables.tsx:89-90`, `src/pages/shopping/OrdersPanel.tsx:92-101` ;
  - `src/pages/home/ProgressPanel.tsx:70`, `src/components/ProgressRuler.tsx`,
    `src/components/RegionList.tsx` (celle du Pokédex public) ;
  - `src/components/AppShell.tsx:140-150`, `AuthCard.tsx`, `StandalonePage.tsx` ;
  - `src/pages/pokedex/PokedexToolbar.tsx:148-152`, `src/lib/focus.ts:94`.
- **Changement** :
  - `grid-template-columns: minmax(0, 1fr)` sur `.tools` ;
  - un `Select` « Trier par » sur téléphone, branché sur les tris contrôlés ;
  - `RegionList` (avec ses liens) à la place de la réglette sur téléphone ;
  - le focus mené au contenu en entrant dans la coquille et en en sortant ;
  - un filtre rapide qui se désactive au second clic ;
  - les raccourcis bloqués aussi sous un `[role=menu]`.
- **Tests** : aucun (interface).
- **Doc** : `docs/interface.md`.
- **Comportement** : seulement l'interface du téléphone, et les deux corrections de clavier.
- **Effort** : M.

#### UX

**L06 — La fenêtre d'ajout d'une carte (site)**
- **Constats** : F-UX-01, F-UX-02.
- **Fichiers** : `src/pages/pokemon/CardForm.tsx` (`:220`), `CardFields.tsx`,
  `src/config/shopping.ts:10`.
- **Changement** :
  - Après un choix au catalogue, un résumé : image, référence et drapeau, prix du jour.
  - Puis « Ajouter comme » en premier.
  - Les quatre champs techniques repliés sous « Modifier les détails » (`Accordion` ou `Spoiler`
    de camply).
  - « À acheter » devient « Non possédée », ou un `Switch` « Je la possède déjà ».
- **Tests** : aucun nouveau ; ceux de la saisie d'une carte (`tests/cards.test.ts`) restent.
- **Doc** : `docs/cartes.md` (la fenêtre d'ajout), `docs/interface.md`.
- **Comportement** : oui, l'interface. Décision D-04 : le libellé ou le `Switch`.
- **Effort** : M.

#### Action de l'utilisateur
- **A-01** : passer le poste à Bun 1.4.4 (`bun upgrade`), puis `bun install --frozen-lockfile`
  dans les deux dépôts (B-ENV-01, CONF-05/DEC-19), avant tout lot qui touche `bun.lock`.

### P2

#### Bug

**L07 — Garde-fous de l'ingestion (données)**
- **Constats** :
  - D-FIA-01 et D-FIA-02, à faire en premier ;
  - D-FIA-05 ;
  - D-SEC-09 : séries retirées, prix bornés, champs entiers.
- **Fichiers** :
  - `../pokedex-data/worker/ingest/json-stream.ts` (après la boucle) ;
  - `workflow.ts:53` (`RETRIES`) ;
  - `runs.ts:80` ;
  - `prices.ts:85` ;
  - `history.ts` (`mainHistory`, date minimale) ;
  - `catalog.ts:516-531` (`saveBlocks`) et `saveSeries`.
- **Changement** :
  - `streamArray` refuse un document sans la fin de son tableau ;
  - `timeout: '30 minutes'` dans `RETRIES` ;
  - `isDue` avec une marge de 10 min, ou mesuré depuis `started_at` ;
  - `amount` borné entre 0 et 100 000 ;
  - dates reprises bornées à 200 jours avant le dernier relevé ;
  - `saveBlocks` refuse un retrait qui toucherait plus de quelques séries, ou une série connue de
    plus de N cartes ;
  - `saveSeries` écarte une carte dont `id_card`, `sort` ou `id_cardmarket` ne sont pas des
    entiers positifs.
- **Tests** :
  - `prices.test.ts` : un guide tronqué est refusé ; `avg30: -5` ne donne pas de prix ;
  - `runs.test.ts` : un passage réussi il y a 5 h 59 est dû ;
  - `catalog.test.ts` : un menu qui range une série connue en « Asia Exclusive » n'efface rien.
- **Doc** : `../pokedex-data/docs/donnees.md` (rythmes réels, gardes).
- **Comportement** : oui, à la marge. Décision D-11 : le seuil de la garde des séries.
- **Effort** : S.

**L09 — Avant tout changement de forme : le contrat (les deux dépôts, le site d'abord)**
- **Constats** : D-INTEG-01, D-INTEG-02, D-INTEG-03, D-INTEG-04, et la règle seulement de
  B-SYNC-04.
- **Fichiers** :
  - `../pokedex-data/src/contract.ts`, `src/types.ts`, `scripts/check-data-contracts.ts` ;
  - `src/config/pokedex.ts` (`:11-24`), `../pokedex-data/src/config/pokedex.ts` ;
  - `../pokedex-data/package.json` (`lint`) ;
  - `worker/tests/collection.test.ts:569-571`, `:618-621` ;
  - les copies sans en-tête : `src/lib/card-images.ts` ↔ `../pokedex-data/src/lib/image-paths.ts`,
    `src/config/catalog.ts`, `src/lib/card-code.ts`.
- **Changement** :
  - `type TotalSpecies = 1025` dans le contrat, avec `TOTAL_SPECIES: TotalSpecies` des deux côtés ;
  - les `GENERATIONS` du site avec `satisfies Record<GenerationId, …>` ;
  - les gabarits des chemins d'images en types littéraux dans le contrat ;
  - l'en-tête « même règle que » sur les copies ;
  - `lint` de `pokedex-data` lance le contrôle quand `../pokedex` existe ;
  - `satisfies PriceFile` sur les faux de `DATA`.
- **Doc** :
  - `docs/deploiement.md` :
    - « élargir puis restreindre » (champ ajouté facultatif d'abord, jamais un tuple réordonné) ;
    - l'ordre lors d'une génération : le site, puis les données, puis `species` avant `catalog` ;
    - le changement d'une forme gardée dans R2 en trois temps ;
  - `../pokedex-data/CLAUDE.md:40-42` : `FORMAT` ne vaut que pour les prix et les historiques ;
  - `../pokedex-data/docs/donnees.md`, `../pokedex-data/README.md:62-63`.
- **Tests** : `bun run contracts` (vérification de types).
- **Dépend de** : rien. Mais il bloque tout ajout de génération, et le lot L19.
- **Comportement** : non.
- **Effort** : S à M.

#### Sécurité

**L08 — Limites de l'entrée d'Internet de l'API des données (données)**
- **Constats** : D-SEC-04 (DEC-12), D-SEC-08, D-SEC-11.
- **Fichiers** :
  - `../pokedex-data/worker/limits.ts:14-22` ;
  - `../pokedex-data/worker/auth.ts` (`guard`, `:67`) ;
  - `../pokedex-data/worker/index.ts:43-46`.
- **Changement** :
  - la clé ramenée au /64, en copiant `visitorOf` avec l'en-tête « même règle que » ;
  - les routes lourdes comptées par client, après le token, et `/v1/wants` à 5 par 10 s ;
  - `getPath` de Hono à la place de `new URL().pathname` ;
  - en http, une requête qui porte `Authorization` reçoit 403, sans redirection.
- **Tests** : `../pokedex-data/worker/tests/api.test.ts` :
  - deux IPv6 du même /64 donnent la même clé ;
  - `/v1/%77ants` est limité ;
  - http avec token reçoit 403.
- **Doc** : `../pokedex-data/README.md` (entrée d'Internet), `../pokedex-data/docs/donnees.md`.
- **Comportement** : oui. Décision D-05 (DEC-12).
- **Effort** : S.

#### Tests (sans changement de comportement)

**L10 — Les gardes qui tiennent sans test**
- **Constats** :
  - côté site : B-SYNC-02, B-SYNC-05, et les tests 3 et 4 de B ;
  - côté données : D-FIA-03, D-FIA-04, et le test du passage de l'année.
- **Fichiers** :
  - `worker/tests/collection.test.ts`, `worker/tests/sync.test.ts` ;
  - `../pokedex-data/worker/tests/workflow.test.ts` (nouveau), `history.test.ts`,
    `prices.test.ts`.
- **Tests à écrire** :
  - Site :
    - cinq PUT simultanés de la même version : `[200, 409, 409, 409, 409]` ;
    - un `beforeEach` qui remet `browser` et `page` à zéro ;
    - une réponse perdue, puis une connexion à un autre compte : jamais `expired` ;
    - une réponse 200 coupée : `offline`, jamais `reloaded`.
  - Données :
    - `Ingest.run` avec une tâche en échec et une réussie ;
    - un prix du jour écrit pendant une reprise de l'historique ;
    - le prix d'il y a 30 jours lu dans l'année d'avant, en janvier.
- **Effort** : M. Il se coupe en deux lots, un par dépôt.

#### UX

**L11 — États cohérents (site)**
- **Constats** : F-ETAT-01, F-ETAT-02, F-UI-01, F-UI-02, F-UX-03, F-UX-08, F-LIB-01, F-NAV-03,
  F-A11Y-06, F-A11Y-08, F-MOB-05, F-DS-01, F-PERF-02.
- **Fichiers** :
  - `src/pages/VitrinePage.tsx` (`:111-128`, `:139`, `:191`) ;
  - `src/components/PokedexUnavailable.tsx`, `src/pages/NotFoundPage.tsx` ;
  - `src/pages/pokemon/CatalogPicker.tsx:66-71`, `src/pages/value/ValuePage.tsx` (`:87`,
    `:112-124`, `:214-219`) ;
  - `src/components/PricePanel.tsx:69-80` ;
  - `src/pages/catalog/CatalogPage.tsx:282-287`, `src/components/SetPicker.tsx:241-245`,
    `NoMatch.tsx` ;
  - `src/pages/shopping/PlannerPanel.tsx:127-133`, `ShoppingPage.tsx:86` ;
  - `src/pages/data/DataPage.tsx:20` ;
  - `src/pages/catalog/CardDetails.tsx` (`:168-186`), `src/components/SeriesCard.tsx:64-72`
    (`SpeciesLinks`, à sortir dans son propre fichier de `components/`) ;
  - `ExternalLink.tsx`, `src/config/account.ts:46-53`, `src/styles/global.css`,
    `src/components/SeriesGrid.tsx:47`.
- **Changement** :
  - `Unavailable` avec `useRetry` partout, et une seule formule de délai ;
  - une seule page « introuvable » ;
  - `NoMatch` repris par le Catalogue et `SetPicker` ;
  - la date du prix sur la fiche ;
  - « — » à la place de 0,00 € quand rien n'est chiffré ;
  - `SpeciesLinks` partagé ;
  - `--camply-font-mono` (une variable publique) ;
  - `linked ? 'collection' : undefined`.
- **Tests** : aucun (interface).
- **Doc** : `docs/interface.md`, `docs/prix.md` (date du prix).
- **Comportement** : seulement l'interface.
- **Effort** : M.

**L12 — Navigation, compte et contraste élevé (site)**
- **Constats** : F-NAV-02, F-UX-10, F-UX-06, F-UX-11, F-A11Y-01, F-A11Y-07.
- **Fichiers** :
  - `src/components/AccountMenu.tsx`, `AppShell.tsx:75`, `:218`, `AppSearch.tsx:28-44` ;
  - `src/router.tsx:114` ;
  - `src/pages/collections/SeriesPage.tsx` ;
  - `src/pages/SignUpPage.tsx`, `LoginPage.tsx` ;
  - `src/styles/global.css`, `ProgressRuler.module.css`, `CardList.module.css`,
    `CatalogTile.module.css`.
- **Changement** :
  - l'icône `Settings` ;
  - `/reglages`, avec `/donnees` redirigée ;
  - un menu du compte avec le pseudo, « Voir mon Pokédex public » et « Mon compte » ;
  - des `keywords` pour Ctrl K ;
  - un fil d'Ariane et un filtre « Manquantes » sur la page d'une collection, la suppression en
    bas ;
  - « Afficher le mot de passe », et le format du pseudo vérifié à l'envoi ;
  - les règles `forced-colors` (`Highlight` sur `aria-current` et `aria-pressed`, la réglette).
- **Tests** : aucun (interface).
- **Doc** : `docs/interface.md`.
- **Comportement** : oui. Décision D-06 : la nouvelle adresse des Réglages.
- **Effort** : M.

#### Optimisation

**L13 — Logos sans métadonnées (données)**
- **Constats** : D-PERF-01.
- **Fichiers** : `../pokedex-data/worker/ingest/images.ts` (`mirror`, `:93`).
- **Changement** : retirer les blocs RIFF `XMP ` et `EXIF` avant d'écrire dans R2, effacer leurs
  drapeaux du `VP8X`, et réécrire la taille RIFF.
- **Tests** : `images.test.ts` : un WebP qui a un bloc `XMP ` est écrit sans lui, et l'image reste
  lisible. Une erreur ici abîmerait toutes les images : le test se justifie.
- **Puis** : A-03 (l'utilisateur recopie les deux logos).
- **Effort** : S.

### P3

#### Sécurité et coût

**L14 — Journal et Pokédex public (site, Worker)**
- **Constats** : B-SEC-03, B-VIT-01.
- **Fichiers** : `worker/collection.ts:213-215`, `worker/journal.ts:237-266`,
  `worker/vitrine.ts:231-232`.
- **Changement** :
  - le détail des changements une fois par minute et par compte (`journalOnce`), sinon une ligne
    de synthèse ;
  - l'ETag du Pokédex public calculé avant de demander les prix.
- **Tests** : `worker/tests/journal.test.ts` (une ligne par minute) ; `vitrine.test.ts` (un 304
  sans appel à `DATA`).
- **Effort** : S.

**L16 — Durcissements à décider (données et site)**
- **Constats** : D-SEC-12, D-FIA-06 ; et, en information dans B, le relais de toute méthode HTTP.
- **Fichiers** :
  - `../pokedex-data/worker/ingest/pokecardex.ts`, `net.ts`, `images.ts`, `json-stream.ts` ;
  - `../pokedex-data/worker/ingest/runs.ts`, `workflow.ts` et une migration ;
  - `worker/data.ts:23-27`.
- **Changement** :
  - lectures plafonnées (5 Mo) ;
  - `redirect: 'manual'` ;
  - script seulement de l'origine de la source ;
  - types d'images limités ;
  - `runs.instance`, avec sa migration ;
  - le relais limité à `GET` et `HEAD`.
- **Comportement** : D-FIA-06 ajoute une migration (DEC-21, décision D-12).
- **Effort** : S à M.

#### Optimisation

**L15 — API et tâches des données**
- **Constats** : D-PERF-03, D-PERF-04, D-PERF-05, D-PERF-06.
- **Fichiers** :
  - `../pokedex-data/worker/history.ts:21-42` ;
  - `worker/images.ts:23-63` ;
  - `worker/ingest/catalog.ts:173`, `ingest/images.ts:261-262` ;
  - `worker/ingest/years.ts:45-62`.
- **Changement** :
  - les historiques assemblés en texte ;
  - `MAX(sort)` et raretés gardés en mémoire du module (10 min) ;
  - réponses R2 écrites seulement si elles changent (MD5 contre ETag) ;
  - `INSERT` et `UPDATE` des années chacun sur ses lignes.
- **Tests** : ceux des historiques et des prix doivent rester verts. Un test pour l'assemblage en
  texte : il touche à l'historique, qui est irremplaçable.
- **Effort** : S chacun.

**L19 — Illustrations en WebP (les deux dépôts)**
- **Constats** : D-PERF-02.
- **Dépend de** : L09 (gabarits de chemins dans le contrat).
- **Changement** : une conversion ponctuelle, hors du Worker, puis des chemins `.webp` des deux
  côtés (`../pokedex-data/src/lib/image-paths.ts:37`, `src/config/pokedex.ts:74`).
- **Comportement** : décision D-10.
- **Effort** : M.

#### UX

**L17 — À décider avec vous (site)**
- **Constats** :
  - la direction visuelle (D-07) ;
  - F-UX-04, les raretés (D-08) ;
  - F-UX-05, F-UX-07, F-UX-09 ;
  - F-NAV-04 (D-09), F-NAV-05, F-NAV-06 ;
  - F-DS-02, F-SIMP-01, F-SIMP-02 (seulement si l'on retouche le Pokédex public).
- **Effort** : de S à M, selon les décisions.

**L18 — Dans camply (`../Camply-UI`), hors de ces dépôts**
- **Constats** :
  - F-MOB-02 : champs à 16 px sur écran tactile ;
  - F-MOB-06 : la croix des étiquettes ;
  - le remplissage de `Progress` en contraste élevé ;
  - la fermeture d'une fenêtre au `click` ;
  - `Radio.label` en `ReactNode` (DEC-07, F-CAMPLY-01) ;
  - le contour des radios (A11Y-02 du 2 novembre).
- **Ici, en attendant** :
  - ajouter le cas `Radio` aux « Known gaps » du skill `camply-ui`
    (`.claude/skills/camply-ui/SKILL.md`) ;
  - pour F-MOB-02, le relais par classe interne de camply : seulement si la décision D-13 le
    retient.

## 4. Décisions à prendre

| Id | Question | Proposition |
|---|---|---|
| D-01 | En `expired`, garder les modifications, ou les bloquer ? (L01) | Les garder, avec une bannière, la version locale gardée et exportable si elle est remplacée. Les bloquer toucherait chaque action de l'app. |
| D-02 | Limiter `/api/status` et `/api/health` ? (L02) | Oui, dans `DATA_LIMIT` (400 par 10 s) : loin d'une surveillance normale. **Validée** le 10 novembre 2026. |
| D-03 | Le seuil des refus par pseudo (L03) | 20 par heure. Contrepartie : un tiers peut bloquer une heure la connexion à un pseudo, et le message le dit. **Validée** le 10 novembre 2026. |
| D-04 | « Ajouter comme » (L06) | Un `Switch` « Je la possède déjà », éteint par défaut. |
| D-05 | DEC-12 : la clé des limites des données (L08) | Le /64, et les routes lourdes comptées par client. |
| D-06 | `/donnees` devient `/reglages` (L12) | Oui, avec une redirection. |
| D-07 | Direction visuelle (L17) | Les tuiles d'indicateurs seulement sur l'Accueil ; ailleurs, une ligne de résumé. |
| D-08 | Synonymes des raretés (L17) | Une table côté site (`lib/card-catalog.ts`), sans toucher au contrat ni à R2. |
| D-09 | ← et → sans empiler l'historique (L17) | `replace: true`. |
| D-10 | Illustrations en WebP (L19) | Oui, après L09. |
| D-11 | Seuil de la garde des séries retirées (L07) | Refuser au-delà de 3 séries, ou d'une série de plus de 20 cartes. |
| D-12 | Migration `runs.instance` (L16, DEC-21) | Plus tard, avec la prochaine migration des données. |
| D-13 | Champs à 16 px avant camply : relais par classe interne ? (L18) | Attendre camply, sauf gêne réelle sur iPhone (A-05). |

## 5. Ce que le plan ne fait pas (refontes évitées)

- **Pas de fusion des collections** pour B-SYNC-01 : le serveur gagne toujours, et on garde la
  version locale à exporter.
- **Pas de hors-ligne ni de sauvegarde** (décisions d'octobre 2026). Pas de blocage de toutes les
  actions en `expired`, sauf si D-01 le décide.
- **Pas de refonte visuelle d'ensemble** : la direction visuelle reste une proposition (D-07).
- **Rien de réécrit sans besoin** :
  - `.stack-table` ;
  - le Pokédex public (F-SIMP-02, seulement si l'on y touche) ;
  - les paramètres d'adresse existants (F-NAV-06 : seulement les prochains en français).
- **Rien à faire sur F-PERF-01** (la connexion charge le code de l'accueil) : le choix est
  documenté et gardé.
- **Pas de précalcul de `/wants`** (SEC-02 du 2 novembre) tant que les limites suffisent.
- **Rien de nouveau côté sources** : aucune source ajoutée, aucune ingestion lancée par un lot.
- **Pas de lot pour le reste de SEC-05 du 2 novembre** (la ligne `# SERVER_ERROR:` de better-call,
  valeurs SQL comprises) : la question est déjà notée « à décider » dans `worker/journal.ts:23-25`.
- **Plausibles non prouvés, sans lot** : à rouvrir seulement s'ils se confirment.
  - B : un renvoi qui croise l'envoi d'origine (parade notée dans le rapport) ;
  - B : la mémoire de plusieurs envois simultanés ;
  - D-FIA-02 : un essai coupé qui écrirait encore.

## 6. Actions de l'utilisateur (hors code)

- **A-01 (P1)** : Bun 1.4.4 sur le poste, puis `bun install --frozen-lockfile` dans les deux dépôts.
- **A-02** : relancer `bun run dev` dans `pokedex-data`. Il migre la D1 locale (0002, 0003) et
  arrête le 301 en boucle.
- **A-03 (après L13)** : supprimer les deux logos (fr SVP, fr MEP) de R2, remettre `sets.logo` à
  `NULL`, puis lancer `bun run ingest images`.
- **A-04** : dans le tableau de bord, vérifier que la normalisation d'URL de la zone est active
  (D-SEC-08).
- **A-05** : sur un iPhone réel :
  - le zoom à la saisie (F-MOB-02) ;
  - la barre d'onglets du site installé (F-MOB-07) ;
  - la palette Ctrl K avec le clavier ouvert (F-MOB-07).
- **A-06** : si vous le souhaitez, supprimer les comptes de test locaux (`audit0934`,
  `audit-sync-a1`).
- **A-07** : mesures en ligne utiles :
  - durées des étapes du Workflow : `npx wrangler workflows instances describe ingest <id>`,
    pour D-FIA-02 ;
  - poids des logos servis.

## 7. Index par catégorie

| Catégorie | Constats | Lots |
|---|---|---|
| **Bug** | B-SYNC-01, F-NAV-01 | L01 (P0) |
| | F-A11Y-02, F-ETAT-03, B-SYNC-03 | L04 (P1) |
| | F-MOB-01, F-MOB-03, F-MOB-04, F-A11Y-03, F-A11Y-04, F-A11Y-05 | L05 (P1) |
| | D-FIA-01, D-FIA-02, D-FIA-05, D-SEC-09 | L07 (P2) |
| | D-INTEG-01 à 04, B-SYNC-04 | L09 (P2) |
| | D-FIA-06 | L16 (P3) |
| **Sécurité** | B-SEC-01, D-SEC-10 | L02 (P1) |
| | B-SEC-02, B-SEC-04 | L03 (P1) |
| | D-SEC-04, D-SEC-08, D-SEC-11 | L08 (P2) |
| | B-SEC-03 | L14 (P3) |
| | D-SEC-12, relais de toute méthode | L16 (P3) |
| **Tests** | B-SYNC-02, B-SYNC-05, D-FIA-03, D-FIA-04 | L10 (P2) |
| **UX** | F-UX-01, F-UX-02 | L06 (P1) |
| | F-ETAT-01, F-ETAT-02, F-UI-01, F-UI-02, F-UX-03, F-UX-08, F-LIB-01, F-NAV-03, F-A11Y-06, F-A11Y-08, F-MOB-05, F-DS-01 | L11 (P2) |
| | F-NAV-02, F-UX-10, F-UX-06, F-UX-11, F-A11Y-01, F-A11Y-07 | L12 (P2) |
| | Direction visuelle, F-UX-04, F-UX-05, F-UX-07, F-UX-09, F-NAV-04 à 06, F-DS-02, F-SIMP-01, F-SIMP-02 | L17 (P3) |
| | F-MOB-02, F-MOB-06, F-CAMPLY-01 (camply) | L18 (P3) |
| | F-MOB-07 | A-05 |
| **Optimisation** | D-PERF-01 | L13 (P2) |
| | F-PERF-02 | L11 (P2) |
| | B-VIT-01 | L14 (P3) |
| | D-PERF-03 à 06 | L15 (P3) |
| | D-PERF-02 | L19 (P3) |
| | F-PERF-01 | aucun (choix documenté) |
| **Environnement** | B-ENV-01, la note d'environnement de D | A-01, A-02 |

Chaque constat des trois rapports figure dans une ligne de ce tableau, ou au § 5 (plausibles non
prouvés et choix gardés).
