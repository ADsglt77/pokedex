# Compte, synchronisation et Pokédex public

Le seul compte, la collection synchronisée entre les appareils, le Pokédex public. Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

- Comptes et synchronisation (`server/auth.ts`, `server/collection.ts`, `lib/sync.ts`,
  `store/sync.ts`) : Better Auth, e-mail et mot de passe, **un seul compte**, celui de
  l'utilisateur (les invitations ont été retirées à sa demande, octobre 2026). Tant qu'il n'existe
  pas, c'est la première visite : `GET /api/account` répond `{ exists: false }` et le routeur (créé
  après cette réponse, `main.tsx` : ses `loader` lisent `accountExists` dès sa création) mène toute
  page à `/bienvenue` (`WelcomePage`, hors de la coquille), un formulaire : pseudo (le `name` de
  Better Auth, montré dans le menu du compte), e-mail, mot de passe (8 caractères au moins). Le
  premier compte créé est le seul (décision de l'utilisateur, octobre 2026 : plus de code de
  première visite ni de `create-user.ts`) : ensuite, plus aucune inscription (403 avant même Better
  Auth), la base refuse un second compte (déclencheur `one_account` sur `user`, même pour deux
  créations simultanées), et `/bienvenue` mène à `/connexion`. Seule l'adresse `ACCOUNT_EMAIL`
  (variable du serveur, exigée en production : `server/index.ts` refuse de démarrer sans elle ;
  facultative en développement) peut le créer : un visiteur arrivé avant l'utilisateur ne peut pas
  le prendre (403 d'emblée, sans dire si l'adresse est la bonne ; « Création refusée » au journal),
  sauf s'il connaît cette adresse : l'e-mail n'est pas vérifié, le compte se crée donc juste après
  le premier démarrage (README, mise en ligne). La garde ne lit que du JSON (une création envoyée
  autrement est refusée : Better Auth lirait aussi un formulaire, autrement qu'elle), et Better Auth
  vérifie aussi l'adresse qu'il enregistre vraiment (`databaseHooks.user.create.before`) ; au-delà
  de 5 refus d'emblée par minute et par visiteur, 429 (on ne devine pas l'adresse en essayant sans
  fin). Un code de première visite reste possible, mais il a été retiré à la demande de
  l'utilisateur.
  Pas de mot de passe oublié (le site n'envoie pas d'e-mail). **Une seule session par compte** :
  se connecter sur un appareil déconnecte les autres (crochet `session.create.after`) ; l'appareil
  déconnecté garde ses modifications et affiche « Reconnectez-vous ». Sessions de 60 jours,
  renouvelées chaque jour d'usage, dans un cookie (`__Secure-` en https, SameSite Lax) : le cookie
  renouvelé repart avec la réponse de `GET /api/account` et des routes du compte (`sessionOf`, dans
  la macro `auth` aussi, sans quoi la synchronisation au retour de la page consommerait le
  renouvellement du jour ; sans lui, le navigateur garderait l'ancien cookie et il faudrait se
  reconnecter au bout de 60 jours). Les réponses de ces routes ne sont jamais gardées en cache
  (`no-store`, macro `auth`). En production, 5 tentatives de connexion ou de création du compte
  par minute et par visiteur (`cf-connecting-ip`) ; devant, nginx limite toute la connexion
  (`/api/auth/`) à 2 requêtes par seconde et par visiteur, 20 d'un coup. Au journal, une connexion
  ou une création refusée, une connexion bloquée : une ligne par visiteur (son réseau /64 en
  IPv6) et par minute au plus, les autres comptées (`journalOnce`, `server/journal.ts`), et l'e-mail
  seulement s'il en a l'air (une arobase : un mot de passe collé par erreur dans ce champ n'y est
  jamais écrit). Les messages de Better Auth y sont écrits en détail, échappés et coupés, une fois
  par minute au plus pour un même début : il recopie ce qu'envoie un visiteur (« Invalid
  callbackURL: … »), qui écrirait sinon de fausses lignes ou des codes de terminal. **L'app ne s'ouvre que connecté** (décision de
  l'utilisateur, octobre 2026 : vitrine pour un visiteur, tableau de bord pour lui ; plus de
  collection « dans ce navigateur » sans compte, ni de rappel de sauvegarde) : le compte connecté
  du store (`account`, `store/sync.ts` ; `null` : personne), fixé au démarrage avant le routeur
  (`loadAccount` lit `GET /api/account?demarrage`, qui dit en une requête si le compte existe et
  qui est connecté ; `index.html` le précharge, avec les espèces, sans attendre le script ; et
  `main.tsx` passe ce compte à `startSession` ; sans réponse du serveur, en 15 s, ou en 4 s pour un
  appareil déjà synchronisé (`syncedBefore` : un réseau faible ne le fait pas attendre), un
  appareil déjà synchronisé et pas déconnecté l'est encore, pour marcher hors ligne, avec l'e-mail
  et le pseudo gardés dans `pokedex-collection.sync`), puis à la connexion et à la création du compte
  (`signIn`, d'après la réponse de Better Auth, qui lance la synchronisation, une seule fois : elle
  commence, ou reprend après une session expirée ; `LoginPage` ne la relance pas) et à la
  déconnexion. Plus de `useSession` de
  Better Auth (il redemandait la session à chaque montage) : le routeur, le menu du compte et le
  Pokédex public lisent le store (`account`). Le compte : Données › Mon compte (`AccountSection`), le pseudo (`updateUser`) et le
  mot de passe (`changePassword`, l'actuel exigé, les autres sessions fermées ; 5 essais par
  minute), au journal. Un mauvais mot de passe actuel (400) le dit ; une session fermée (401 : une
  connexion sur un autre appareil) dit « Session expirée », jamais « mot de passe incorrect » (pas
  de mot de passe oublié : l'utilisateur croirait le sien perdu), et le menu du compte propose de se
  reconnecter (`markExpired`). Les réponses du client Better Auth passent par `authCall`
  (`lib/auth.ts` : sans réponse du serveur, un refus de statut 0) et leurs messages par
  `refusalMessage` (`lib/account.ts`). Pas connecté, `/` mène à `/vitrine` et toute autre page
  de la coquille à `/connexion?retour=…` (`appLoader`, `router.tsx`) ; `/connexion` est hors de la
  coquille, comme `/bienvenue`, et mène aussi au Pokédex public. Se déconnecter ramène à la vitrine.
  Le Pokédex public (`/vitrine`, à sa demande, octobre 2026) : une adresse fixe, **toujours
  publique** (plus de réglage : la colonne `public` de `collections` est retirée), la page
  d'accueil d'un visiteur ; en tête, « Se connecter », ou « Mon Pokédex » une fois connecté ;
  son titre : « Le Pokédex de … » (`pokedexTitle`), le pseudo du compte (`GET /api/vitrine` :
  `{ owner, collection, prices }`, `VitrineData`). `prices` : les prix du jour de ses seules cartes
  possédées (`readPrices`, `server/jobs/prices.ts`), `null` sans guide des prix (la valeur est
  alors « — ») ; un ETag tiré de la version de la collection, du pseudo et du passage de la tâche
  `prices` (`serveTagged`) : un visiteur qui revient reçoit un 304, sans que la collection soit
  relue.
  Données › Pokédex public en donne l'adresse. Un lien partagé (Discord, WhatsApp…) a son aperçu :
  nginx envoie les robots d'aperçu (`map $vitrine_preview`, `deploy/nginx.conf`) à
  `/api/vitrine/apercu`, une page faite par le serveur avec le titre et la progression
  (`vitrineSummary`, testé : rien d'autre que le pseudo et le nombre de Pokémon débloqués). Une page seule, hors de la coquille, en lecture seule et pas indexée (`noindex`) : la progression, les régions (la réglette n'y est qu'une image, `linked` faux, et pas
  un lien vers le Pokédex, qui demande d'être connecté ; sur téléphone, leur liste), la valeur au
  prix du jour, la courbe des Pokémon débloqués et le classeur (débloqués en couleur, cartes
  choisies grisées ; les pochettes ne mènent pas aux fiches, celles du visiteur). Le serveur ne
  montre que les cartes (sans leur page notée) et les possessions avec leur date
  (`shownCollection`, testé) : jamais un prix payé, une commande, le budget, la liste d'achats ni
  le statut « commandée » ; une collection vide tant qu'aucun appareil n'a rien envoyé. Il montre
  la version que le serveur a reçue. La page la lit une fois (`getJson`, gardée pour la vie de la
  page) et la relit après une connexion ou une déconnexion (`forget`, `signIn` et `signOut` de
  `store/sync.ts`) : déconnecté, on ne revoit pas la vitrine d'avant les changements de la session.
  Au journal, une visite (« Pokédex public consulté ») ou un aperçu (« Lien partagé lu ») une fois
  par visiteur et par heure au plus (`journalOnce`, son réseau /64 en IPv6). La version de la
  collection et la collection, le jour des prix et les prix sont lus dans une même transaction de
  chaque base (une écriture entre deux partirait avec l'ancien ETag) ; l'image d'une carte n'y passe
  que par ses deux adresses (`small`, `large` : ce qu'un fichier importé y aurait glissé en plus ne
  devient pas public, testé). La route elle-même est testée sur le serveur entier
  (`tests/collection.test.ts`) : sans session, jamais un prix payé, une commande ni un statut
  « commandée », et les prix des seules cartes possédées. Connecté, la collection et les achats
  forment un seul document par compte (une commande modifie les deux), dans `app.db`, numéroté par
  le serveur, avec une empreinte tirée de ce qu'il a enregistré (`tag` : après une restauration de
  la base, un numéro peut revenir pour un autre document ; ETag `"v<version>-<tag>"`).
  `/api/collection` : `PUT` refusé, 409, corps `null`, si l'appareil part d'une version dépassée,
  en avance, ou d'un autre document au même numéro (`baseTag`), testé sur le serveur entier avec
  304, 401, 403, une mise à jour, la version remplacée gardée et un document refusé (400),
  `tests/collection.test.ts` : il relit alors la version du serveur et compare de nouveau ;
  accepté, la réponse donne `{ version, tag }` ; le document passe les contrôles d'un import
  (`readSent` : refusé, la règle en cause au journal). Une modification d'une autre origine est
  refusée (403) avant même la lecture de son corps (`parse` de la macro `auth`, `ForeignOrigin` :
  pas de 422 qui renverrait ce qui a été envoyé), et notée au journal (une fois par minute) : elle
  dit un réglage à revoir (`BETTER_AUTH_URL`) ou une tentative depuis un autre site. Le navigateur
  garde sa copie (hors ligne, l'app marche ; l'envoi part au retour du réseau) et note la dernière
  version échangée (`pokedex-collection.sync` : version, empreinte du serveur et empreinte SHA-256
  du document ; les deux autres clés gardent leur format) : il synchronise une seconde après une
  modification, au retour de la page et du réseau, et 30 s après une panne passagère (hors ligne,
  502 pendant un redémarrage, réponse illisible) ou trois échanges sans aboutir (l'appareil ou le
  serveur changeait à chaque fois), un onglet à la fois (`navigator.locks`). Un envoi resté sans
  réponse (coupé, délai dépassé) est retenu : si le serveur montre ensuite ce document à la version
  attendue, c'est celui de cet appareil, qui devient la version échangée, sans fausse question de
  conflit. Un refus pour de bon (400 et 422 : un document qui ne passe pas les contrôles ; 413 :
  plus de 5 Mo ; 403 : une origine refusée) donne « Envoi refusé », avec sa raison (la règle en
  cause, relue par l'appareil avec le même code, `documentProblem`) ; rien ne repart tout seul.
  Une erreur imprévue pendant l'échange est écrite en console (elle se lirait sinon « Hors
  ligne »). La règle (`decide`, testée) : seul cet appareil a changé, il envoie ; seul le serveur,
  il reprend ; les deux, une fenêtre fait choisir la version à garder (`SyncConflictDialog`, avec
  un export de celle de l'appareil ; jamais de fusion, comme à l'import) ; de même si le serveur en
  est à une version plus ancienne que celle échangée (sa base restaurée d'une sauvegarde), ou au
  même numéro avec une autre empreinte (la base restaurée, puis un autre appareil revenu à ce
  numéro). Le conflit réglé dans un autre onglet (la version échangée a changé) ferme la question
  ici aussi ; « Garder celle du serveur » ne reprend rien si la version échangée a changé depuis la
  question. Une collection ou des achats illisibles dans ce navigateur (abîmés, d'un format que ce
  code ne lit pas) sont mis de côté (`<clé>.illisible`) et signalés (un bandeau) ; la version
  échangée est alors ignorée jusqu'à la prochaine (`setAsideUnreadable`, `store/persist.ts`) : le
  vide qui les remplace n'est jamais envoyé comme un effacement voulu, la version du serveur est
  reprise, ou la question posée. Entre deux onglets, une valeur reprise de l'autre n'est jamais
  réécrite (`persist`, testé : deux changements en attente, traités d'affilée, feraient se renvoyer
  ces valeurs jusqu'à s'arrêter sur une ancienne, les dernières modifications perdues). Un budget réglé compte comme un contenu (`isEmptyDocument`). Lire,
  comparer et remplacer le document (collection et achats ensemble) : `store/document.ts`. Avec une seule session, ce cas ne vient plus que d'un appareil déconnecté avec des
  modifications pas encore envoyées, qui se reconnecte : la fenêtre reste le filet de sécurité. À
  la première connexion d'un appareil, celui qui a quelque chose l'envoie (ou le reçoit). Le
  serveur garde une version remplacée par heure, 30 jours (`collection_versions`, à reprendre à la
  main). Se déconnecter vide la copie de ce navigateur (appareil partagé) ; si un envoi a échoué,
  la confirmation le dit et porte un bouton d'export (`ExportCollectionButton`). « Annuler », l'import, « Effacer » sont des modifications comme
  les autres : connecté, elles valent pour tous les appareils (les textes de la page Données le
  disent). Le compte (`AccountMenu`, en pied de la barre latérale, ou en icône dans la barre du haut
  sur petit écran ; seulement connecté) montre l'état : synchronisation, synchronisée, hors ligne,
  reconnectez-vous, à choisir, envoi refusé (avec sa raison) ; « Déconnexion… » pendant une
  déconnexion, qui attend une dernière synchronisation puis le serveur ; son menu a une seule
  action selon l'état (« Choisir
  la version à garder » pendant un conflit, où la synchronisation attend le choix ; « Se
  reconnecter » après une session expirée ; sinon « Synchroniser maintenant »), puis « Se
  déconnecter ». La question d'un conflit fermée (« Plus tard ») est gardée dans le store
  (`setConflictQuestion`) : le menu change de place quand l'écran tourne. `/connexion`
  (`LoginPage`) ramène à la page d'où l'on venait (`?retour=`, filtres compris ; seulement une
  adresse du site : même origine, `/\exemple.fr` refusé).
