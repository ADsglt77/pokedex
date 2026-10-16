# Interface, filtres et performance

Le système de design, la navigation, les pages, les courbes, les filtres et ce qui tient la grille de 1 025 pochettes. Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

- Filtres du Pokédex dans l'adresse : `q` (raccourci « / »), `generation`, `type`, `possession` (`owned` : débloqués,
  `missing` : à débloquer, `ordered` ; `wanted`, d'une ancienne version, est ignoré), `card` (`with` : avec carte, `without` : sans ;
  à compléter : `no-image`, `no-cardmarket`, `no-paid` : possédée sans prix payé), `order=desc` ;
  un lien filtré se
  construit avec `pokedexUrl`. La recherche passe par `flushSync` (le routeur met l'adresse à jour
  dans une transition, le champ suivrait la frappe en retard) ; la grille, mémoïsée, suit par
  `useDeferredValue`.
- Interface : les cartes portent la couleur, l'interface reste sobre (deux thèmes,
  `styles/theme.css`). Le système
  de design vit dans `styles/global.css` : échelle de texte (`--text-xs`, `--text-sm`,
  `--text-md` ; `--title-sm`, `--title-md` ; les titres de page ont leur taille fluide), rythme
  (`--space-block` entre les blocs d'une page, `--space-panel` dans un panneau), mise en page
  (`--sidebar-width`, `--tabbar-height`), mouvement (`--ease-out`, `--duration-fast`) : une valeur
  hors d'eux doit avoir une raison. Une page : `PageHeader` (titre, phrase, actions à droite),
  puis ses blocs en `Panel` (une `Card` de camply : titre `h2`, phrase, actions, contenu ; `flush`
  pour un tableau bord à bord ; pas une région nommée : trop de points de repère) ; statistiques par
  deux, par quatre quand la page a 50rem (`.stat-grid`, plus compactes sur téléphone). Occuper
  l'écran : une page va jusqu'à 120rem (`--page-max`, toute la largeur jusqu'au très grand écran,
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
  « poké »). Un
  avertissement de l'app (export, stockage) s'aligne sur le conteneur des pages. L'accueil est un
  tableau de bord (dès qu'il y a une carte ou une commande) : progression (anneau, réglette des
  régions), « À faire » (commandes en retard,
  cartes à compléter, chacune vers sa liste filtrée : `shoppingUrl`, `pokedexUrl`), indicateurs
  (valeur, dépensé ce mois-ci, liste d'achats, commandes), dernières cartes obtenues (« Vos cartes
  choisies » tant qu'aucune n'est obtenue : une rangée, de trois cartes sur téléphone à dix sur un
  très grand écran) ; une collection vide y trouve trois étapes pour commencer. La progression et
  « À faire » côte à côte ont la même hauteur. Le Pokédex : recherche, filtres rapides de
  possession avec leur nombre (les autres filtres appliqués), les autres filtres dans un panneau
  (génération, type, carte), chacun rappelé en étiquette retirable ; quand tout ne tient pas sur
  une ligne, les filtres rapides passent dessous (sur téléphone, ils défilent de côté). Achats :
  sur téléphone, les filtres de la liste dans un panneau « Filtres », l'onglet ouvert amené dans
  la rangée d'onglets qui défile ; page étroite, les badges des onglets se resserrent. Le
  catalogue : l'extension, puis un panneau (ses Pokémon qui ont déjà leur carte, réglages de
  l'ajout). Données : un sommaire (collé à gauche sur grand écran) et un panneau par section, deux
  colonnes sur très grand écran, l'effacement sur fond teinté de rouge. La fiche d'un Pokémon :
  fil d'Ariane (Pokédex › région › nom), puis la carte, collée à l'écran (sa largeur suit la
  page : `cqi`), et ses panneaux (statut et prix payé, prix Cardmarket, achat, « Dans le
  Pokédex ») : sur deux colonnes dès que la fiche a la place, « Dans le Pokédex » à part sur grand
  écran ;
  seul effet appuyé de l'app, la carte en grand suit la souris et la lumière y glisse
  (`CardStage` : variables CSS, sans rendu React ; ni au toucher ni en mouvement réduit). Les
  site s'installe sur téléphone et ordinateur (`public/manifest.webmanifest`, icônes de `public/icons`
  et `public/apple-touch-icon.png`, dessinées d'après `favicon.svg` ; pas de service worker : il faut
  le réseau pour démarrer), et un lien partagé a son aperçu (`og:` dans `index.html`, l'icône pour
  image). Les
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
  de `Intl` manque à certaines polices).
- Performance (mesurer en production, `bun run build` puis `bun run preview` : `bun dev` est 3 à 4
  fois plus lent) : le Pokédex affiche 1 025 pochettes. Seules celles à l'écran sont dessinées
  (`content-visibility`, de même pour la liste d'achats et le catalogue), les marques de
  possession sont des icônes CSS (masques, pas de SVG : plus de 1 000 sinon), et rien de ce qui
  défile n'a de `backdrop-filter` (flou recalculé à chaque image). Les pages autres que l'accueil,
  le Pokédex et les fiches sont chargées à leur première ouverture (`lazy`, `router.tsx`). Une
  donnée chargée à la demande et lue par `use()` passe par `settled` : sans lui, React retient
  l'affichage environ 300 ms à chaque ouverture (fenêtre d'ajout, catalogue). La fiche d'un
  Pokémon sans carte prépare le catalogue pendant que le navigateur est libre.
