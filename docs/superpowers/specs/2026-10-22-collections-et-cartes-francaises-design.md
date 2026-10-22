# Cartes françaises et collections de séries : description

Rédigée le 22 octobre 2026 avec l'utilisateur, à valider avant tout code. « Décidé » : ce que
l'utilisateur a dit. « Mon choix » : ce que j'ai tranché, à vérifier à la relecture. Le reste est
laissé au constructeur (dernière partie).

## Intention

PokéCodex (https://pokecodex.fr) est aujourd'hui un Pokédex de cartes **japonaises** : pour
chacun des 1 025 Pokémon, l'utilisateur choisit une carte, et le Pokémon est « débloqué » quand
elle est possédée. L'utilisateur veut deux choses :

1. **Les cartes françaises** à côté des japonaises, avec un petit interrupteur drapeau 🇯🇵 / 🇫🇷.
2. **Collectionner des séries** : commencer par exemple « Méga-Évolution » en français crée une
   collection dont toutes les cartes sont à débloquer ; il peut en avoir plusieurs, japonaises et
   françaises mélangées. L'accueil, le Pokédex et le catalogue restent.

Pourquoi : il collectionne aussi des séries complètes, et en français, ce que l'app ne sait pas
suivre aujourd'hui.

## Objectifs

- Le catalogue complet des cartes françaises (environ 249 séries, 20 000 à 25 000 cartes), au même
  niveau que le japonais : images, logos français, raretés, types, prix, historique.
- Des collections de séries, chacune dans une langue, avec sa progression et sa valeur.
- Plusieurs cartes par Pokémon dans le Pokédex, l'une d'elles « favorite ».
- Tout ce qui existe continue de marcher : achats, commandes, budget, valeur, Pokédex public.

## Non-objectifs

- Un prix propre au français : il n'existe pas (voir Prix). Pas d'autre langue que JP et FR.
- Les variantes comme cases à part : une Reverse n'est pas une carte de plus (décidé).
- Des collections libres, composées à la main : une collection de série, c'est une série entière
  dans une langue.

## Anti-objectifs (un échec même si « ça marche »)

- Perdre ou abîmer les collections existantes (des comptes réels sont en ligne).
- Que l'app choisisse une carte à la place de l'utilisateur, au-delà de la règle de la première
  carte favorite (règle du projet : aucune sélection automatique).
- Nommer une source dans ce que voit le navigateur, ou afficher une image depuis Pokécardex
  (règle « Anonyme »).
- Lire Cardmarket au-delà de ses fichiers publics (pas de scraping, pas d'API).
- Compter deux fois la même carte dans la valeur, la liste d'achats ou le budget.

## Contraintes

- Règles des deux `CLAUDE.md` (mis à jour : cartes japonaises **et françaises**, Pokécardex seule
  source). Code volontairement simple ; contrôles seulement sur l'extérieur ; tests seulement où
  une erreur coûte ; pas de tests d'interface.
- **Pokécardex** : la partie française a la même forme que la japonaise (vérifié le 22 octobre
  sur deux pages de séries et deux pages de cartes) : séries à `/series/<code>` (sans `jp`),
  cartes à `/carte/<id>`, même chiffrement et même clé, menu `seriesMenu.blocksByRegion.FR`,
  champs des cartes identiques (`id_card`, `num_card`, `sort`, noms fr/en/de, `id_pokedex_list`,
  `id_cardmarket`, `cardmarket_url`, `only_english`, `versions`…), séries avec `releaseDateFR` et
  `releaseDateUS`. Scans à `pokecardex-scans.b-cdn.net/sets/<code>/…` (le nom de fichier des
  séries récentes reste à lire dans les données), logos français à `assets/images/logos/<code>`.
  Même rythme qu'aujourd'hui (une page toutes les 3 s), même User-Agent.
- **Codes de séries en commun** entre JP et FR (SVP, SM10, XY… au moins 16) : la langue doit
  entrer dans toutes les clés (tables, adresses, chemins d'images, clé d'une carte). Les images
  ont des chemins neutres propres à chaque langue dès le premier jour (elles sont gardées un an par
  les navigateurs et nginx : un chemin ne doit jamais changer de contenu).
- **Le schéma** des deux bases ne se change que par des étapes ajoutées (`APP_STEPS`,
  `DATA_STEPS`) ; l'historique des prix et les collections sont irremplaçables.
- **Le contrat** de l'API des données (`contract.ts` / `types.ts`, `bun run contracts`).
- **Rien dans le navigateur** sauf le thème : l'état de l'interrupteur vit dans l'adresse ou dans
  le document du compte.
- Volumes côté données (estimés) : catalogue FR environ 15 min, historique repris 12 à 20 h,
  images environ 1 à 1,4 Go.
- **Les images** (décidé) : toutes téléchargées **à l'avance** par la tâche `images`, japonaises
  et françaises ; l'API ne copie plus aucune image à la demande (une image absente : la carte de
  substitution). Le VPS a beaucoup de place : le cache d'images de nginx (4 Go aujourd'hui) est
  agrandi en conséquence.

## Ce qui est décidé

### Langues et prix

- Deux langues, japonais et français ; chaque carte est de l'une ou de l'autre.
- **Prix d'une carte française** : celui du produit Cardmarket, commun à toutes les langues
  (surtout porté par les offres anglaises) — décidé « pour l'instant ». Il n'existe aucun prix
  français : ni dans les fichiers publics de Cardmarket, ni chez Pokécardex (qui recopie le même
  guide). Les prix japonais restent japonais (produits à part chez Cardmarket).
  *Mon choix* : une mention discrète « prix toutes langues » à côté du prix d'une carte française.
- Le lien « Voir sur Cardmarket » d'une carte française filtre les offres en français
  (`language=2`, *à faire vérifier par l'utilisateur sur cardmarket.com*, comme il l'a fait pour le
  japonais) ; japonais inchangé (`language=7`).
- « Copier pour Cardmarket » marche aussi pour les cartes françaises : le nom anglais de
  l'extension vient de `cardmarket_url` / des données de Pokécardex. Le format des lignes est à
  faire revérifier par l'utilisateur sur une extension internationale. Les lignes japonaises et
  françaises sont copiées séparément, chacune réglée ensuite dans sa langue sur Cardmarket
  (*mon choix*).

### Une carte, ses variantes

- Une carte = une langue, une série, un numéro. Une **Reverse ne compte pas à part** : posséder la
  Reverse, c'est posséder la carte (décidé). Sa valeur : le prix de la carte normale (*mon choix*).
- Une même carte n'existe qu'une fois dans le compte, même si elle est à la fois dans une
  collection de série et favorite d'un Pokémon : achetée une fois, comptée une fois.

### Le Pokédex et la carte favorite

- Un Pokémon peut avoir **plusieurs cartes** : celles ajoutées seules (décidé : on peut toujours
  ajouter une carte seule, de la série qu'on veut, et elle est voulue : liste d'achats) et celles
  de ses collections de séries **une fois obtenues** (décidé : une carte de série non obtenue
  n'est pas encore une carte du Pokémon ; commencer une série ne remplit pas le Pokédex).
- Le Pokédex affiche pour chaque Pokémon sa carte **favorite**, choisie par l'utilisateur. La
  **première** carte d'un Pokémon devient favorite d'office ; ensuite, c'est toujours lui qui
  change de favorite (décidé), depuis la fiche du Pokémon, qui montre **toutes** ses cartes.
  L'app ne propose rien au moment où une carte est obtenue (décidé : « plus simple »).
- **« Débloqué »** (décidé) : un Pokémon est débloqué dès qu'**une** de ses cartes est possédée,
  quelle qu'elle soit ; la favorite ne décide que de la carte affichée.
- Retirer la favorite d'un Pokémon qui a d'autres cartes : la confirmation demande laquelle
  devient favorite (*mon choix* : un Pokémon qui a des cartes a toujours une favorite, et l'app ne
  la choisit jamais). Une carte venue d'une série se retire depuis sa série, pas depuis la fiche du
  Pokémon (*mon choix*).
- Une carte à plusieurs Pokémon (TAG TEAM) peut être la favorite de chacun (*mon choix*).

### Les collections de séries

- Une collection de série = **toutes** les cartes d'une série dans une langue : Pokémon,
  dresseurs, énergies, secrètes ; une case par carte (pas par variante).
  *Mon choix* : les cartes que Pokécardex marque `only_english` n'entrent pas dans une collection
  française (elles n'ont pas été imprimées en français).
- Plusieurs collections, japonaises et françaises mélangées ; pas deux fois la même série dans la
  même langue (*mon choix*).
- Une carte de la série est débloquée quand elle est possédée (normale ou Reverse).
- Les cartes manquantes d'une collection vont dans la liste d'achats, comme celles du Pokédex ;
  le budget, la prochaine commande et les commandes couvrent tout (décidé, confirmé).
- **La prochaine commande** (décidé) : la règle « une carte par Pokémon » ne vaut que pour les
  cartes du Pokédex (ajoutées seules) ; les cases des séries en sont libres (plusieurs cartes d'un
  même Pokémon peuvent partir dans la même commande).
- Une carte déjà dans le compte (même langue et même code, ou même id Cardmarket) est reconnue
  comme la case correspondante d'une série commencée ensuite : pas de doublon (*mon choix*).
- Supprimer une collection : les cartes déjà obtenues restent dans le compte (et donc dans le
  Pokédex) (décidé, confirmé) ; une carte commandée reste aussi, comme carte seule (*mon choix* :
  le registre des commandes ne perd rien) ; les autres cases disparaissent.

### L'interface (option C, choisie sur maquette)

- Menu : Accueil, **Collections**, Catalogue, Valeur, Achats, Réglages. Le Pokédex s'ouvre depuis
  la page Collections ; son adresse `/pokedex` ne change pas (*mon choix*).
- **Page Collections** : le Pokédex en première tuile, toujours là (progression sur 1 025), puis
  une tuile par série commencée : drapeau, logo et nom, progression (87 / 230), valeur.
  « + Nouvelle » ouvre le choix d'une série avec l'interrupteur JP/FR en haut ; choisir une série
  crée la collection et l'ouvre.
- **Page d'une série** : toutes ses cartes dans l'ordre des numéros, obtenues en couleur,
  manquantes en grisé ; en haut, progression, valeur, coût pour la compléter. On y marque une
  carte possédée (comme ailleurs dans l'app) ; on peut y supprimer la collection.
- **Catalogue** : le grand catalogue, avec l'interrupteur JP/FR ; on peut y ajouter une carte
  seule (comme aujourd'hui) et y commencer la collection de la série affichée.
- **Fiche d'un Pokémon** : toutes ses cartes, la favorite marquée, et le moyen d'en changer.
- **Accueil** : la progression des collections.
- **Pokédex public** (`/pseudo`) : le Pokédex **et** les collections de séries (décidé). Jamais un
  prix payé, une commande ou un achat (règle existante, testée).
- Le drapeau : des images SVG (Windows n'affiche pas les drapeaux emoji), leurs couleurs dans
  `theme.css` (*mon choix*). L'état de l'interrupteur vit dans l'adresse (`?langue=fr`), japonais
  par défaut (*mon choix*).

### Les données existantes

- Toutes les cartes actuelles sont japonaises et deviennent les favorites de leurs Pokémon ;
  rien ne change pour l'utilisateur à la mise à jour (*mon choix*, voulu sans perte).
- Les anciens exports s'importent toujours (en japonais).

## Ordre de construction (mon choix)

Trois livraisons, chacune utilisable seule :

1. **Le catalogue français** : la langue partout côté données et côté site (clés, chemins,
   contrat), l'ingestion FR depuis Pokécardex, toutes les images téléchargées à l'avance (plus
   de copie à la demande, cache de nginx agrandi), l'interrupteur dans le Catalogue et la fenêtre
   d'ajout, le lien et les lignes Cardmarket FR, la mention « prix toutes langues ». Une carte
   seule peut alors être française.
2. **Plusieurs cartes par Pokémon et la favorite** : le modèle et la fiche du Pokémon.
3. **Les collections de séries** : la page Collections, la page d'une série, l'accueil, la
   valeur, les achats, le Pokédex public.

## Laissé au constructeur

- La forme exacte des documents et des tables : comment une collection de série et ses cartes
  sont gardées (une entrée par carte de la série dès le départ, ou seulement les cartes ayant un
  statut, le reste lu dans le catalogue), comment la favorite est notée, la migration par étapes.
- Les formats des réponses du catalogue et des chemins neutres par langue (par exemple
  `/images/cards/fr/<SET>/<n>-md.webp`).
- Les gardes de l'ingestion française (reprises de la japonaise) et l'exclusion éventuelle de
  séries sans aucune carte française.
- Les tests à ajouter là où une erreur coûte : une carte comptée une fois (valeur, achats,
  budget), la règle « une carte par Pokémon » limitée au Pokédex dans la prochaine commande, la
  première carte favorite, « débloqué » par n'importe quelle carte possédée, la Reverse dans la
  même case, la suppression d'une série, la migration, l'import, le Pokédex public.
- Les détails d'interface, avec `@camply/ui` d'abord, et les docs de chaque domaine à tenir à jour.
