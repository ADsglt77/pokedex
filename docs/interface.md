# Interface, filtres et performance

Le système de design, la navigation, les pages, les courbes, les filtres et ce qui tient la grille de 1 025 pochettes. Une partie de la documentation du projet, à lire avant de toucher à ce domaine (le sommaire et les règles : `CLAUDE.md`).

- Thèmes (`styles/theme.css`, à la demande de l'utilisateur, octobre 2026 ; pas de bleu) :
  **sombre** par défaut, gris foncé neutre et accent jaune ; **clair**
  (`data-camply-theme="light"` sur `<html>`), blanc pastel chaud et accent rouge. Les tons restent
  distincts de l'accent (sombre : danger corail, avertissement orange ; clair : danger cramoisi),
  l'information est violette. La jauge du budget est `info` tant qu'on est dans le budget, et une
  hausse (`Stat` `delta`) est verte (le ton `success` de camply) : l'accent y passerait pour une
  alerte. Le choix (bouton « Thème clair / sombre » de la barre, `store/theme.ts`) est gardé dans ce
  navigateur (`pokedex-collection.theme`, une préférence, pas synchronisée) ; sans choix, celui du
  système, posé avant le premier affichage par `public/theme.js` (même règle ; un fichier et pas un
  script dans la page : la politique de sécurité n'accepte que les scripts du site). Les couleurs se
  changent dans `theme.css`, jamais dans un composant (le fond, `--camply-bg`, est aussi la couleur
  de la barre du navigateur, lue par `store/theme.ts` ; ses copies figées, `index.html`, manifeste,
  `public/theme.js`, y sont nommées) ; ce qui diffère d'un thème à l'autre hors camply y a aussi
  son jeton (`--empty-sprite-opacity` : le sprite grisé d'un Pokémon sans carte ;
  `--dark-icon-filter` : les icônes de rareté noires, inversées en sombre ; `--link` et
  `--chart-*` : en clair, liens et courbes à l'encre, liens soulignés de rouge, pour que le rouge
  reste la marque et l'action principale, pas une alerte ; le choix d'un `SegmentedControl` y est un
  bouton blanc en relief ; `--flag-*` : les couleurs des drapeaux de l'interrupteur des langues
  et de la langue d'une carte (`LanguageFlag`), les mêmes dans les deux thèmes, et leur liseré,
  qui détache le blanc d'un fond blanc ou jaune ; `--type-*` : la pastille du type d'un Pokémon,
  `TypeChip`, des tons pastel, les mêmes dans les deux thèmes ; `config/pokedex.ts` n'a que leurs
  noms). Contrastes : les contours du focus à 3:1 au moins dans les deux thèmes, celui d'un champ
  en erreur compris (`--camply-danger-ring`) ; le texte à 4,5:1 au moins, sauf des écarts connus du
  gris discret (`--camply-text-muted-2`) : en sombre, l'indice « Esc » de la palette, sur un fond à
  peine plus clair que la surface flottante (4,49) ; en clair, sur `surface-2` (4,49 : les
  intitulés de l'aperçu d'un import) et le nombre d'un filtre rapide du Pokédex au survol (4,39).
  Sur une carte grisée, `CardArt` `locked`, dont l'opacité pâlit aussi le texte, « Pas d'image »
  est au ton du texte.
  Le site s'appelle **PokéCodex** (cette graphie), écrit une seule fois (`SITE_NAME`,
  `config/legal.ts`), sauf dans `index.html` et le manifeste : le nom à côté du logo
  (la coquille, les pages seules, celles du compte, la page d'erreur), le titre des onglets
  (« Pikachu – PokéCodex », `pageTitle`), le manifeste et l'aperçu d'un lien (`index.html`,
  `SITE_SUMMARY` de `worker/vitrine.ts`). « Mon Pokédex » n'est que le Pokédex de l'utilisateur :
  le titre de l'accueil, le bouton du Pokédex public pour qui est connecté. Le logo est une Poké
  Ball plate (`Logo`, `AppShell` ; couleurs `--brand-*`, les mêmes dans les deux thèmes), la même
  que l'icône de l'onglet (`public/favicon.svg`).
- Filtres du Pokédex dans l'adresse : `q` (raccourci « / », sauf depuis un champ, une fenêtre ou
  un menu ouvert, celui du compte compris, comme ← et → de la fiche : `shortcutBlocked`) :
  d'une seule touche et sans moyen de le couper, il s'écarte sciemment de WCAG 2.1.4, niveau A,
  choix de l'utilisateur de novembre 2026 ; la recherche de l'app, Ctrl/⌘ K, reste l'autre accès ;
  pas d'interrupteur, le navigateur ne garde aucun réglage sauf le thème), `generation`, `type`,
  `possession` (`owned` :
  débloqués, une de leurs cartes est possédée ; `missing` : à débloquer, aucune ne l'est ;
  `ordered` : aucune possédée, une commandée), `card` (`with` : avec des cartes, `without` : sans ;
  à compléter, dès qu'une de leurs cartes l'est, favorite ou non, `cardNeeds` : `no-image`,
  `no-cardmarket`, `no-paid` : possédée sans prix payé), `order=desc` ; un lien filtré se
  construit avec `pokedexUrl`. La recherche passe par `flushSync` (le routeur met l'adresse à jour
  dans une transition, le champ suivrait la frappe en retard), sans relancer le chargement de la
  route (`defaultShouldRevalidate: false` : sinon le curseur partirait au bout du texte ; ces
  options : `filterUpdate`, `lib/filters.ts`, pour le Pokédex comme pour les Achats) ; la
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
  le décompte d'une collection dans Réglages, `SummaryLedger`, les totaux d'une commande). Une page : `PageHeader`
  (titre, phrase, actions à droite), puis ses blocs en `Panel` (une `Card` de camply : titre `h2`, phrase, actions, contenu ; `flush`
  pour un tableau bord à bord, `Table bordered={false}` ; pas une région nommée : trop de points de
  repère) ; les tuiles d'indicateurs seulement sur l'Accueil, le tableau de bord (décision D-07,
  novembre 2026) : par deux, par quatre quand la page a 50rem (`.stat-grid` ; compactes sur
  téléphone, `Stat size="sm"` par `useStatSize` ; le téléphone, 40rem de large au plus :
  `usePhone` en JS, la même borne que les feuilles CSS) ; ailleurs (Achats, son onglet Budget,
  Valeur, le Pokédex public), une ligne de résumé : des `Stat` à plat et compactes, sans cadre ni
  icône (`SUMMARY_STAT`, `.stat-line` ; `summary` des statistiques que partage l'Accueil). Elle
  vient après le contenu principal (D-07, novembre 2026) : Achats s'ouvre sur la liste, la ligne
  du mois en tête de l'onglet Budget ; Valeur la montre après la courbe et « Ce qui bouge » ; le
  Pokédex public, sous son titre (le pourcentage est dans sa phrase, et ses favorites en éventail,
  `FavoritesFan`, comme la tuile du Pokédex des Collections, remplacent l'anneau : chargées
  d'emblée, dans une boîte à leur largeur, les Pokémon de départ réduits sur un petit téléphone).
  Une
  icône par notion (DS-02) : `Layers` est le Catalogue, une pochette vide (`SquareDashed`) un
  Pokémon sans carte, un cercle pointillé (`CircleDashed`) un Pokémon à obtenir ou une
  carte pas encore possédée. Une page
  découpée en composants (l'accueil, `pages/home/` ; Achats) : les classes d'un seul composant dans
  son propre module CSS, celles qu'en partagent plusieurs dans celui de la page, importé sous le
  nom `page`. Un bloc que reprennent deux feuilles est un module à part, auquel chacune renvoie par
  `composes … from` en gardant ses propres réglages : `CardLayout` (plus bas), le cadre du logo
  d'une extension (`LogoFrame` : tuiles des Collections, page d'une collection, chacune sa
  hauteur), le bouton en tuile (`TileButton` : `SetPicker`, `CardList`, chacun son bord, sa grille
  et son survol). Vite recopie ce module devant chaque feuille qui y renvoie : une de ses
  propriétés ne se redéfinit que sous un sélecteur plus précis (`:hover`), jamais dans la classe
  qui y renvoie, où la copie chargée en dernier l'emporterait. Occuper l'écran : une page va jusqu'à 120rem (`--page-max`, toute la largeur jusqu'au très grand écran,
  où elle reste centrée) et c'est un conteneur (`.container` : `container: page`) ; ses blocs se
  règlent sur la place qu'elle a vraiment (`@container page`, barre latérale déduite), pas sur la
  largeur de l'écran (à 1 024 px, la barre latérale en prend un quart). Un tableau de données
  devient une liste de fiches quand il est étroit (`.stack-table`, `@container table` ; la page
  place les cellules par `grid-area`, une valeur y montre son libellé, `.stack-label`, `TableCount`
  pour « 4 cartes », et un « — » s'efface, `.stack-hidden`) : commandes, budget, « Mes cartes »,
  « Pour compléter ». Rangé en liste, un tableau triable perd son en-tête et ses boutons de tri :
  un choix « Trier par » (`Select` de camply) les remplace, chaque colonne dans un sens puis
  l'autre, branché sur le même tri contrôlé (« Mes cartes », commandes ; `.stack-sort`,
  `lib/table-sort.ts`). Il paraît exactement quand l'en-tête disparaît, sur un téléphone ou dans un
  bloc étroit : un seul conteneur `table`, l'enveloppe, les règle (celui du tableau, plus étroit de
  son bord, y est retiré). Navigation (`AppShell`) : à partir de 64rem, une
  barre latérale collée (Collection : Accueil, Collections, Catalogue ; Achats et valeur : Achats,
  Valeur ; la progression ; Réglages (`/reglages`, l'icône `Settings` ; `/donnees`, leur adresse
  jusqu'en novembre 2026, y mène encore, `OldSettings`) et le compte en pied ; Collections est la
  page ouverte aussi
  sur le Pokédex et les fiches, qui s'ouvrent depuis elle) ; en dessous, une barre en haut (nom,
  recherche, Réglages, thème, compte en avatar) et cinq onglets en bas ; le bouton du thème est
  aussi
  en pied de la barre latérale. En haut de `main`, au-dessus de chaque page, le bandeau de
  l'enregistrement (`SaveBanner`, `docs/compte-et-synchronisation.md`) : hors ligne, session
  fermée, version mise de côté, rien quand tout va bien. Le `Banner` de camply y est employé sans
  son `action` (qui place les boutons à droite du texte et l'écrase sur un téléphone, au point de
  faire défiler la page de côté) : les boutons passent sous le texte. Chaque entrée de l'historique garde sa position de défilement
  (`ScrollRestoration`, la coquille), retrouvée par « Précédent » ou un rechargement, sauf en
  revenant tout droit d'une page hors de la coquille (connexion, inscription, mentions légales,
  Pokédex public) : le routeur ne retient les positions que la coquille montée, la page s'ouvre
  alors en haut ; une page
  chargée en entier (adresse tapée, favori, lien d'un autre site) s'ouvre en haut : son entrée,
  comme celle d'une ancre de la page (lien d'évitement `#main`, `#importer`), reçoit sa propre clé
  avant le routeur (`main.tsx`), qui leur donnait sinon à toutes la même, « default », et une page
  reprenait la position d'une autre (corrigé en novembre 2026). Le
  Pokédex garde la sienne sous son adresse et ses filtres, même rouvert par un lien.
  Partout, la recherche
  (`AppSearch`, Ctrl/⌘ K, la palette de camply) : les pages, quelques actions (exporter, importer) et les 1 025 Pokémon (noms français, anglais, japonais, numéro ; groupe
  « Espèces » : la palette cherche aussi dans le nom du groupe, « Pokémon » ferait tout trouver à
  « poké »). L'accueil est un
  tableau de bord (dès qu'il y a une carte ou une commande) : un seul appel principal vers le
  Pokédex (tant que rien n'est commencé, « Ouvrir le Pokédex » est secondaire : l'appel principal
  est « Choisir dans le catalogue » de « Pour commencer »), progression (anneau, réglette compacte des
  régions ; sur téléphone, la liste des régions à sa place, chacune un lien de 44 px de haut vers
  le Pokédex filtré sur elle, `RegionProgress` `linked`, que reprend sans lien le Pokédex public :
  la réglette y laissait des segments de 16 px, sans nom lisible ; dessous, une ligne par
  collection d'extension, rien sans collection : son nom et le drapeau de sa langue,
  « 87 / 230 » et la barre, tout entière un lien vers sa page ; `SeriesLine`,
  `components/`, que reprend le Pokédex public), « À faire » (commandes en retard ; Pokémon sans
  carte, comptés en Pokémon ; cartes à compléter, sans image, sans id Cardmarket, possédées sans prix payé, comptées en cartes
  distinctes parmi toutes celles du Pokédex, pas seulement les favorites, une TAG TEAM une fois ;
  chacune vers sa liste filtrée : `shoppingUrl`, `pokedexUrl`, qui montre les Pokémon qui ont au
  moins une de ces cartes), indicateurs
  (valeur, dépensé ce mois-ci, liste d'achats, commandes), dernières cartes obtenues (« Vos cartes
  choisies » tant qu'aucune n'est obtenue : une rangée, de trois cartes sur téléphone à dix sur un
  très grand écran) ; une collection vide y trouve trois étapes pour commencer. La progression et
  « À faire » côte à côte ont la même hauteur. Les Collections (`/collections`,
  `pages/collections/`) : le Pokédex en première tuile, toujours là (débloqués sur 1 025, et la
  part ; pour image, trois de ses cartes favorites en éventail, celles des Pokémon débloqués
  d'abord, ou les trois Pokémon de départ tant qu'aucune n'a d'image), puis une tuile par
  collection d'extension, dans l'ordre où elles ont été commencées : son
  logo (demandé à son chemin, sans le catalogue : son code s'il n'y en a pas), son nom et le
  drapeau de sa langue (`LanguageFlag of="set"`, « Extension japonaise »), son code, « 87 / 230 »
  et sa barre, sa valeur au prix du jour ; chaque tuile est tout entière le lien de son titre (vers
  `/pokedex`, ou la page de la collection, `seriesPath` : `/collections/M6A`, `?langue=fr` pour une
  française). « Nouvelle collection » ouvre la fenêtre des extensions (`SetPicker`, celle de
  « Changer d'extension » au Catalogue, son bouton réglable) avec l'interrupteur de langue en haut
  (dans l'adresse de la page, `?langue=fr`) ; une extension déjà commencée dans cette langue y est
  marquée « Commencée » et mène à sa page ; une autre commence sa collection
  (`useStartCollection`) : ses cartes chargées (le bouton attend, un second clic ne la commence pas
  deux fois, le magasin non plus), la collection annoncée avec « Annuler » (« Collection Méga Rêve
  ex commencée : 230 cartes. »), puis sa page ouverte, si l'utilisateur est encore sur la page qui
  l'a lancée (partie ailleurs, ou au Catalogue passée à une autre extension, dont le bouton est un
  autre, clé par extension : elle reste commencée et annoncée, sans l'arracher à sa page) ; sans
  ses cartes (l'API ne répond pas) : un message, rien de commencé, et un nouvel essai les
  redemande. La page d'une collection
  (`SeriesPage`, `/collections/M6A`, `?langue=fr`) : en tête le fil d'Ariane (Collections › son
  nom), son nom et le drapeau de sa langue, son code et le jour où elle a été commencée ; puis son
  logo (au-dessus
  de ses chiffres quand la page a moins de 56rem) et ses chiffres (`seriesProgress` : cartes
  possédées sur toutes, leur part et la barre ; leur valeur au prix du jour ; le coût pour la
  compléter, ses cartes ni possédées ni commandées, « Sans compter 2 cartes sans prix ») ; puis
  toutes ses cartes (`SeriesGrid`, dans `components/` : le Pokédex public la reprend en lecture
  seule, `linked` faux, chaque carte une image décrite, dans sa section « Collections » :
  `docs/compte-et-synchronisation.md`), dans l'ordre de l'extension, possédées en couleur, les
  autres en grisé (`CardArt` `locked`), avec leur marque de statut, leur numéro et leur nom ;
  dessinées au fur et à mesure (`useGrowingList`, 60 à la fois ; d'emblée jusqu'à celle de
  `?carte=`, arrondi au palier, souvent une case loin dans l'extension), seules celles à l'écran
  le sont (`content-visibility`), et mémoïsées : une carte qui change de statut ne redessine
  qu'elle. Au-dessus, « Toutes / Possédées / Manquantes » (avec leur nombre) masque les autres
  (`hidden`, comme le Pokédex public) ; la dernière carte ouverte reste montrée jusqu'au
  prochain choix (son statut changé dans sa fenêtre ne la masque pas sous les yeux, et elle reprend
  le focus) ; aucune à montrer, un message et « Voir toutes les cartes ». « Supprimer la
  collection » est en bas de la page, loin de l'en-tête (décision de
  l'utilisateur, novembre 2026).
  Une carte ouvre sa fenêtre (`SeriesCard`, pleine page et mise en page comme la fiche d'une carte
  du catalogue : `CardLayout`, que les deux reprennent par `composes … from` ; à la construction,
  Vite écrit pour cela un avertissement PostCSS (`from`), attendu et sans effet tant que le
  fichier partagé n'a pas d'`url()`) :
  son image, sa référence et son drapeau, son statut et ses Pokémon (chacun vers sa fiche ; aucun
  pour un dresseur), « Je possède cette carte » et « Marquer comme commandée », le prix payé et la
  confirmation pour quitter « possédée » (`CardStatusControls`, les mêmes que sur la fiche d'un
  Pokémon), son prix Cardmarket et sa courbe (`PricePanel`) ; chaque action annoncée avec
  « Annuler ». Le statut d'une carte se dit de même partout où l'utilisateur voit les siennes
  (`statusLabel`, `lib/format.ts` : la grille, cette fenêtre, la fiche d'un Pokémon, le
  Catalogue : « Dans votre collection Méga Rêve ex, non possédée ») : « Possédée », « Commandée »,
  et sans statut « Non possédée » (« À acheter » n'est plus un statut,
  `docs/collection-et-achats.md`) ; le Pokédex public, qui ne dit rien des achats, dit « à
  débloquer » (`publicStatusLabel`). Le lien d'une carte ailleurs dans l'app (`cardPath`, plus
  bas) ouvre sa fenêtre d'emblée : `?carte=<id>` (`seriesPath` avec la carte), lu par `seriesCard` dans
  `SeriesGrid` (seulement une case de la collection ; sinon, aucune fenêtre) ; fermée, l'adresse
  perd `carte` (sans remonter la page) : un rechargement ou « Précédent » ne la rouvre pas, comme
  une fenêtre ouverte depuis sa tuile. « Supprimer la collection » demande confirmation, qui
  dit ce qui reste (possédées, dans le compte, et au Pokédex pour celles d'un Pokémon ; commandées
  ou dans une commande, comme cartes seules ; ajoutées seules, telles quelles) et ce qui part (les
  cartes à acheter, et, comptées à part, celles « commandées » à la main sans commande, avec leur
  statut), d'après `seriesRemoval` ; la suppression est annoncée avec
  « Annuler » (« Collection Méga Rêve ex supprimée. »). Une collection inconnue (une autre
  extension, ou une autre langue) : la page introuvable. Une collection qui disparaît sous sa page
  (supprimée, son début annulé par « Annuler », supprimée sur un autre appareil) ramène aux
  Collections (`Navigate`, qui remplace l'adresse) ; de même un début annulé avant que sa page,
  chargée à la demande, ne s'affiche (`useStartCollection` l'ouvre avec l'état de navigation
  `started`). Le Pokédex : recherche, filtres rapides de
  possession avec leur nombre (les autres filtres appliqués), les autres filtres dans un panneau
  (génération, type, carte), chacun rappelé en étiquette retirable ; quand tout ne tient pas sur
  une ligne, les filtres rapides passent dessous (sur téléphone, ils défilent de côté) ; un second
  appui sur un filtre rapide le relâche (« Tous » de nouveau). Le Catalogue : sa recherche et ses
  rangées de filtres (rareté, type) tiennent dans une colonne de la largeur de la page
  (`minmax(0, 1fr)`) : les rangées défilent seules, la page ne glisse plus de côté. Achats :
  sur téléphone, les filtres de la liste dans un panneau « Filtres », l'onglet ouvert amené dans
  la rangée d'onglets qui défile (positionnée : le mot caché d'un badge, « en cours », y reste et
  ne fait plus déborder la page) ; page étroite, les badges des onglets se resserrent. Le
  catalogue : en tête de page l'interrupteur de langue (deux drapeaux SVG dans un
  `SegmentedControl`, `LanguageSwitch`, à droite du titre, dessous sur téléphone), puis un panneau
  (le logo de l'extension, son nom, sa sortie, son nombre de cartes et son bloc, « Changer
  d'extension », et « Commencer la collection » de l'extension montrée, comme aux Collections,
  ou « Voir ma collection » si elle l'est dans cette langue), puis la recherche, les filtres de
  rareté et de type
  (chacun sur une ligne qui défile de côté sur téléphone), ce que compte l'extension et ses cartes
  en tuiles serrées (10 colonnes sur un écran de 1440 px, 3 sur téléphone) ; la fiche d'une carte,
  pleine page : l'image à gauche, qui reste à l'écran quand le reste défile, ce qu'on sait de la
  carte et son prix à droite (l'une sous l'autre sous 48rem) ; dans le pied, les flèches des
  cartes voisines et l'ajout, qui passe dessous s'il ne tient pas. La recherche, les filtres et la
  fiche ouverte sont dans l'adresse (NAV-05, novembre 2026 : écrite
  `?recherche=pika&raretes=1%2C8&types=4&carte=025`, la virgule encodée, et relue aussi avec une
  virgule simple ; en français, NAV-06 ; `parseCatalogView`, `catalogViewParams`,
  `lib/filters.ts`, testés), seule source de la vue (pas d'état recopié) : une vue se partage, et « Précédent »
  depuis une page qu'elle a ouverte (la fiche d'un Pokémon) la retrouve, fiche comprise. Chaque
  changement remplace l'entrée de l'historique (`filterUpdate`, comme au Pokédex), hors de la
  transition du routeur : le champ suit la frappe, la grille en différé. Une autre recherche ou
  d'autres filtres ferment la fiche (`changeCatalogView` : une carte de l'adresse que la grille
  ne montre pas n'ouvre rien, et ne se rouvre pas quand un filtre la ramène) ; une autre extension
  ou langue repart d'une vue vide. Relue, la vue est ramenée à l'extension (`availableFilter`,
  `catalogCardIndex`, `lib/card-catalog.ts`, testés) : une rareté synonyme devient celle de ses
  cartes (`raretes=8`, « C », est « Commune » quand l'extension la nomme ainsi), une rareté ou un
  type qu'elle n'a pas est oublié, et `carte=25` ouvre la carte 025 (`numberKey`) ; sans réécrire
  l'adresse (aucune navigation de plus) : la suivante, écrite à un autre choix, est canonique. Réglages : un sommaire (collé à
  gauche sur grand écran) vers trois groupes — Compte & partage, Sauvegarde, Avancé — dont les
  panneaux passent sur deux colonnes sur très grand écran. Le serveur n'y apparaît qu'en cas de
  problème ; l'effacement garde son fond teinté de rouge. Valeur : ses panneaux l'un sous
  l'autre. La fiche d'un Pokémon :
  fil d'Ariane (Pokédex › région › nom) et Pokémon voisins (liens et ← →, qui remplacent l'entrée de
  l'historique, décision D-09 : trente fiches parcourues ne demandent pas trente « Précédent ») ; sous son nom, la phrase de possession
  puis, dès une carte, toutes ses cartes (`CardList` : dans l'ordre d'ajout, un bouton par carte,
  sa petite image ou le dessin de l'espèce, sa référence et son drapeau, la favorite marquée
  « ★ Favorite » ; puis « Ajouter une carte », qui en ajoute une sans rien remplacer). La carte
  montrée (`aria-pressed` dans la liste) : celle choisie dans la liste, sinon la favorite ; une
  carte qui apparaît (ajoutée, ou rétablie par « Annuler ») devient la carte montrée, une carte
  montrée qui disparaît laisse la place à la favorite ; rien ne passe d'une fiche à l'autre
  (`AppShell` remonte la page à chaque adresse). Puis la carte montrée, collée à l'écran (sa
  largeur suit la page : `cqi`), et ses panneaux (statut et prix payé, favorite, prix Cardmarket,
  « Dans le Pokédex ») : sur deux colonnes dès que la fiche a la place, 46rem (la carte et ses
  statuts à gauche, son prix à droite ; à 38rem, chaque panneau n'avait que 290 px sur un écran de
  1 280 px) ; le titre de la carte dit « ★ Favorite » quand c'est la favorite du
  Pokémon, ses actions « Mettre en favorite » sinon ; retirer la favorite d'un Pokémon qui garde
  d'autres cartes demande toujours une confirmation, où l'on coche la nouvelle favorite parmi
  elles (rien de coché au départ, confirmer est impossible avant ; possédée, elle dit aussi ce qui
  part) ; « {nom} ne sera plus débloqué » n'est dit (quitter « possédée », retirer une carte
  possédée) que pour un Pokémon dont aucune autre carte n'est possédée (`unlockedWithout`) ; une
  carte qui est une case d'une collection d'extension (`seriesOf`) n'a pas « Retirer la carte »
  actif : « Elle fait partie de votre collection Méga Rêve ex : elle y reste. » (supprimer la
  collection la garde, `docs/collection-et-achats.md`) ;
  le lien vers le prochain Pokémon sans carte vient après les actions de la carte,
  « Dans le Pokédex » à part sur grand écran ;
  seul effet appuyé de l'app, la carte en grand suit la souris et la lumière y glisse
  (`CardStage` : variables CSS, sans rendu React ; ni au toucher ni en mouvement réduit,
  `reducedMotion` de `lib/motion.ts`). Un lien
  partagé a son aperçu (`og:` dans `index.html`, l'adresse du site et l'icône pour image ; celui du
  Pokédex public, son titre et sa progression). Les
  courbes (`PriceChart`, `lib/chart.ts`) vont jour par jour, sur la période choisie (7 jours,
  30 jours, 1 an, tout ; 7 jours au moins, l'axe la couvre en entier) : Valeur › Évolution (valeur
  de la collection, Pokémon débloqués, dépenses cumulées depuis le début de la période) et le prix
  d'une carte sur sa fiche (la même courbe que la valeur : `LevelChart`), chacune avec ses chiffres
  dessous (`ChartStats` : évolution, plus haut, plus bas, moyenne ; pour un total, ce qu'il a gagné
  et son rythme par semaine). Aucun point
  inventé : un jour sans prix n'en a pas ; un total (`fromZero`) part de zéro. Cardmarket ne publie
  que le guide du jour (aucune archive) : l'historique vient du relevé quotidien de l'API des
  données, et, pour les 180 jours qui le précèdent, de Pokécardex (sa tâche `history`), au même
  prix suivi. Les nombres formatés gardent une espace insécable visible (`spaced`, `lib/format.ts` :
  l'espace fine de `Intl` manque à certaines polices ; une part : `formatShare`, « 12,5 % »). Une
  carte sans Pokémon (un dresseur, une énergie : une case d'une collection d'extension) se montre
  partout comme les autres (accueil, Valeur, liste d'achats, prochaine commande, commandes), son
  nom pour titre (`cardTitle` : sa référence sans son code) et son image, ou une carte de
  substitution sans dessin d'espèce. Où mène le lien d'une carte (accueil, Valeur, liste d'achats,
  prochaine commande, commandes) se décide en un seul endroit (`cardPath`, `lib/filters.ts` ;
  `CardPageLink`) : une case pas encore obtenue (`seriesOnly`, absente de la fiche de ses Pokémon,
  où « Je possède cette carte » viserait une autre carte) ou une carte sans Pokémon mène à la page
  de sa collection, sa fenêtre ouverte (`?carte=`) ; une autre carte, à la fiche de son Pokémon (le
  premier d'une TAG TEAM) ; une carte sans Pokémon ni collection ne mène nulle part (sur l'accueil,
  elle ne se soulève pas au survol). Une case d'extension dit sa collection (« Collection Méga Rêve
  ex » sur la liste d'achats, un lien vers sa page ; « collection … » sur sa ligne).
- Installation : le site s'installe sur téléphone et ordinateur (`public/manifest.webmanifest`,
  icônes de `public/icons` et `public/apple-touch-icon.png`, dessinées d'après `favicon.svg`). Pas
  de service worker ni d'usage hors ligne (décision de l'utilisateur, octobre 2026 : la collection
  n'est gardée que par le serveur). Une page restée ouverte pendant un déploiement, qui charge une
  page à la demande dont le fichier n'existe plus, se recharge avec la nouvelle version
  (`vite:preloadError`, `main.tsx` ; une fois par minute au plus). Hors ligne
  (`navigator.onLine`, qui compte un réseau sans Internet pour en ligne : la page se recharge
  alors comme avant), elle ne se recharge pas : recharger mènerait à l'écran d'erreur du
  navigateur, hors de l'app et de ses modifications en attente. La page d'erreur de l'app
  s'affiche à la place (`ErrorPage`), l'app reste en mémoire, et ses modifications partent au
  retour du réseau ; mais la page manquée ne s'ouvre ensuite qu'après un rechargement (le routeur
  garde l'échec). Hors ligne, `ErrorPage` le dit (« Pas de connexion ») et ramène à la page
  précédente plutôt que de recharger ; le réseau revenu, elle redevient la page d'erreur ordinaire
  (« Recharger la page »). Son détail de l'erreur, souvent une adresse sans espace, se coupe pour
  tenir sur un téléphone. Les moteurs de recherche
  n'indexent que les pages publiques : l'accueil, la connexion, l'inscription et les mentions
  légales ; les autres adresses de l'app, le Pokédex public de chaque compte compris, reçoivent
  `X-Robots-Tag: noindex` du Worker (`worker/headers.ts`), et `public/robots.txt` écarte `/api/`.
- Performance (mesurer en production, `bun run build` puis `bun run preview` : `bun dev` est 3 à 4
  fois plus lent ; mesuré en octobre 2026 sur une collection de 1 025 cartes, avant → après) : au
  démarrage, rien n'attend le script (le compte préchargé par `index.html`, les espèces par le
  Worker quand le navigateur a une session, sauf sur la connexion et l'inscription,
  `worker/headers.ts` ; une fois le compte connu, elles
  partent avec la collection, `signIn`), et la connexion, l'inscription
  et les mentions légales ne demandent pas les espèces (`docs/compte-et-synchronisation.md`). Les
  polices : seules les graisses que l'app emploie (`main.tsx` : Manrope 400 à 700, Space Grotesk 600
  et 700 ; une graisse absente prendrait la plus proche, sans le dire), et celles des premières
  pages préchargées (`index.html` : Manrope 400 et 600, Space Grotesk 700). La police « à chasse
  fixe » de camply (`--camply-font-mono` : la valeur d'un curseur, `Kbd`) est celle des titres
  (`global.css`) : JetBrains Mono n'est pas chargée ; le curseur du budget a des chiffres de même
  largeur (`font-variant-numeric`). Le
  Pokédex affiche 1 025 pochettes. Seules celles à l'écran sont dessinées (`content-visibility`, de
  même pour la liste d'achats et les cartes du catalogue), et une génération hors de l'écran ne
  compte pas dans la mise en page (`content-visibility` sur la section, sa hauteur estimée d'après
  son nombre de pochettes, `--tiles`, puis retenue : 30 à 75 ms de mise en page par filtre ou
  frappe → 11 à 16). Un Pokémon sans carte a une pochette compacte (F-UX-09, novembre 2026 :
  carrée, son sprite à sa taille, le numéro et le nom alignés au bas d'une rangée mêlée ; elle
  compte pour quatre cinquièmes dans `--tiles`, une estimation) : un Pokédex sans cartes, à
  1 036 px de large, passe de
  55 665 à 44 982 px de haut (−19 %). Un filtre masque les pochettes (`hidden`) au lieu de les démonter : la grille
  les garde toutes, dans l'ordre choisi. La coquille garde le classeur en vie, caché, pendant la
  visite des autres pages (`<Activity>` de React, `AppShell` ; ses filtres restent ceux de sa
  dernière adresse, `usePokedexFilters`) : le retour depuis une fiche le montre aussitôt, à la même
  position (330 à 410 ms → une quarantaine), sans refaire ses pochettes. Son premier affichage
  dessine un écran de pochettes, puis les autres en arrière-plan (`useDeferredValue` avec une
  valeur de départ : 111 ms → 42 avant la première image), ouvert directement aussi (nouvel
  onglet, favori ; mesuré en novembre 2026 avec une collection presque vide, sur mobile, CPU ×4 :
  plus longue tâche 574 ms → 257, TBT 744 → 469, LCP 1 688 → 1 336). Pas en revenant par
  l'historique dans la même visite (`mounted` : le routeur dit `POP` au premier chargement aussi),
  ni après un rechargement (position gardée dans le stockage de la session) : le défilement retrouvé
  a besoin de toute la hauteur. Le Pokédex public fait de même, toujours (hors de la coquille,
  aucune position de défilement à retrouver ; `usePokedexGrid`, commun aux deux classeurs) : premier
  écran d'abord, et son choix « Tous », « Débloqués », « À obtenir » masque les pochettes (mesuré en novembre 2026 sur un compte de 897 cartes, site construit, mobile, CPU ×4 :
  un changement de filtre 940 ms → 240 vers « Tous », 448 → 200 vers « À obtenir », 216 → 196 vers
  « Débloqués » ; la première pochette 2,4 s → 1,0 après l'arrivée des données, LCP 4,0 s → 2,6,
  mais toute la grille une demi-seconde plus tard).
  Les marques de possession sont des icônes CSS (masques, pas de SVG :
  plus de 1 000 sinon ; en contraste élevé, `forced-colors`, les couleurs du système, sans quoi le
  glyphe disparaîtrait). En contraste élevé encore, le lien de la page ouverte (`aria-current`),
  ce qui est choisi (`aria-pressed` : un filtre, une région de la réglette, une carte) et le
  segment choisi d'un `SegmentedControl` gardent un contour pointillé (`global.css`), qui
  redevient l'anneau du focus, plus épais, quand ils l'ont ; les drapeaux gardent
  leurs couleurs ; le remplissage des barres (`Progress`) est à demander à camply (décision de
  l'utilisateur, novembre 2026 : pas de classe interne). Et rien de ce qui défile n'a de
  `backdrop-filter` (flou recalculé à chaque
  image). Les pochettes, comme les cartes de la liste d'achats, sont de simples liens (`<a>`, pas
  un `Link` de react-router, qui lit l'adresse : des centaines se redessineraient à chaque frappe
  d'une recherche gardée dans l'adresse) ; la liste lit le clic une fois pour toutes
  (`useFollowLinks`) et fait suivre un clic ordinaire (Entrée comprise) par le routeur, pas un clic
  avec Ctrl, ⌘, Maj ou Alt, ni un lien vers un autre site. La coquille ne se redessine qu'en
  changeant de page (`Shell`, mémoïsée sur le chemin ; le menu du compte lit l'adresse au clic) :
  une frappe dans la recherche du Pokédex coûte 10 à 20 ms au lieu de 80 à 140. La recherche
  Ctrl K n'est montée qu'à sa première ouverture (ses plus de 1 000 commandes coûtaient une
  soixantaine de millisecondes au démarrage), puis mémoïsée ; ses pages ont les libellés de la
  navigation et des mots-clés sans accent (« reglages », « mot de passe », « theme »), ses actions
  « Exporter », « Importer » et « Changer de thème » ; la palette n'en rend que les 50
  premières qui correspondent (`limit` de camply), une ligne dit combien d'autres. `buildPokedex`
  reprend les entrées inchangées du Pokédex précédent (la même favorite, les mêmes cartes aux mêmes
  statuts) : après
  une annulation ou la collection relue du serveur, seules les pochettes changées se redessinent.
  Le tableau des cartes de Valeur (trié par lui, le tri du tableau contrôlé) et la liste d'achats
  sont dessinés au fur et à mesure (`useGrowingList` : Valeur 151 ms → 60 à l'ouverture, Achats 254
  → 53). Ces deux listes et la grille d'une collection d'extension, qu'on quitte par leurs liens,
  gardent leur longueur dans l'entrée de l'historique (`name` de `useGrowingList`, dans son état) :
  « Précédent » ou un rechargement les redessine aussi longues, et la position de défilement et le
  lien suivi y sont encore. Un montant au prix du jour (`PricedValue`, des centaines par page) lit la réponse des prix
  de la collection une fois par état (`store/prices.ts`). Le plan de la prochaine commande suit le
  curseur du budget en différé (`useDeferredValue`), et ses listes sont dessinées au fur et à
  mesure (`useGrowingList`, 60 cartes à la fois) : un pas du curseur ne redessine pas toutes ses
  cartes. La liste des cartes à ajouter à une commande est triée une fois par collection, pas à
  chaque frappe. La collection est envoyée au serveur une fois pour les modifications
  d'une demi-seconde (`store/account.ts`). La carte
  d'une fiche ne suit la souris qu'une fois par image (`CardStage`). Les animations ne se rejouent
  pas à chaque visite (les pages se remontent) : la marque de possession seulement quand le statut
  change sous les yeux, une fois (une marque cachée puis remontrée, le Pokédex gardé en vie ou un
  filtre, ne la rejoue pas), les cartes de l'accueil seulement quand une nouvelle arrive. Le premier
  affichage d'un classeur (Pokédex, Pokédex public) montre ses intertitres de génération dès le
  premier écran de pochettes (la page sait combien de générations la liste montre : l'intertitre
  ajouté ensuite pousserait les pochettes déjà peintes). Les pages autres que l'accueil,
  le Pokédex, les fiches, la page introuvable et la page d'erreur sont chargées à leur première
  ouverture (`lazy`, `router.tsx` : une
  route parente sans chemin porte une seule fois la page d'erreur et l'attente, vide, d'une page
  ouverte directement) ; sur un réseau lent, une barre fine en haut le dit (`NavigationProgress`,
  `AppShell` : le `Progress` indéterminé de camply, sans fond, montré après 0,3 s). React et
  react-router ont leur propre fichier (`react-*.js`, `vite.config.ts`), qu'un déploiement de l'app
  ne change pas tant qu'elle emploie les mêmes fonctions de react-router (hors mise à jour de React
  ou de react-router) : un visiteur qui revient le garde (`/assets/`, un an, `worker/headers.ts`) et
  ne retélécharge que le code de l'app (`index-*.js` : 37 Ko compressés au lieu de 101). La fenêtre
  d'une carte est préparée dès que le pointeur ou le focus arrive sur « Modifier la carte » ou
  « Ajouter une carte » (`AddCardButton`, avec les cartes japonaises du Pokémon ; sur une fiche
  sans carte, aussi quand le navigateur est libre ; une fiche quittée avant ne prépare rien :
  parcourir les fiches avec ← et → ne les prépare pas toutes), et une roue dit son ouverture si elle
  tarde. Le client Better Auth non plus (`lib/auth.ts`, à part de `lib/account.ts` que lit le
  démarrage) : seules la connexion, l'inscription et Réglages › Mon compte l'importent, la
  déconnexion le charge à la demande. Une donnée chargée à la demande et lue par `use()` passe par
  `settled` : sans lui, React retient l'affichage environ 300 ms à chaque ouverture (fenêtre
  d'ajout, catalogue). La fiche d'un Pokémon sans carte prépare ses cartes du catalogue pendant que
  le navigateur est libre (les siennes seulement, `/api/catalog/species/<n°>` : moins de 1 Ko
  compressé en moyenne, 7 pour Pikachu). La page Catalogue ne charge que la liste
  des séries (`/api/catalog/sets`, environ 8 Ko compressés) puis les cartes de l'extension montrée
  (`/api/catalog/sets/<code>`), chacune une fois, et leurs seuls prix ; la liste est demandée en
  même temps que le code de la page (le `loader` de sa route, `router.tsx`), pas après lui, et les
  cartes de l'extension de l'adresse (`?set=`) dès que la liste arrive, si elle a ce code
  (`catalogSet` : un code inconnu ne demande rien, la page montre la plus récente).
  Les longues listes
  du catalogue (les cartes d'une extension ou d'un Pokémon, jusqu'à 382 pour Pikachu ; les plus de
  400 extensions) sont dessinées au fur et à mesure (`useGrowingList` : 60 cartes ou 40
  extensions, puis autant chaque fois qu'un repère haut d'un écran, `growing-sentinel`, paraît au
  bas de la liste) : mesuré en production (octobre 2026), la fenêtre des extensions s'ouvre en
  40 à 80 ms au lieu de 270 à 490, et se ferme en une dizaine de millisecondes au lieu de 250 à
  430 (démonter des centaines de tuiles coûtait autant que les dessiner). Le piège à focus de
  camply ne mesure que les bords d'une fenêtre, pas chaque bouton à chaque Tab. Le bouton
  « Changer d'extension » porte lui-même l'état de sa fenêtre (`SetPicker`) : l'ouvrir ne
  redessine pas la page et ses cartes. La fenêtre lit les extensions de sa langue (`loadSets` :
  déjà là au Catalogue ; aux Collections, demandées à la première ouverture, puis à l'interrupteur
  pour l'autre langue, une ébauche le temps qu'elles arrivent, la recherche gardée). Changer
  l'ordre des extensions passe en arrière-plan
  (`startTransition`). Les deux grandes fenêtres (le choix d'une extension, l'ajout d'une carte)
  sont pleine page (`Modal size="full"`) : seul leur contenu défile, leur titre et leurs boutons
  restent à l'écran (camply), la recherche des extensions reste en haut (`position: sticky; top: 0`)
  et prend le focus à l'ouverture (`initialFocus`). Dans la fenêtre d'ajout, la fonction qui choisit
  une carte est la même d'un rendu à l'autre (`fill` de `useCardDraft`, `pick` de `CardForm`) : les
  tuiles, mémoïsées, ne se redessinent pas à chaque sélection ; et les prix d'autres cartes que
  celles de la collection (`usePrices(ids)`) ne suivent pas la collection. Une carte choisie y est
  résumée, « Ajouter comme » d'abord, ses champs repliés sous « Modifier les détails » (`Accordion`
  de camply ; `docs/cartes.md`) : le geste principal ne passe plus par un écran de saisie. Une
  carte reprise telle quelle (déjà à un autre Pokémon, ou case d'une série : `kept`) n'a que son
  résumé, celui de la carte gardée, et l'alerte qui le dit (H-02).
- Focus et annonces : une action qui retire ou désactive son propre bouton (« Réinitialiser » les
  filtres ou un filtre retiré dans le Pokédex, « Tout afficher » du catalogue, « Retirer les
  filtres » de raretés et de types, l'aperçu d'un import, « Effacer », « Chercher les images »
  quand toutes sont trouvées, « Mettre en favorite ») mène le focus à ce qui suit : la recherche, le
  premier choix, le titre du panneau, « Modifier la carte » (`focusAfter`, `lib/focus.ts`, à côté
  de `keepFocusInList`), au lieu de le laisser tomber au document. Sur la fiche d'un Pokémon, une
  carte montrée qui change sous le focus (ajoutée, retirée, rétablie) emporte le panneau qui
  l'avait : le focus va au titre du nouveau, s'il était perdu (une carte choisie dans la liste le
  garde). De retour sur une page d'où un lien a été suivi (une pochette du Pokédex,
  une carte de la liste d'achats), le focus revient à ce lien (`returnedLink` de `useFollowLinks`,
  la coquille) : celui-là même, par son rang parmi les liens de son adresse que le focus peut
  prendre (deux cartes d'un même Pokémon), jamais une pochette du Pokédex gardé caché ni une
  vignette qui double le lien du titre (au lien du titre si la vignette a été suivie) ; la fiche d'une carte du catalogue fermée, il va à la tuile de la carte montrée en
  dernier (parcourue avec ses flèches), pas à celle ouverte au départ, même ouverte par l'adresse
  (`?carte=`) ou passée par ses flèches au-delà des tuiles déjà dessinées : la grille grandit
  jusqu'à la carte montrée (`CatalogGrid` `atLeast`, suivi par `useGrowingList`) ; la fenêtre d'une carte d'une collection fermée, à sa
  tuile, mise sous les yeux, même ouverte d'emblée par `?carte=` (`focusTileAfter`,
  `lib/focus.ts` : la fenêtre le rendrait sinon au document ; la grille a dessiné d'emblée les
  tuiles jusqu'à la sienne, `useGrowingList`). Une page qui ouvre une fenêtre
  d'emblée la garde : la coquille ne mène pas le focus au contenu, derrière elle, quand il est
  déjà dans une fenêtre. Une page qui en remplace une autre au lieu de s'y ajouter (la coquille
  après la connexion, au retour des mentions légales ou de la page d'erreur, la connexion après la
  déconnexion, l'inscription, une page seule, la page d'erreur) mène le focus à son
  `<main tabIndex={-1}>` : le bouton ou le lien suivi a disparu, il tomberait sur `body`
  (`useFocusOnEntry`). Sauf la toute première page du document, où le navigateur le laisse en
  haut (dans la coquille, le lien d'évitement d'abord), et sauf s'il est déjà
  ailleurs (un champ, une fenêtre ouverte d'emblée). Une saisie refusée s'affiche sous son champ
  (camply : `aria-invalid`,
  `aria-describedby`) : un formulaire refusé (Mon compte, une carte, une commande) y mène le focus,
  où elle est lue s'il y arrive d'ailleurs. L'erreur d'un champ de camply n'est pas annoncée :
  `FieldAlert` (`role="alert"` caché, remonté à chaque refus) la dit quand le focus est déjà au
  champ suivant (un montant refusé en quittant le champ, `EuroInput` : budget, prix payé) ou déjà
  dans le sien (le pseudo, envoyé par Entrée) ; à retirer quand camply l'annoncera. Le nombre de
  résultats est
  annoncé (`aria-live`) dans le Pokédex, la liste d'achats, le catalogue, la fenêtre d'ajout et
  celle des extensions. Les listes dont le nombre compte (grilles du Pokédex, du catalogue et d'une
  collection, liste d'achats, dernières cartes obtenues, lignes d'une commande en saisie,
  `OrderLines`) ont `role="list"` :
  sans puces (`global.css`), Safari leur retire le rôle de liste, et VoiceOver ne dirait plus
  « liste, 24 éléments ». « Annuler » se lance aussi par Ctrl+Z (⌘Z) tant que son toast est affiché
  (`useNotify` ; pas dans un champ, ni avec une fenêtre ouverte) : au clavier, le toast, rendu à la
  fin de la page, était hors d'atteinte en 12 s. Les toasts s'affichent en bas à droite
  (`main.tsx`) :
  à gauche, ils couvraient le pied de la barre latérale (l'état de l'enregistrement).
- États (décisions de l'utilisateur, novembre 2026) : le serveur qui ne répond pas, une seule
  formule (« réessayez dans un instant », `NO_ANSWER`) et « Réessayer » partout (`Unavailable`,
  avec `useRetry` ou, pour les prix du jour, `useRetryPrices` : le message reste, son bouton en
  chargement, jusqu'à la réponse) : Catalogue, fenêtre des extensions, choix des cartes d'un
  Pokémon, Pokédex public, prix d'une fiche, plan d'achat, historique de Valeur, et l'alerte des
  prix de Valeur ; au démarrage, il recharge la page (`PokedexUnavailable`). Aucun résultat :
  `NoMatch`, le même partout (Pokédex, liste d'achats, Catalogue, fenêtre des extensions), dont le
  bouton efface la recherche et rend le focus au champ. Une seule page introuvable (`NotFound`),
  dans la coquille et au Pokédex public. Rien à acheter ni à planifier : les mêmes liens vers le
  catalogue et les Pokémon à débloquer (`ChooseCards`). Un lien vers un autre site
  (`ExternalLink`) dit « (nouvel onglet) » aux lecteurs d'écran ; le pseudo se tape sans majuscule
  ni correction automatiques (`PSEUDO_TYPING`, connexion, inscription, Réglages).
