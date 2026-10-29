# Compte, collection et Pokédex public

Les comptes, la collection de chaque compte (gardée par le serveur, la même sur tous ses appareils), le Pokédex public de chaque compte. Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

- Le serveur du site : le Worker (`worker/`, Hono, Drizzle et D1, sur Cloudflare Workers) ; ses
  tests le traversent entier, dans le moteur de Cloudflare (`worker/tests`).
- Comptes (`worker/auth.ts`, `config/account.ts`) : Better Auth, **un compte par personne**, que
  chacun crée (décision de l'utilisateur, octobre 2026 : l'app est ouverte à tous). Les règles du
  serveur sont dans l'en-tête et les commentaires de `worker/auth.ts` : le pseudo gardé deux fois
  (`guard`), pas d'e-mail (une adresse sans boîte, jamais montrée), les derniers pseudos quittés
  réservés par la base (ses déclencheurs, `worker/migrations/0001_pseudos.sql`), une seule session par compte, des sessions de 60 jours,
  les limites par visiteur, ce que note le journal. Testés sur le Worker entier
  (`worker/tests/account.test.ts`, `worker/tests/collection.test.ts`) : l'adresse sans boîte, un pseudo pris ou quitté jamais repris par
  un autre compte (le sien peut le reprendre), les adresses du site refusées, la suppression du
  compte avec sa collection. `/inscription` (`SignUpPage`, hors de la coquille) : un pseudo
  (`PSEUDO` : 2 à 20 caractères, lettres sans accent, chiffres, `-` et `_`, de quoi tenir dans une
  adresse) et un mot de passe (8 caractères au moins). Pas de mot de passe oublié : le mot de passe
  perdu, le compte l'est aussi (l'inscription et Mon compte le disent). Les mentions légales et la
  confidentialité (`/mentions-legales`, `LegalPage`, liées du pied de chaque page,
  `SiteDisclaimer`) disent ce que le site garde, pourquoi et sur quelle base légale (le service
  demandé ; l'intérêt légitime pour le journal), combien de temps (un compte supprimé reste au
  plus 30 jours dans l'historique de D1, Time Travel ; le journal du serveur, Workers Logs, 7
  jours), qui le voit (l'hébergeur, Cloudflare, Inc., société américaine : le transfert encadré
  par le Data Privacy Framework ; les comptes et les collections gardés dans l'Union européenne,
  la base D1 créée avec `--jurisdiction eu`), ce qu'une image collée révèle (l'adresse IP de qui
  la voit, à son site) et comment s'opposer ou limiter : à tenir à jour avec le serveur ; le site,
  l'hébergeur, où sont gardés les comptes et le contact viennent de `config/legal.ts`.
  Se connecter : `/connexion`
  (`LoginPage`), le pseudo (n'importe quelles majuscules) et le mot de passe (`signIn.username`) ;
  elle ramène à la page d'où l'on venait (`?retour=`, filtres compris ; seulement une adresse du
  site : même origine, `/\exemple.fr` refusé).
  Réglages › Compte & partage › Mon compte (`AccountSection`) : le pseudo (`updateUser`, `name` et `username` ensemble ;
  l'adresse du Pokédex public change avec lui, l'ancienne ne mène plus à rien), le mot de passe
  (`changePassword`, l'actuel exigé, les autres sessions fermées) et la suppression du compte
  (`deleteUser`, son mot de passe exigé ; après une confirmation qui propose l'export) : sa
  collection part aussitôt de la base, sans autre copie que son historique, 30 jours au plus (D1
  Time Travel ; aucune sauvegarde). Un mauvais mot de passe (400) le dit ;
  une session fermée (401 : une connexion sur un autre appareil) dit « Session expirée », jamais
  « mot de passe incorrect » (l'utilisateur croirait le sien perdu), et le menu du compte propose
  de se reconnecter (`markExpired`) ; un pseudo pris (`USERNAME_IS_ALREADY_TAKEN`) le dit. Les
  réponses du client Better Auth passent par `authCall` (`lib/auth.ts` : sans réponse du serveur,
  un refus de statut 0) et leurs messages par `refusalMessage` (`lib/account.ts`). Un appareil
  dont la session a été fermée par une connexion ailleurs affiche « Reconnectez-vous ». Le
  cookie renouvelé de la session repart aussi avec les réponses des routes
  de la macro `auth` (`sessionOf`) : sans quoi la relecture de la collection au retour de la page
  consommerait le renouvellement du jour. Les réponses de ces routes ne sont jamais gardées en
  cache (`no-store`). Une modification (ni `GET` ni `HEAD`) venue d'une autre origine est refusée
  (403) avant la lecture de son corps, sur toute adresse du serveur, `/api/auth/*` compris
  (`onRequest` de `accountRoutes`) : un autre site ne connecte pas un visiteur à un compte qu'il ne
  connaît pas (testé). Devant les limites de Better Auth, le Worker limite tout le compte
  (`/api/auth/`), avec le Pokédex public (`/api/vitrine/`), à 40 requêtes par 10 s et par
  visiteur (`worker/limits.ts`).
- **L'app ne s'ouvre que connecté** (décision de l'utilisateur, octobre 2026) : le compte connecté
  du store (`account` : son id et son pseudo ; `null` : personne, `store/account.ts`), fixé au
  démarrage avant le routeur (`loadAccount` lit `GET /api/account?demarrage`, qui dit qui est
  connecté ; `index.html` le précharge, sans attendre le script ; et `main.tsx` lit alors sa
  collection, `signIn` ; sans réponse du serveur en 15 s, « Le Pokédex ne peut pas s'afficher »,
  `PokedexUnavailable`), puis à la connexion et à la création du compte (`signIn`, d'après la
  réponse de Better Auth : la page attend la collection avant d'ouvrir l'app) et à la
  déconnexion. Les espèces (l'API des données) ne sont attendues que par la coquille et le Pokédex
  public (`needSpecies`, le chargement de leur route, `router.tsx` ; sans elles, « Le Pokédex ne
  peut pas s'afficher », par `ErrorPage`) : la connexion, l'inscription et les mentions légales
  s'affichent sans l'API des données, et un visiteur ne les télécharge pas. Connecté, elles sont
  demandées avec la collection (`signIn`), et le Worker les fait précharger avec la page quand le
  navigateur a une session (`Link`, d'après le cookie de Better Auth, `worker/headers.ts`). Le
  routeur, le menu du compte et le Pokédex public lisent le store (`account`), jamais `useSession`
  de Better Auth, qui redemande la session à chaque montage. Pas connecté, `/`
  mène à `/connexion` et toute autre page de la coquille à `/connexion?retour=…` (`appLoader`,
  `router.tsx`) ; `/connexion` et `/inscription` sont hors de la coquille et mènent l'une à
  l'autre. Se déconnecter, ou supprimer son compte, ramène à la connexion.
- Le Pokédex public de chaque compte (`/pseudo`, `VitrinePage` ; à la demande de l'utilisateur,
  octobre 2026) : **toujours public**, sans réglage. Toute adresse d'un seul segment qui n'est pas
  une page du site y mène (la route `:pseudo`, `isPseudo`, `lib/account.ts`) : les premiers
  segments des adresses du site sont des pseudos réservés (`RESERVED_PSEUDOS`,
  `config/account.ts` : refusés à l'inscription et au changement de pseudo, testé ; une nouvelle
  page de premier niveau s'y ajoute ; un compte qui porterait déjà son nom n'y a jamais son
  Pokédex : le serveur ne cherche qu'un pseudo possible, `isPseudo`, testé). Ce qui n'est pas un
  pseudo (`/achat`, `/a.b`) y est une page introuvable, comme un pseudo qui n'est à personne (404
  du serveur : « Rien à cette adresse »). En tête, « Se connecter » et « Créer un compte », ou « Mon
  Pokédex » une fois connecté ; son titre : « Le Pokédex de … » (`pokedexTitle`), le pseudo du
  compte (`GET /api/vitrine/<pseudo>`, sans tenir compte des majuscules :
  `{ owner, collection, prices }`, `VitrineData`). `prices` : les prix du jour de ses seules cartes
  possédées, que le serveur demande à l'API des données (`dataPrices`, `/v1/prices` par sa liaison
  de service, `dataFetch`, sans token, 5 s au plus ; par paquets de 1 000 ids, `idBatches` :
  elle en refuse plus de 1 025 ; l'un après l'autre, réponses réunies, et 5 paquets au plus,
  `MAX_PRICE_BATCHES` : la page est publique, sans session, et une visite ne doit pas lancer des
  dizaines de demandes ; testé avec une fausse API : seulement les ids de ces cartes,
  1 001 cartes en deux demandes dans l'ordre, jamais deux à la fois, 5 000 en cinq, 5 001 en
  aucune), `null` sans carte possédée, au-delà de 5 000 cartes possédées avec un id Cardmarket
  (rien n'est demandé), sans guide des prix ou l'API muette, pour l'un des paquets aussi (les
  suivants ne sont pas demandés : une valeur partielle serait fausse ; la valeur est alors « — »,
  et une ligne au journal par minute au plus) ; un ETag tiré du compte,
  de son contenu (`serveJson`) : un visiteur qui revient sur un Pokédex inchangé reçoit un 304.
  Réglages › Compte & partage › Pokédex public en donne l'adresse (`vitrinePath`). Un lien partagé (Discord,
  WhatsApp…) a son aperçu : le Worker répond lui-même aux robots d'aperçu, sur toute adresse d'un seul
  segment (`linkPreview`, `worker/vitrine.ts`), par une page faite pour eux (l'aperçu du site pour une page du site ou un pseudo à personne)
  avec le titre et la progression (`vitrineSummary`, testé : rien d'autre que le pseudo et le
  nombre de Pokémon débloqués). Une page seule, hors de la coquille, en lecture seule et pas
  indexée (`noindex` dans la page, et l'en-tête `X-Robots-Tag`, `worker/headers.ts`) : la
  progression, les régions (la réglette n'y est qu'une image, `linked`
  faux, et pas un lien vers le Pokédex, qui demande d'être connecté ; sur téléphone, leur liste),
  la valeur au prix du jour, la courbe des Pokémon débloqués et le classeur (débloqués en couleur,
  cartes choisies grisées ; les pochettes ne mènent pas aux fiches, celles du visiteur), puis ses
  collections d'extensions s'il en a (`series`, la section « Collections » de `VitrinePage` ; le
  classeur comptant plus de 1 000 pochettes, « Voir ses collections » sous le titre y mène, une
  ancre `#collections`) : pour chacune sa ligne (`SeriesLine` : son nom pour titre et le drapeau
  de sa langue, ses cartes possédées sur toutes, leur valeur au prix du jour, « — » sans prix,
  `seriesProgress` sur les prix reçus) et toutes ses cartes en lecture seule (`SeriesGrid`,
  `linked` faux : possédées en couleur, les autres grisées, « à débloquer » pour le lecteur
  d'écran), jamais ce qu'il faudrait pour la compléter, un prix payé ni une commande. Le serveur
  ne montre que les cartes (avec leur langue, sans leur page notée), la carte favorite de chaque
  Pokémon (`favorites`, celle qu'on montre pour lui), les collections d'extensions (`series` :
  l'extension, sa langue, son nom, son jour de début et ses cases, recopiés un à un ; leurs cases
  pas encore obtenues sont des cartes marquées `seriesOnly`, sans quoi la page les compterait au
  Pokédex) et les possessions avec leur date (`shownCollection`, testé) : jamais un prix payé, une
  commande, le budget, la liste d'achats ni le statut « commandée » (une case commandée n'a pas de
  statut) ; une collection vide tant qu'aucun appareil n'a rien envoyé. Il montre
  la version que le serveur a reçue, relue comme un fichier (`readCollection`) : un document
  enregistré avant les favorites n'en a pas, et chaque Pokémon y reçoit sa première carte, celle
  qu'il montrait jusque-là, sans rien faire (testé sur la route). La page la lit une fois
  (`getJson`, gardée pour la vie de la page) ; celle du compte est relue après une connexion, une
  déconnexion ou un changement de pseudo (`forget`, `store/account.ts`). Au journal, une visite (« Pokédex public consulté ») ou un aperçu
  (« Lien partagé lu ») une fois par visiteur, par Pokédex et par heure au plus (`journalOnce`, son
  réseau /64 en IPv6). L'image d'une carte n'y passe que par ses deux adresses (`small`, `large` : ce
  qu'un fichier importé y aurait glissé en plus ne devient pas public, testé). La route elle-même
  est testée sur le Worker entier (`worker/tests/collection.test.ts`) : le pseudo sans tenir compte des
  majuscules, 404 pour un pseudo qui n'est à personne ou un compte supprimé, sans session jamais
  un prix payé, une commande ni un statut « commandée », les prix des seules cartes possédées, un
  Pokédex enregistré avant les favorites montré avec la première carte de chaque Pokémon, et les
  collections d'extensions montrées avec leurs cases.
- La collection (`worker/collection.ts`, `store/account.ts`) : la collection et les achats
  forment un seul document par compte (une commande modifie les deux), gardé par le Worker seul,
  dans sa base D1 (`collections`) ; chaque compte ne lit et n'écrit que le sien (testé : un second compte ne voit ni
  ne touche celui du premier). Rien n'est gardé dans le navigateur (seul le choix du thème) : pas
  d'usage hors ligne, pas de copie à synchroniser (décision de l'utilisateur, octobre 2026). Le
  navigateur lit le document à la connexion (ou au démarrage, avant le premier affichage : sans
  lui, « Le Pokédex ne peut pas s'afficher »), le garde en mémoire, et envoie chaque modification
  une demi-seconde après, un échange à la fois ; aussitôt si la page passe en arrière-plan (un
  téléphone peut la geler, puis la fermer, avant la demi-seconde). Une modification faite pendant
  la préparation d'un envoi n'est pas comptée avec lui : elle part ensuite (testé). L'envoi part
  compressé (`CompressionStream('gzip')`, `Content-Encoding: gzip` : 2 Mo en font 400 Ko),
  décompressé par le Worker (`gunzipSync` de `node:zlib`, qui s'arrête au plafond :
  `DecompressionStream` décompresse tout ce qu'il reçoit sans attendre qu'on le lise), 413 au-delà
  de 5 000 000 octets décompressés (`MAX_DOCUMENT`, `types.ts`), sans jamais décompresser plus
  (une « bombe » gzip, testée : 100 Mo décompressés pour 100 Ko envoyés, suivis d'octets
  illisibles, qui feraient un 400 si elle était lue jusqu'au bout) ; 413 aussi au-delà de 5 Mo
  tels qu'envoyés. Et seulement avec une session : elle est lue avant le corps (`signedIn`), sans
  elle 401 sans rien lire ; le cookie renouvelé repart avec la réponse (testé). Une panne en
  lisant la session (la base occupée) : 500, l'appareil réessaie (un 400 dirait « Envoi refusé »,
  un 401 la session fermée, testé) ; un corps illisible, compressé ou non, 400, sans rien au
  journal (n'importe qui peut l'envoyer, testé). Un envoi non compressé reste accepté : sans `CompressionStream` (Safari avant
  16.4, Firefox avant 113), le navigateur l'envoie tel quel (testé). Son délai grandit avec lui
  (15 s, plus 10 s par Mo envoyé). Le document est numéroté
  par le serveur : `PUT /api/collection` `{ account, baseVersion, collection, shopping }` est
  refusé, 401, si `account` n'est pas le compte de la session (un envoi parti juste après une
  connexion à un autre compte, sur la même page, n'écrase jamais sa collection ; la connexion vide
  d'abord la mémoire et les envois en attente, `signIn`), et 409, corps `null`, si le navigateur
  part d'une autre version que celle du serveur (changée entre-temps par un autre onglet ou un
  autre appareil). Une base remise d'une copie (D1 Time Travel…) ne le garantit pas d'elle-même : ses
  numéros se répètent, un appareil resté sur la version 6 d'avant la lirait « inchangée » dans la
  copie, aussi à 6 mais d'un autre contenu, et son envoi, parti de la 6, serait accepté par-dessus
  ce qui a été enregistré depuis. Toute remise de la base finit donc par relever chaque
  numéro de l'heure en millisecondes (`UPDATE collections SET version = version + <Date.now()>`) : aucun appareil n'en détient un pareil, et chaque remise
  relève plus que la précédente, même celle d'une copie plus ancienne ; il relit la collection
  restaurée ou son envoi est refusé (409, puis relue). Sauf un envoi renvoyé tel quel après une
  réponse perdue (délai dépassé, réseau coupé : le serveur l'avait enregistré) : parti
  de la version d'avant, le même document que celui enregistré, il reçoit cette version, sans
  rien écrire ni noter ; le navigateur renvoie toujours d'abord, tel quel, un envoi resté sans
  réponse, puis ce qui a changé depuis (rien de perdu, rien de « Rechargée » ; ce renvoi refusé,
  ce qui a changé depuis part aussitôt). Testé sur le
  serveur entier avec 401, 403, une mise à jour, aucune version remplacée gardée, un document refusé
  (400), un envoi compressé, la bombe, l'envoi renvoyé reconnu et un autre document de la même
  version toujours refusé (409), `tests/collection.test.ts`. Après un 409, le navigateur relit la
  version du serveur, à la place de la sienne : rien n'est écrasé, sa dernière modification est
  perdue, et le menu du compte le dit (« Rechargée », et un toast : « Vos dernières modifications
  ont été remplacées par celles d'un autre appareil. ») ; sans réponse à cette relecture, « Hors
  ligne », et l'envoi repart plus tard (refusé, puis relu), de plus en plus tard tant que la
  relecture échoue. Accepté, la réponse donne
  `{ version }`, et les autres onglets du navigateur l'apprennent (`BroadcastChannel('collection')`
  : `{ account, version }`) : un onglet sans rien en attente relit alors la collection. Le
  document passe les contrôles d'un import (`readSent` : refusé, la règle en cause au journal,
  une ligne par compte, par statut et par minute au plus, testé), relus en une passe : le serveur
  n'a qu'un fil, et un document fait pour l'occuper (90 000 collections vides, quelques Ko
  compressés) le gelait 10 s quand chaque collection était cherchée dans toute la liste (moins
  d'une seconde, testé ; une carte porte au plus 1 025 Pokémon, sans quoi les favorites la
  parcourraient sans fin).
  Une modification d'une autre origine est refusée (403, plus haut) ; au journal, elle dit un
  réglage à revoir (`BETTER_AUTH_URL`) ou une tentative depuis un autre site. Sans réponse, ou une
  panne passagère (une erreur 5xx), ou trop d'envois d'affilée (429 : le Worker limite
  `/api/collection` à 40 requêtes par 10 s et par visiteur, `worker/limits.ts` ; testé), la
  modification attend (« Hors ligne », seulement
  quand une modification attend : une relecture qui échoue sans rien en attente ne change pas
  l'état) : elle repart au retour du réseau ou de la page, sinon de plus en plus tard (30 s, 60 s,
  120 s… 5 min au plus), et quitter la page le demande d'abord (`beforeunload`). Un refus pour de
  bon (400 : un document qui ne passe pas les contrôles ; 413 : plus de 5 Mo ; 403 : une
  origine refusée) donne « Envoi refusé », avec sa raison (la règle en cause, relue par le
  navigateur avec le même code sur le document envoyé, `documentProblem`) et un toast ; le
  document refusé ne repart pas
  tel quel, mais il reste à enregistrer : la déconnexion propose l'export, quitter la page le
  demande, et il n'est jamais remplacé par celui du serveur au retour sur la page ; seule une
  nouvelle modification (« Annuler » compris) repart. Le plafond tombe plus tôt qu'on ne croit :
  une case d'une collection d'extension pèse 320 octets pas encore obtenue, 463 possédée, 566
  possédée et achetée par une commande (mesuré, octobre 2026) ; le Pokédex compris, 5 Mo font
  environ 14 000, 9 700 ou 7 950 cases selon leur état, soit 61, 42 ou 34 extensions de 230
  cartes. Un compte qui progresse franchit donc le plafond sans commencer de collection : passé
  80 %, le menu du compte le dit (« Votre collection pèse 4,2 Mo sur les 5 Mo que garde le
  serveur… » ; le poids est connu dès la lecture du document, puis à chaque envoi), avec un toast
  une fois par page (à l'affichage du menu, la collection déjà lourde, ou au passage du seuil) ;
  au-delà, chaque envoi est refusé (« elle dépasse
  5 Mo »). Une session fermée (401, « Reconnectez-vous ») : plus rien ne part, ni ne se relit,
  jusqu'à « Se reconnecter » ; reconnecté au même compte, ce qui attendait reste et part, depuis sa
  version (changée ailleurs entre-temps : 409, puis relue) ; avec une modification en attente,
  « Se reconnecter » prévient d'abord qu'un autre compte la perdrait, avec le bouton d'export. Au
  retour sur la page, le document est relu (changé sur un autre appareil), si rien n'attend d'être
  envoyé, et seulement s'il a changé : `GET /api/collection?version=N` ne rend que
  `{ version, account }` quand le serveur a encore cette version, et rien n'est remplacé
  (« Annuler » garde ses références, rien ne se redessine). La lecture dit à quel compte est la
  collection (`account`) : celle d'un autre compte (connecté entre-temps dans un autre onglet) n'est
  jamais prise, l'état passe à « Reconnectez-vous ». Une modification faite pendant cette
  relecture n'est pas écrasée : elle part, depuis la version d'avant (changée ailleurs entre-temps :
  refusée, 409, puis relue, comme plus haut), et le menu n'affiche pas « Enregistrée » tant qu'elle
  attend (testé). Testé avec le store tel quel contre le Worker entier
  (`worker/tests/sync.test.ts`, sans DOM ; il attend chaque état attendu, et ne patiente un moment que
  pour vérifier que rien ne se passe) : le refus, la
  reconnexion, le retour sur la page, l'autre compte, la réponse perdue (et son renvoi refusé), le
  429,
  une modification pendant la compression, l'envoi compressé ou tel quel, la page en
  arrière-plan et l'autre onglet. Le
  serveur ne garde que la dernière version (aucune version remplacée, aucune sauvegarde : octobre
  2026 ; seul l'historique de D1, 30 jours, Time Travel). Il note au journal ce qui change d'une version à l'autre (`documentChanges`,
  `worker/journal.ts`), la version d'avant relue comme un fichier (`readCollection` : un document
  enregistré avant les collections d'extensions n'a pas de `series`, testé sur le Worker entier) :
  une collection d'extension commencée (« Collection commencée ») ou supprimée (« Collection
  supprimée ») est **une ligne** (son nom, sa langue, son nombre de cartes), jamais une par case,
  que des centaines de cartes soient ajoutées ou retirées avec elle (« Collection effacée » ne dit
  que la perte de vraies cartes : supprimer la dernière collection d'un compte dont rien n'est
  possédé ni commandé est « Collection supprimée ») ; une case obtenue est « Carte possédée », sans
  « Carte modifiée » (testé, `worker/tests/journal.test.ts`). L'export et l'import, que le navigateur
  signale (`POST /api/journal`) : une ligne par compte, par évènement et par minute au plus
  (`journalOnce` : un compte qui l'appellerait sans fin noierait le journal ; testé).
  « Annuler », l'import, « Effacer » sont des modifications comme les autres. Le compte
  (`AccountMenu`, en pied de la barre latérale, ou en icône dans la barre du haut sur petit écran ;
  seulement connecté) montre son pseudo et l'état : enregistrée, enregistrement, hors ligne
  (« Réessayer maintenant »), reconnectez-vous (« Se reconnecter »), rechargée, envoi refusé
  (avec sa raison), et le poids passé 80 % ; puis « Se déconnecter » ; une modification pas encore
  enregistrée, la déconnexion le demande d'abord, avec un bouton d'export
  (`ExportCollectionButton`). Sur téléphone, le menu n'est qu'une icône : « Rechargée » et « Envoi
  refusé » ont aussi leur toast, au passage seulement (jamais à l'affichage du menu) ; les 80 %
  aussi, une fois par page, à l'affichage du menu si la collection est déjà lourde ou au passage du
  seuil (`warnHeavy`, `AccountMenu`). Se déconnecter vide la mémoire
  de la page.
- Retirés à la demande de l'utilisateur, à ne pas réintroduire sans demande : le compte unique,
  puis les invitations ; la collection « dans ce navigateur » sans compte, sa copie hors ligne et
  le rappel de sauvegarde ; le réglage public ou privé du Pokédex public.
