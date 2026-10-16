# Compte, synchronisation et Pokédex public

Le seul compte, la collection synchronisée entre les appareils, le Pokédex public. Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

- Comptes et synchronisation (`server/auth.ts`, `server/collection.ts`, `lib/sync.ts`,
  `store/sync.ts`) : Better Auth, e-mail et mot de passe, **un seul compte**, celui de
  l'utilisateur (les invitations ont été retirées à sa demande, octobre 2026). Tant qu'il n'existe
  pas, c'est la première visite : le serveur écrit dans son journal un code de première visite
  (8 caractères, nouveau à chaque démarrage), `GET /api/account` répond `{ exists: false }` et le
  routeur (créé après cette réponse, `main.tsx` : ses `loader` lisent `accountExists` dès sa
  création) mène toute page à `/bienvenue` (`WelcomePage`, hors de la coquille). On y crée le
  compte avec ce code (en-tête `X-Setup-Code`, vérifié puis consommé au moment de créer le compte,
  `databaseHooks.user.create.before`) ; ensuite, plus aucune inscription (403 avant même Better Auth), et `/bienvenue` mène à
  `/connexion`. Un visiteur arrivé avant l'utilisateur ne peut donc pas prendre le compte.
  `server/create-user.ts` le crée aussi depuis le serveur (jamais un second) ou change son mot de
  passe (ce qui ferme ses sessions). **Une seule session par compte** : se connecter sur un
  appareil déconnecte les autres (crochet `session.create.after`) ; l'appareil déconnecté garde
  ses modifications et affiche « Reconnectez-vous ». Sessions de 60 jours dans un cookie
  (`__Secure-` en https, SameSite Lax) ; en production, 5 tentatives de connexion ou de création du compte
  par minute et par visiteur (`cf-connecting-ip`). Sans connexion, l'app marche comme avant : la
  collection reste dans le navigateur, le Pokédex des espèces est public. Le Pokédex public de la
  collection (`/vitrine`, à sa demande, octobre 2026) : une adresse fixe, que le compte active ou non
  (Données › Pokédex public ; colonne `public` de `collections`). Une page seule, hors de la
  coquille, en lecture seule et pas indexée (`noindex`) : la progression, les régions, la valeur au
  prix du jour, la courbe des Pokémon débloqués et le classeur (débloqués en couleur, cartes
  choisies grisées ; les pochettes ne mènent pas aux fiches, celles du visiteur). Le serveur ne
  montre que les cartes (sans leur page notée) et les possessions avec leur date
  (`shownCollection`, testé) : jamais un prix payé, une commande, le budget, la liste d'achats ni
  le statut « commandée » ; 404 tant que le compte ne le montre pas. Il montre
  la version que le serveur a reçue. Connecté, la collection et les achats
  forment un seul document par compte (une commande modifie les deux), dans `app.db`, numéroté par
  le serveur (`/api/collection` : `PUT` refusé, 409, si l'appareil part d'une version dépassée ; le
  document passe les contrôles d'un import, `readDocument`). Le navigateur garde sa copie (hors
  ligne, l'app marche ; l'envoi part au retour du réseau) et note la dernière version échangée
  (`pokedex-collection.sync` : version et empreinte SHA-256 ; les deux autres clés gardent leur
  format) : il synchronise une seconde après une modification, au retour de la page et du réseau,
  et 30 s après une panne passagère (hors ligne, 502 pendant un redémarrage, réponse illisible) ou
  trois échanges sans aboutir (l'appareil ou le serveur changeait à chaque fois),
  un onglet à la fois (`navigator.locks`). Seuls 400 et 422 (document refusé par le serveur) donnent
  « Envoi refusé ». La règle (`decide`, testée) : seul cet appareil a
  changé, il envoie ; seul le serveur, il reprend ; les deux, une fenêtre fait choisir la version à
  garder (`SyncConflictDialog`, avec un export de celle de l'appareil ; jamais de fusion, comme à
  l'import) ; de même si le serveur en est à une version plus ancienne que celle échangée (sa base
  restaurée d'une sauvegarde). Un budget réglé compte comme un contenu (`isEmptyDocument`). Lire,
  comparer et remplacer le document (collection et achats ensemble) : `store/document.ts`. Avec une seule session, ce cas ne vient plus que d'un appareil déconnecté avec des
  modifications pas encore envoyées, qui se reconnecte : la fenêtre reste le filet de sécurité. À
  la première connexion d'un appareil, celui qui a quelque chose l'envoie (ou le reçoit). Le
  serveur garde une version remplacée par heure, 30 jours (`collection_versions`, à reprendre à la
  main). Se déconnecter vide la copie de ce navigateur (appareil partagé), après avoir proposé
  l'export si un envoi a échoué. « Annuler », l'import, « Effacer » sont des modifications comme
  les autres : connecté, elles valent pour tous les appareils (les textes de la page Données le
  disent). Le compte (`AccountMenu`, en pied de la barre latérale, ou en icône dans la barre du haut
  sur petit écran) montre l'état : synchronisée, hors ligne, reconnectez-vous, à choisir, envoi
  refusé. La question d'un conflit fermée (« Plus tard ») est gardée dans le store
  (`setConflictQuestion`) : le menu change de place quand l'écran tourne. `/connexion`
  (`LoginPage`) ramène à la page d'où l'on venait (`?retour=`, filtres compris ; seulement une
  adresse du site : même origine, `/\exemple.fr` refusé). Le rappel de sauvegarde ne paraît
  que sans connexion.
