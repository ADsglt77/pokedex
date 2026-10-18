# Interface, filtres et performance

Le système de design, la navigation, les pages, les courbes, les filtres et ce qui tient la grille de 1 025 pochettes. Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

- Filtres du Pokédex dans l'adresse : `q` (raccourci « / »), `generation`, `type`, `possession` (`owned` : débloqués,
  `missing` : à débloquer, `ordered` ; `wanted`, d'une ancienne version, est ignoré), `card` (`with` : avec carte, `without` : sans ;
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
  production seulement, `main.tsx`) garde à son installation l'app : `/index.html`, ses scripts,
  styles et polices (`.woff2` seulement : les `.woff` ne servent qu'aux navigateurs qui n'ont pas
  `.woff2`) et ce que la page demande de `public/` au démarrage (thème, manifeste, icône). La liste
  est écrite à chaque construction par le plugin `precache` de `vite.config.ts` (`/index.html` à la
  main : ce plugin passe avant celui de Vite qui l'ajoute) : un nouveau service worker à chaque
  version. Une page : le réseau, sinon l'app gardée (aucune autre réponse ne prend sa place, pas
  même une page d'erreur de nginx ou de Cloudflare : plus bas). Les
  fichiers de `public/`, dont le nom ne change pas, et les données de référence (espèces,
  catalogue, prix, historiques) : le réseau d'abord, la dernière réponse gardée sans lui. Celles-ci
  sont gardées par leur chemin, sans les paramètres : une seule copie des historiques de la
  collection (`/api/histories?ids=…`), quels que soient les ids, au lieu d'une de plus à chaque
  carte possédée. Une copie d'autres ids sert encore : chaque id y a sa clé, la page Valeur y prend
  ceux de ses cartes ; une carte qui n'y est pas (ajoutée depuis) ne pèse pas sur la courbe, et la
  page le dit sous elle (`docs/prix.md`). « Le réseau d'abord » attend les en-têtes 4 s au plus (un réseau faible) quand une
  version est gardée, aussi longtemps qu'il faut sinon, et jamais la fin d'un long téléchargement
  (les prix) ; la réponse du réseau est gardée dès qu'elle arrive, même si la version gardée a déjà
  été servie. Une erreur du serveur (5xx : le 502 de nginx pendant le redémarrage d'un déploiement
  ou le serveur arrêté, la page d'erreur de Cloudflare sans le site) vaut une absence de réseau :
  la version gardée s'il y en a une (sinon cette erreur), jamais gardée elle-même : sans quoi
  l'écran « Le Pokédex ne peut pas s’afficher » viendrait alors que les espèces sont gardées. Les
  images affichées : gardées dès leur premier affichage, 3 000 au plus. Jamais le
  compte ni la collection, qui viennent du stockage du navigateur.
- Performance (mesurer en production, `bun run build` puis `bun run preview` : `bun dev` est 3 à 4
  fois plus lent) : le Pokédex affiche 1 025 pochettes. Seules celles à l'écran sont dessinées
  (`content-visibility`, de même pour la liste d'achats et les cartes du catalogue), les marques de
  possession sont des icônes CSS (masques, pas de SVG : plus de 1 000 sinon), et rien de ce qui
  défile n'a de `backdrop-filter` (flou recalculé à chaque image). Les pochettes sont de simples
  liens (`<a>`, pas un `Link` de react-router, qui lit l'adresse : les 1 025 se redessineraient à
  chaque frappe de la recherche, environ 20 ms) ; `PokedexPage` lit le clic une fois pour toute la
  grille et fait suivre un clic ordinaire (Entrée comprise) par le routeur, pas un clic avec Ctrl,
  ⌘, Maj ou Alt. Les animations ne se rejouent pas à chaque visite (les pages se remontent) : la
  marque de possession seulement quand le statut change sous les yeux, les cartes de l'accueil
  seulement quand une nouvelle arrive. Les pages autres que l'accueil,
  le Pokédex, les fiches, la page introuvable et la page d'erreur sont chargées à leur première
  ouverture (`lazy`, `router.tsx` : une
  route parente sans chemin porte une seule fois la page d'erreur et l'attente, vide, d'une page
  ouverte directement). Le client Better Auth non plus (`lib/auth.ts`, à part de
  `lib/auth-client.ts` que lit le démarrage) : seules la connexion, la première visite et Données ›
  Mon compte l'importent, la déconnexion le charge à la demande. Une
  donnée chargée à la demande et lue par `use()` passe par `settled` : sans lui, React retient
  l'affichage environ 300 ms à chaque ouverture (fenêtre d'ajout, catalogue). La fiche d'un
  Pokémon sans carte prépare le catalogue pendant que le navigateur est libre. La page Catalogue
  ne charge que la liste des séries (`/api/catalog/sets`, environ 8 Ko compressés) puis les
  cartes de l'extension montrée (`/api/catalog/sets/<code>`), chacune une fois : pas le catalogue
  par Pokémon (plus de 250 Ko compressés) de la fenêtre d'ajout. Les longues listes
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
  (`position: sticky; top: 0`) et prend le focus à l'ouverture (`initialFocus`).
