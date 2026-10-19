# Interface, filtres et performance

Le système de design, la navigation, les pages, les courbes, les filtres et ce qui tient la grille de 1 025 pochettes. Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

- Filtres du Pokédex dans l'adresse : `q` (raccourci « / »), `generation`, `type`, `possession` (`owned` : débloqués,
  `missing` : à débloquer, `ordered`), `card` (`with` : avec carte, `without` : sans ;
  à compléter : `no-image`, `no-cardmarket`, `no-paid` : possédée sans prix payé), `order=desc` ;
  un lien filtré se
  construit avec `pokedexUrl`. La recherche passe par `flushSync` (le routeur met l'adresse à jour
  dans une transition, le champ suivrait la frappe en retard), sans relancer le chargement de la
  route (`defaultShouldRevalidate: false` : sinon le curseur partirait au bout du texte) ; la
  grille, mémoïsée, suit par
  `useDeferredValue`. De même pour la liste d'achats (Achats) : `q`, `generation`, `tri` (`price`
  par défaut, `price-desc`, `drop`, `dex`), à côté de l'onglet (`vue`), qui les garde
  (`parseShopping`) ; ses cartes (`WishCard`) sont mémoïsées. Les groupes fermés de l'assistant ne
  rendent pas leurs cartes (camply rend le contenu d'un `AccordionItem` fermé).
- Interface : les cartes portent la couleur, l'interface reste sobre (deux thèmes,
  `styles/theme.css`). Le système
  de design vit dans `styles/global.css` : échelle de texte (`--text-xs`, `--text-sm`,
  `--text-md` ; `--title-sm`, `--title-md`, `--title-xl` pour le grand chiffre d'un panneau ;
  `--title-page`, fluide, pour le titre d'une page, Pokédex public compris), rythme
  (`--space-block` entre les blocs d'une page, `--space-panel` dans un panneau), mise en page
  (`--sidebar-width`, `--tabbar-height`), mouvement (`--ease-out`, `--duration-fast`) : une valeur
  hors d'eux doit avoir une raison. Ses classes partagées, entre autres : `.quiet-link` (un lien
  discret, titre d'une carte ou fil d'Ariane : la couleur de son texte, souligné au survol
  seulement, de jaune en sombre, de rouge en clair), `.shortcut` (un raccourci clavier, `Kbd`,
  masqué sur écran tactile seul). Une liste « libellé : montant » est une `DescriptionList`
  `layout="split"` de camply (le libellé prend la place, le montant à droite en chiffres alignés :
  le décompte d'une collection sur la page Données, `SummaryLedger`, les totaux d'une commande). Une page : `PageHeader`
  (titre, phrase, actions à droite), puis ses blocs en `Panel` (une `Card` de camply : titre `h2`, phrase, actions, contenu ; `flush`
  pour un tableau bord à bord, `Table bordered={false}` ; pas une région nommée : trop de points de
  repère) ; statistiques par deux, par quatre quand la page a 50rem (`.stat-grid` ; compactes sur
  téléphone, `Stat size="sm"` par `useStatSize`). Une page
  découpée en composants (l'accueil, `pages/home/` ; Achats) : les classes d'un seul composant dans
  son propre module CSS, celles qu'en partagent plusieurs dans celui de la page, importé sous le
  nom `page`. Occuper l'écran : une page va jusqu'à 120rem (`--page-max`, toute la largeur jusqu'au très grand écran,
  où elle reste centrée) et c'est un conteneur (`.container` : `container: page`) ; ses blocs se
  règlent sur la place qu'elle a vraiment (`@container page`, barre latérale déduite), pas sur la
  largeur de l'écran (à 1 024 px, la barre latérale en prend un quart). Un tableau de données
  devient une liste de fiches quand il est étroit (`.stack-table`, `@container table` ; la page
  place les cellules par `grid-area`, une valeur y montre son libellé, `.stack-label`, `TableCount`
  pour « 4 cartes », et un « — » s'efface, `.stack-hidden`) : commandes, budget, « Mes cartes »,
  « Pour compléter ». Navigation (`AppShell`) : à partir de 64rem, une
  barre latérale collée (Collection : Accueil, Pokédex, Catalogue ; Achats et valeur : Achats,
  Valeur ; la progression ; Données et le compte en pied) ; en dessous, une barre en haut (nom,
  recherche, Données, thème, compte en icône) et cinq onglets en bas ; le bouton du thème est aussi
  en pied de la barre latérale. Partout, la recherche
  (`AppSearch`, Ctrl/⌘ K, la palette de camply) : les pages, quelques actions (exporter, importer) et les 1 025 Pokémon (noms français, anglais, japonais, numéro ; groupe
  « Espèces » : la palette cherche aussi dans le nom du groupe, « Pokémon » ferait tout trouver à
  « poké »). L'avertissement
  de l'app (le stockage refusé, `.notice`) s'aligne sur le conteneur des pages. L'accueil est un
  tableau de bord (dès qu'il y a une carte ou une commande) : progression (anneau, réglette des
  régions), « À faire » (commandes en retard,
  cartes à compléter, une TAG TEAM comptée une fois, chacune vers sa liste filtrée : `shoppingUrl`,
  `pokedexUrl`), indicateurs
  (valeur, dépensé ce mois-ci, liste d'achats, commandes), dernières cartes obtenues (« Vos cartes
  choisies » tant qu'aucune n'est obtenue : une rangée, de trois cartes sur téléphone à dix sur un
  très grand écran) ; une collection vide y trouve trois étapes pour commencer. La progression et
  « À faire » côte à côte ont la même hauteur. Le Pokédex : recherche, filtres rapides de
  possession avec leur nombre (les autres filtres appliqués), les autres filtres dans un panneau
  (génération, type, carte), chacun rappelé en étiquette retirable ; quand tout ne tient pas sur
  une ligne, les filtres rapides passent dessous (sur téléphone, ils défilent de côté). Achats :
  sur téléphone, les filtres de la liste dans un panneau « Filtres », l'onglet ouvert amené dans
  la rangée d'onglets qui défile ; page étroite, les badges des onglets se resserrent. Le
  catalogue : un panneau (le logo japonais de l'extension, son nom, sa sortie, son nombre de cartes
  et son bloc, et « Changer d'extension »), puis la recherche, les filtres de rareté et de type
  (chacun sur une ligne qui défile de côté sur téléphone), ce que compte l'extension et ses cartes
  en tuiles serrées (10 colonnes sur un écran de 1440 px, 3 sur téléphone) ; la fiche d'une carte,
  pleine page : l'image à gauche, qui reste à l'écran quand le reste défile, ce qu'on sait de la
  carte et son prix à droite (l'une sous l'autre sous 48rem) ; dans le pied, les flèches des
  cartes voisines et l'ajout, qui passe dessous s'il ne tient pas. Données : un sommaire (collé à
  gauche sur grand écran) et un panneau par section, deux colonnes sur très grand écran dans
  l'ordre du sommaire (la collection à gauche, le compte et le Pokédex public à droite ; l'export
  et l'import côte à côte ; les données du serveur et l'effacement sur
  toute la largeur), l'effacement sur fond teinté de rouge. Valeur : ses panneaux l'un sous
  l'autre. La fiche d'un Pokémon :
  fil d'Ariane (Pokédex › région › nom), puis la carte, collée à l'écran (sa largeur suit la
  page : `cqi`), et ses panneaux (statut et prix payé, prix Cardmarket, « Dans le Pokédex ») : sur
  deux colonnes dès que la fiche a la place (la carte et ses statuts à gauche, son prix à droite),
  « Dans le Pokédex » à part sur grand écran ;
  seul effet appuyé de l'app, la carte en grand suit la souris et la lumière y glisse
  (`CardStage` : variables CSS, sans rendu React ; ni au toucher ni en mouvement réduit). Un lien
  partagé a son aperçu (`og:` dans `index.html`, l'icône pour image ; celui du Pokédex public, son
  titre et sa progression). Les
  courbes (`PriceChart`, `lib/chart.ts`) vont jour par jour, sur la période choisie (7 jours,
  30 jours, 1 an, tout ; 7 jours au moins, l'axe la couvre en entier) : Valeur › Évolution (valeur
  de la collection, Pokémon débloqués, dépenses cumulées depuis le début de la période) et le prix
  d'une carte sur sa fiche, chacune avec ses chiffres dessous (`ChartStats` : évolution, plus haut,
  plus bas, moyenne ; pour un total, ce qu'il a gagné et son rythme par semaine). Aucun point
  inventé : un jour sans prix n'en a pas ; un total (`fromZero`) part de zéro. Cardmarket ne publie
  que le guide du jour (aucune archive) : l'historique n'existe que depuis que le serveur le relève,
  un point par jour où la tâche `prices` passe. En repère sur la courbe d'une carte, la moyenne de
  ses ventes sur 30 jours que donne ce guide (`reference`, en pointillés). Les
  nombres formatés gardent une espace insécable visible (`spaced`, `lib/format.ts` : l'espace fine
  de `Intl` manque à certaines polices ; une part : `formatShare`, « 12,5 % »).
- Installation et hors ligne : le site s'installe sur téléphone et ordinateur
  (`public/manifest.webmanifest`, icônes de `public/icons` et `public/apple-touch-icon.png`,
  dessinées d'après `favicon.svg`) et démarre hors ligne. Le service worker (`public/sw.js`, en
  production seulement, enregistré une fois la page chargée, `main.tsx` : à la première visite, ce
  qu'il garde ne se télécharge pas en même temps que les données du premier affichage) garde à son
  installation l'app : `/index.html`, ses scripts,
  styles et polices (`.woff2` seulement : les `.woff` ne servent qu'aux navigateurs qui n'ont pas
  `.woff2`) et ce que la page demande de `public/` au démarrage (thème, manifeste, icône). La liste
  est écrite à chaque construction par le plugin `precache` de `vite.config.ts` (`/index.html` à la
  main : ce plugin passe avant celui de Vite qui l'ajoute ; chacun de ses marqueurs doit y être
  une fois exactement, sinon la construction échoue, plutôt qu'un service worker qui ne garderait
  rien sans le dire) : un nouveau service worker à chaque version. Sans `/index.html`, son
  installation échoue (elle sera retentée) : jamais un service worker installé sans démarrage hors
  ligne. Une page restée ouverte pendant un déploiement, qui charge une page à la demande dont le
  fichier n'existe plus, se recharge avec la nouvelle version (`vite:preloadError`, `main.tsx` ; une
  fois par minute au plus). Une page : le réseau, sinon l'app gardée (aucune autre réponse ne prend sa place, pas
  même une page d'erreur de nginx ou de Cloudflare : plus bas). Les fichiers de `public/`, dont le
  nom ne change pas : la copie gardée tout de suite, rafraîchie pour la fois suivante (`theme.js`
  bloque le premier affichage : sur un réseau faible, il attendait jusqu'à 4 s). Les données de
  référence (espèces, catalogue, prix, historiques) : le réseau d'abord, la dernière réponse gardée
  sans lui, dans un cache nommé d'après la forme des réponses (`donnees-<API_FORMAT>`,
  `src/config/api.ts` : changer une forme, c'est augmenter ce nombre ; l'ancien cache est oublié,
  et une copie d'une ancienne forme n'est jamais lue par le nouveau code) ; inchangée (le même
  ETag), elle n'est pas réécrite (plusieurs Mo à chaque ouverture sinon). Les demandes du démarrage qu'`index.html` précharge (les espèces, le compte : derrière un
  service worker, le navigateur ne réutilise pas toujours le préchargement et l'app les redemande
  aussitôt) : la réponse du réseau sert aussi à la demande suivante de la même adresse par la
  même page, une fois, dans les 10 s (`startup` ; le compte, seulement sa demande marquée
  `?demarrage`, celle du démarrage ; une page rechargée juste après une connexion ou une
  déconnexion ne reçoit pas la réponse d'avant). Les données de référence sont gardées par leur chemin, sans les paramètres : une seule copie des historiques de la
  collection (`/api/histories?ids=…`), quels que soient les ids, au lieu d'une de plus à chaque
  carte possédée. Une copie d'autres ids sert encore : chaque id y a sa clé, la page Valeur y prend
  ceux de ses cartes ; une carte qui n'y est pas (ajoutée depuis) ne pèse pas sur la courbe, et la
  page le dit sous elle (`docs/prix.md`). « Le réseau d'abord » attend les en-têtes 4 s au plus (un réseau faible) quand une
  version est gardée, aussi longtemps qu'il faut sinon, et jamais la fin d'un long téléchargement
  (les historiques d'une collection) ; la réponse du réseau est gardée dès qu'elle arrive, même si
  la version gardée a déjà été servie. Une copie qui ne peut pas être gardée (le stockage du
  téléphone plein) n'empêche jamais la page de recevoir la réponse du réseau. Une erreur du serveur (5xx : le 502 de nginx pendant le redémarrage d'un déploiement
  ou le serveur arrêté, la page d'erreur de Cloudflare sans le site) vaut une absence de réseau :
  la version gardée s'il y en a une (sinon cette erreur), jamais gardée elle-même : sans quoi
  l'écran « Le Pokédex ne peut pas s’afficher » viendrait alors que les espèces sont gardées. Les
  images affichées : gardées dès leur premier affichage, 3 000 au plus (le tri, toutes les 100
  images gardées et à chaque nouvelle version du service worker). Jamais le compte ni la
  collection, qui viennent du stockage du navigateur.
- Performance (mesurer en production, `bun run build` puis `bun run preview` : `bun dev` est 3 à 4
  fois plus lent ; mesuré en octobre 2026 sur une collection de 1 025 cartes, avant → après) : le
  Pokédex affiche 1 025 pochettes. Seules celles à l'écran sont dessinées (`content-visibility`, de
  même pour la liste d'achats et les cartes du catalogue), et une génération hors de l'écran ne
  compte pas dans la mise en page (`content-visibility` sur la section, sa hauteur estimée d'après
  son nombre de pochettes, `--tiles`, puis retenue : 30 à 75 ms de mise en page par filtre ou
  frappe → 11 à 16). Un filtre masque les pochettes (`hidden`) au lieu de les démonter : la grille
  les garde toutes, dans l'ordre choisi. La coquille garde le classeur en vie, caché, pendant la
  visite des autres pages (`<Activity>` de React, `AppShell` ; ses filtres restent ceux de sa
  dernière adresse, `usePokedexFilters`) : le retour depuis une fiche le montre aussitôt, à la même
  position (330 à 410 ms → une quarantaine), sans refaire ses pochettes. Son premier affichage
  dessine un écran de pochettes, puis les autres en arrière-plan (`useDeferredValue` avec une
  valeur de départ : 111 ms → 42 avant la première image ; pas en arrivant par l'historique, qui
  retrouve le défilement). Les marques de possession sont des icônes CSS (masques, pas de SVG :
  plus de 1 000 sinon), et rien de ce qui défile n'a de `backdrop-filter` (flou recalculé à chaque
  image). Les pochettes, comme les cartes de la liste d'achats, sont de simples liens (`<a>`, pas
  un `Link` de react-router, qui lit l'adresse : des centaines se redessineraient à chaque frappe
  d'une recherche gardée dans l'adresse) ; la liste lit le clic une fois pour toutes
  (`useFollowLinks`) et fait suivre un clic ordinaire (Entrée comprise) par le routeur, pas un clic
  avec Ctrl, ⌘, Maj ou Alt, ni un lien vers un autre site. La coquille ne se redessine qu'en
  changeant de page (`Shell`, mémoïsée sur le chemin ; le menu du compte lit l'adresse au clic) :
  une frappe dans la recherche du Pokédex coûte 10 à 20 ms au lieu de 80 à 140. La recherche
  Ctrl K n'est montée qu'à sa première ouverture (ses plus de 1 000 commandes coûtaient une
  soixantaine de millisecondes au démarrage), puis mémoïsée ; la palette de camply rendant toutes
  ses commandes, ses lignes ont un `content-visibility` (classe interne, `global.css`). `buildPokedex`
  reprend les entrées inchangées du Pokédex d'avant (la même carte au même statut) : après une
  annulation, une synchronisation ou un autre onglet, seules les pochettes changées se redessinent.
  Le tableau des cartes de Valeur (trié par lui, le tri du tableau contrôlé) et la liste d'achats
  sont dessinés au fur et à mesure (`useGrowingList` : Valeur 151 ms → 60 à l'ouverture, Achats 254
  → 53). Un montant au prix du jour (`PricedValue`, des centaines par page) lit la réponse des prix
  de la collection une fois par état (`store/prices.ts`). Le plan de la prochaine commande suit le
  curseur du budget en différé (`useDeferredValue`) ; la liste des cartes à ajouter à une commande
  est triée une fois. Le stockage du navigateur est écrit une fois par action (`persist`), et
  l'empreinte du document synchronisé calculée une fois par document (`documentHash`). La carte
  d'une fiche ne suit la souris qu'une fois par image (`CardStage`). Les animations ne se rejouent
  pas à chaque visite (les pages se remontent) : la marque de possession seulement quand le statut
  change sous les yeux, une fois (une marque cachée puis remontrée, le Pokédex gardé en vie ou un
  filtre, ne la rejoue pas), les cartes de l'accueil seulement quand une nouvelle arrive. Le premier
  affichage du Pokédex montre ses intertitres de génération dès le premier écran de pochettes (la
  page sait combien de générations la liste montre : l'intertitre ajouté ensuite pousserait les
  pochettes déjà peintes). Les pages autres que l'accueil,
  le Pokédex, les fiches, la page introuvable et la page d'erreur sont chargées à leur première
  ouverture (`lazy`, `router.tsx` : une
  route parente sans chemin porte une seule fois la page d'erreur et l'attente, vide, d'une page
  ouverte directement) ; sur un réseau lent, une barre fine en haut le dit (`NavigationProgress`,
  `AppShell`, montrée après 0,3 s). La fenêtre d'une carte est préparée dès que le pointeur ou le
  focus arrive sur « Modifier la carte » (sur une fiche sans carte, quand le navigateur est libre),
  et une roue dit son ouverture si elle tarde. Le client Better Auth non plus (`lib/auth.ts`, à
  part de `lib/account.ts` que lit le démarrage) : seules la connexion, l'inscription et
  Données › Mon compte l'importent, la déconnexion le charge à la demande. Une
  donnée chargée à la demande et lue par `use()` passe par `settled` : sans lui, React retient
  l'affichage environ 300 ms à chaque ouverture (fenêtre d'ajout, catalogue). La fiche d'un
  Pokémon sans carte prépare ses cartes du catalogue pendant que le navigateur est libre (les
  siennes seulement, `/api/catalog/species/<n°>` : moins de 1 Ko compressé en moyenne, 7 pour
  Pikachu, au lieu des 275 Ko du catalogue entier d'avant). La page Catalogue ne charge que la liste
  des séries (`/api/catalog/sets`, environ 8 Ko compressés) puis les cartes de l'extension montrée
  (`/api/catalog/sets/<code>`), chacune une fois, et leurs seuls prix. Les longues listes
  du catalogue (les cartes d'une extension ou d'un Pokémon, jusqu'à 382 pour Pikachu ; les plus de
  400 extensions) sont dessinées au fur et à mesure (`useGrowingList` : 60 cartes ou 40
  extensions, puis autant chaque fois qu'un repère haut d'un écran, `growing-sentinel`, paraît au
  bas de la liste) : mesuré en production (octobre 2026), la fenêtre des extensions s'ouvre en
  40 à 80 ms au lieu de 270 à 490, et se ferme en une dizaine de millisecondes au lieu de 250 à
  430 (démonter des centaines de tuiles coûtait autant que les dessiner). Le piège à focus de
  camply ne mesure que les bords d'une fenêtre (depuis la 0.3 ; avant, chaque bouton à chaque Tab,
  d'où l'absence de `content-visibility` sur les années de `SetPicker`). Le bouton « Changer d'extension » porte lui-même l'état de sa fenêtre
  (`SetPicker`) : l'ouvrir ne redessine pas la page et ses cartes. Changer l'ordre des extensions
  passe en arrière-plan (`startTransition`). Les deux grandes fenêtres (le choix d'une extension,
  l'ajout d'une carte) sont pleine page (`Modal size="full"`) : seul leur contenu défile, leur
  titre et leurs boutons restent à l'écran (camply), la recherche des extensions reste en haut
  (`position: sticky; top: 0`) et prend le focus à l'ouverture (`initialFocus`). Dans la fenêtre
  d'ajout, la fonction qui choisit une carte est la même d'un rendu à l'autre (`fill` de
  `useCardDraft`, `pick` de `CardForm`) : les tuiles, mémoïsées, ne se redessinent pas à chaque
  sélection ; et les prix d'autres cartes que celles de la collection (`usePrices(ids)`) ne suivent
  pas la collection.
- Focus et annonces : une action qui retire ou désactive son propre bouton (« Réinitialiser » les
  filtres ou un filtre retiré dans le Pokédex, « Tout afficher » du catalogue, « Retirer les
  filtres » de raretés et de types, l'aperçu d'un import, « Effacer », « Chercher les images »
  quand toutes sont trouvées) mène le focus à ce qui suit : la recherche, le premier choix, le titre
  du panneau (`focusAfter`, `lib/focus.ts`, à côté de `keepFocusInList`), au lieu de le laisser
  tomber au document. De retour sur une page d'où un lien a été suivi (une pochette du Pokédex,
  une carte de la liste d'achats), le focus revient à ce lien (`returnedLink` de `useFollowLinks`,
  la coquille) ; la fiche d'une carte du catalogue fermée, il va à la tuile de la carte montrée en
  dernier (parcourue avec ← et →), pas à celle ouverte au départ. Le nombre de résultats est
  annoncé (`aria-live`) dans le Pokédex, la liste d'achats, le catalogue, la fenêtre d'ajout et
  celle des extensions. « Annuler » se lance aussi par Ctrl+Z (⌘Z) tant que son toast est affiché
  (`useNotify` ; pas dans un champ, ni avec une fenêtre ouverte) : au clavier, le toast, rendu à la
  fin de la page, était hors d'atteinte en 12 s. « Catalogue indisponible » propose « Réessayer ».
