# PokéCodex

Un Pokédex personnel de cartes Pokémon japonaises et françaises, en ligne à https://pokecodex.fr :
pour chacun des 1 025 Pokémon, on ajoute les cartes que l'on veut (leur référence, d'où leur image
est retrouvée, et leur id Cardmarket pour suivre leur prix), dont une favorite que montre le
Pokédex ; le Pokémon se débloque dès qu'on en possède une. React + Vite + TypeScript, interface
[`@camply/ui`](https://www.npmjs.com/package/@camply/ui) ; espèces,
cartes, images et prix relus par l'API des données, un dépôt à part (plus bas).

```sh
bun install
bun dev          # Vite et le Worker du site, sur sa base D1 locale (migrée au démarrage)
bun run build    # type-check + build
bun lint         # ESLint, puis knip (code mort : exports, fichiers, dépendances)
bun run contracts # vérifie les types partagés avec ../pokedex-data (facultatif pour le build Docker)
bun test         # tests de ce qui coûterait de l'argent (chaque fichier de tests/ le dit en tête)
bun run test:worker # tests du Worker, dans le moteur de Cloudflare (worker/tests)
bun run db:generate # après une modification de worker/schema.ts : sa migration
bun run format   # Prettier
```

- **Accueil** : un tableau de bord (progression, avec celle de chaque collection d'extension,
  « À faire », valeur, budget du mois, liste d'achats, commandes, dernières cartes) ; trois étapes
  pour commencer quand la collection est vide.
- **Recherche** (Ctrl/⌘ K, ou le bouton de la barre) : un Pokémon par son nom ou son numéro, une
  page, une action.
- **Collections** : le Pokédex en première tuile, puis une tuile par extension que vous
  collectionnez en entier (drapeau, logo, nom, cartes possédées sur toutes, valeur) ; « Nouvelle
  collection » en commence une, japonaise ou française (l'interrupteur 🇯🇵 / 🇫🇷) : toutes ses
  cartes, Pokémon, dresseurs et énergies, à débloquer, celles déjà dans votre collection reprises
  telles quelles. Sa page : sa progression, sa valeur, le coût pour la compléter, toutes ses
  cartes (possédées en couleur), chacune avec son statut, son prix payé et son prix ; la supprimer
  garde les cartes possédées et commandées.
- **Pokédex** (depuis Collections) : les 1 025 espèces, recherche (nom fr/en/ja ou numéro,
  raccourci `/`), filtres partageables dans l'adresse.
- **Fiche** : toutes les cartes du Pokémon, choisies parmi ses cartes japonaises ou françaises (un
  interrupteur 🇯🇵 / 🇫🇷 ; image, rareté, prix du jour, tri par date ou par prix, filtres de rareté
  et de type) ou saisies à la main, chacune ajoutée sans en remplacer une autre, puis corrigée ou
  retirée ; sa favorite, celle que montre le Pokédex, marquée et changée d'un bouton (la première
  l'est d'office ; retirer la favorite demande de choisir la suivante) ; en grand, la carte
  choisie dans la liste, son statut (commandée / possédée) et son prix payé, son prix Cardmarket
  et sa courbe, le lien vers sa page Cardmarket, les détails de l'espèce. Le Pokémon est débloqué
  dès qu'une de ses cartes est possédée.
- **Catalogue** : un grand catalogue de toutes les cartes japonaises ou françaises (le même
  interrupteur 🇯🇵 / 🇫🇷, dans l'adresse), Pokémon, dresseurs et énergies, extension par extension
  (choisie sur son logo), en tuiles serrées, avec une recherche et des filtres de rareté et de
  type ; chaque carte a sa fiche (image en grand, numéro, rareté, type, Pokémon, illustrateur, versions, noms anglais et allemand, prix Cardmarket et sa
  courbe) et, pour une carte Pokémon, « Ajouter à la collection » (à acheter, sans remplacer les
  cartes que le Pokémon a déjà, ni changer sa favorite) ; « Commencer la collection » de
  l'extension montrée (ou « Voir ma collection »).
- **Valeur** : prix Cardmarket du jour, valeur de la collection (et gain par rapport au prix
  payé), commandes, dépensé en tout, coût pour compléter le Pokédex ; courbes jour par jour (valeur,
  Pokémon débloqués, dépenses) sur 7 jours, 30 jours, 1 an ou tout, avec leurs chiffres.
- **Achats** : liste d'achats (toutes les cartes voulues, ni possédées ni commandées),
  assistant « prochaine commande » dans un budget (100 € par mois, 150 € au plus, réglables),
  et « Copier pour Cardmarket » : ses cartes en lignes à coller dans votre liste de souhaits
  Cardmarket (« Ajouter une deck list »), en deux blocs, japonaises et françaises, chacune dans sa version exacte, avant son Shopping
  Wizard (langue et état se règlent ensuite par « Modification en masse » ; une carte dont la
  version ou l'extension n'est pas sûre s'ajoute depuis sa page ; le site n'envoie rien à
  Cardmarket) ; registre
  des commandes (Cardmarket, Myutsu, Hikaru…) qui met à jour les statuts, suivi du budget par mois
  et par fournisseur.
- **Comptes** : chacun crée le sien (`/inscription`), un pseudo et un mot de passe, sans e-mail
  (pas de mot de passe oublié) ; le pseudo, le mot de passe et la suppression du compte dans
  Réglages › Compte & partage › Mon compte.
- **Pokédex public** : celui de chaque compte, à son adresse (`/pseudo`, toujours public), en
  lecture seule : progression, régions, valeur au prix du jour, courbe, classeur, puis ses
  collections d'extensions. Jamais les prix payés, les commandes ni le budget. Le reste de
  l'interface demande d'être connecté.
- **Thème** : sombre (gris foncé et jaune) ou clair (blanc pastel et rouge), au bouton de la
  barre ; sans choix, celui du système.
- **Réglages** : trois groupes — compte et Pokédex public, sauvegarde (contenu, export et import,
  achats compris), puis actions avancées. L'état du serveur reste invisible quand tout va bien et
  n'apparaît qu'en cas de retard, d'échec ou d'indisponibilité.

Les données (espèces, catalogue des cartes japonaises et françaises, images, prix Cardmarket et
leur historique) viennent de **l'API des données**, un dépôt à part (`pokedex-data`) : privée, sans
token aucune donnée. Le navigateur ne parle qu'au site (`/api/…`, `/images/…`) : le Worker du site
renvoie les adresses des données à l'API, avec le token du site, que le navigateur
ne voit jamais. Aucune adresse de la source n'apparaît dans le navigateur :
les images ont des chemins neutres (`/images/cards/SV2A/166-md.webp`). Le Worker du site
(`worker/`, Hono, Drizzle et D1, sur Cloudflare Workers) garde les comptes et les collections, et
montre les Pokédex publics. Seule une image à l'adresse
collée se charge ailleurs ; pas celles de Cardmarket, qui ne s'affichent que sur son site.

**Les données et les images se lisent sans connexion** (décision de conception) : nginx pose le
token du site pour tout visiteur, connecté ou non. Les routes `/api/species`, `/api/catalog`,
`/api/prices`, `/api/histories`, `/api/wants`, `/api/status`, `/api/health` et `/images/…` répondent
donc à n'importe qui, limitées par visiteur (429 au-delà : `deploy/nginx.conf.template`) ; seule
l'interface demande d'être connecté. Ce que la connexion garde, ce sont les comptes et les
collections (`/api/collection`, `/api/auth/…`), pas le catalogue, les prix ni les scans.

En développement, deux terminaux : l'API des données (`bun run dev` dans `../pokedex-data`, sur
le port 3001 ; sa base et ses tâches : son README) et `bun dev` : Vite, avec le Worker du site
dans le moteur de Cloudflare (le plugin `@cloudflare/vite-plugin`), qui répond à `/api` et
joint lui-même l'API des données. Sa base D1 locale vit dans `.wrangler/` ; `bun dev` lui applique
d'abord les migrations qui manquent (`worker/migrations`). Il faut **Node 22 ou plus** (Wrangler),
et sur un Windows ARM64 **Node ARM64** (Bun reste le gestionnaire de paquets : le plugin ne tourne
pas sous Bun). Un fichier `.env` (ignoré par git), copié de `.env.example`, avec le token du
site, le même que dans `API_TOKENS` de l'API des données :

```sh
BETTER_AUTH_URL=http://localhost:5173
BETTER_AUTH_SECRET=…        # 32 caractères au moins, pour ce poste seulement
DATA_API_URL=http://127.0.0.1:3001
DATA_API_TOKEN=…            # le token « pokedex » de l'API des données
```

Un visiteur arrive sur la connexion ; `/inscription` crée un compte (pseudo, mot de passe). Pseudo
et mot de passe se changent ensuite dans Réglages › Compte & partage › Mon compte, où le compte
se supprime aussi.

Votre collection : le site ne s'ouvre que connecté ; elle n'est gardée que sur le serveur (rien
dans le navigateur, pas d'usage hors ligne) et vous suit d'un appareil à l'autre : un seul
connecté à la fois (se connecter ailleurs déconnecte le précédent). Chaque modification part
aussitôt ; si le serveur ne répond pas, le menu du compte le dit et elle repart à son retour.

## Déploiement (VPS + Caddy)

> **Périmé** : le site passera sur Cloudflare Workers, relié à GitHub, à la fin du développement.
> Ce qui suit décrit l'ancien VPS (Docker, nginx, Caddy), qui sera retiré ; il ne marche plus tel
> quel (l'ancien serveur, `server/`, n'existe plus).

### La liste de mise en ligne

- [ ] **Avant tout** : exporter sa collection depuis le site actuel (Réglages › Sauvegarde › Exporter).
- [ ] Sur le VPS : Docker, `git` et Caddy ; les ports 22, 80 et 443 autorisés par le pare-feu.
- [ ] L'API des données d'abord : le réseau `pokedex-net`, son clone, son `.env` (le token du
      site), ses conteneurs et ses cartes, japonaises et françaises (son README : plusieurs heures la
      première fois, les françaises comprises).
- [ ] Le clone en SSH, avec une clé de déploiement en lecture seule (étape 1 plus bas).
- [ ] Le fichier `.env` : l'adresse publique en https, la clé des sessions et le token de l'API des
      données (étape 2).
- [ ] L'adresse publique `contact@pokecodex.fr` reçoit bien les messages ; les coordonnées OVH sont
      dans `src/config/legal.ts`.
- [ ] `docker compose up -d --build`, puis Caddy vers `http://127.0.0.1:8080` (étape 3).
- [ ] Votre compte (`/inscription`), puis l'import de l'export d'avant (Réglages › Sauvegarde › Importer) :
      connecté, la collection part sur le serveur.
- [ ] Les secrets GitHub du déploiement, `VPS_FINGERPRINT` compris (plus bas).
- [ ] La surveillance : un service gratuit (UptimeRobot, Healthchecks…) qui demande
      `https://pokecodex.fr/api/health` toutes les 5 minutes et vous écrit s'il ne répond plus
      200 (voir plus bas).
- [ ] Sur téléphone, « Ajouter à l'écran d'accueil » : le site s'ouvre comme une application
      (il demande le réseau).

**La surveillance** : `/api/health` est celui de l'API des données (nginx le lui renvoie) : 200
quand chaque tâche à rythme a réussi récemment (les prix en 12 h, les espèces en 60 jours) et que le guide des prix n'est pas figé, 503 sinon, avec les tâches en
retard ; une erreur de nginx (502) si l'API ne répond plus. Sans surveillance, un trou dans
l'historique des prix passerait inaperçu : Cardmarket ne le garde pas, un jour manqué l'est pour
toujours.

**Le journal** : le Worker écrit une ligne par évènement, alignée, à l'heure de Paris : un symbole
de niveau (✔ réussi, • info, ▲ à surveiller, ✖ refusé, en couleur en développement), le thème, un
message court et ses détails en `clé=valeur` (pas les requêtes une à une : seulement ce qui se
passe). Il note les connexions
(réussies ou refusées, avec l'adresse du visiteur), création du compte, pseudo et mot de passe
changés, cartes ajoutées, possédées ou retirées, commandes enregistrées, reçues ou annulées, budget,
exports et imports, visites du Pokédex public, l'API des données muette, et les erreurs
du serveur (avec leur cause). Pour le
suivre : le terminal de `bun dev` ; en ligne, les journaux du Worker chez Cloudflare.

Les services (`pokedex` : le site, nginx, sur `127.0.0.1:8080`, joignable seulement par Caddy ;
`server` : les comptes et les collections) et leurs volumes :
`docs/deploiement.md`. Les tâches d'ingestion (de nouvelles cartes…) : le README de l'API des
données. Le cache des images de nginx est de 12 Go, avec 30 Mo de clés (`deploy/nginx.conf.template`) :
tous les scans, japonais et français, y tiennent ; l'API les a copiés d'avance, une image absente
est un 404 (le site montre la carte de substitution). Quand l'API des données change (les cartes
françaises), la déployer avant le site, et attendre qu'elle ait ses cartes : « Mettre à jour un VPS
en place », plus bas.

Ne jamais lancer `docker compose down -v`, qui effacerait les volumes (`db` : les comptes et les
collections, sans aucune sauvegarde).

**Le dossier du clone fixe le nom des volumes** : Compose les nomme d'après lui (`<dossier>_db` ;
`pokedex-data_data`, `pokedex-data_images`… pour l'API des données). Ne
jamais renommer un clone ni le refaire sous un autre nom : le nouveau dossier démarrerait, sans
aucune erreur, sur des volumes neufs et vides (plus de comptes, plus d'historique des prix) ; les
anciens resteraient là, sans emploi. `docker volume ls` montre ceux qu'utilise le clone.

**Une fois, sur le VPS**

1. Cloner le dépôt **en SSH**. Le dépôt est privé : ajouter au VPS une clé de
   déploiement en lecture seule, qui est une clé SSH. C'est la clé par défaut de l'utilisateur, ou
   celle déclarée pour `github.com` dans `~/.ssh/config`. Un clone HTTPS demanderait un jeton, et le
   `git pull` du déploiement automatique échouerait. Le dossier du clone, ici `pokedex`, nomme les
   volumes de Docker (plus haut) : il ne doit plus changer.
   ```sh
   git clone git@github.com:ADsglt77/pokedex.git
   cd pokedex
   ```
2. Créer, dans le clone, le fichier `.env` des secrets (ignoré par git ; sans lui, docker compose
   refuse de démarrer) : l'adresse publique du site, en https, la clé qui signe les sessions, et le
   token du site pour l'API des données (celui de son `API_TOKENS`, `pokedex:<token>`).
   ```sh
   echo "BETTER_AUTH_URL=https://pokecodex.fr" > .env
   echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .env
   echo "DATA_API_TOKEN=<le token du site>" >> .env
   chmod 600 .env
   docker compose up -d --build
   ```
3. Dans la zone DNS OVH, remplacer l'adresse de redirection par l'IPv4 du VPS : trois
   enregistrements `A`, pour `pokecodex.fr`, `www.pokecodex.fr` (Caddy le redirige) et
   `api.pokecodex.fr` (l'API des données pour ses autres clients, avec leur token : son README). Garder les enregistrements `MX` et SPF si la messagerie OVH est utilisée. Une fois
   le DNS propagé, installer le Caddyfile fourni et le recharger :
   ```sh
   sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
   sudo caddy validate --config /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   curl -I https://pokecodex.fr
   ```
   Caddy obtient et renouvelle le certificat TLS, redirige HTTP vers HTTPS et relaie le site vers
   `127.0.0.1:8080`. Ce port reste inaccessible depuis Internet.

   **Ce qu'engage ce Caddyfile** : le site envoie `Strict-Transport-Security` avec
   `includeSubDomains` pour un an (`deploy/security-headers.conf`, et sur la redirection de `www`
   dans le Caddyfile). Tout navigateur qui l'a reçu n'ouvre plus, pendant un an, aucun
   sous-domaine de `pokecodex.fr` en http : un futur `staging.` ou un service du domaine sans
   https lui serait inaccessible, et rien ne le lui fait oublier avant l'échéance. À savoir avant
   la mise en ligne. Le déploiement ne réinstalle jamais le Caddyfile : après un changement de
   `deploy/Caddyfile`, refaire à la main les commandes ci-dessus.
4. Créer votre compte : `/inscription` (pseudo, mot de passe), comme tout le monde. Gardez bien le
   mot de passe : le site n'envoie pas d'e-mail, il n'y a pas de « mot de passe oublié » ; il se
   change dans Réglages › Compte & partage › Mon compte, en donnant l'actuel.

**Ensuite, à chaque déploiement** (`.github/workflows/deploy.yml`, lancé à la main depuis l'onglet
Actions ; son en-tête dit comment le lancer à chaque push sur `main`) : GitHub se connecte au VPS
en SSH, fait `git pull` et lance `deploy/deploy.sh`. Le script vérifie d'abord que l'API des données
répond pour les cartes françaises (leur catalogue et un scan : en rouge sinon, l'ancien site reste
en ligne ; `SKIP_FRENCH_CHECK=1`, à la main sur le VPS, saute ce contrôle). La construction lance
ensuite `bun test`, `bun lint` et `nginx -t`, et rafraîchit les images de base ; si elle échoue,
test compris, l'ancienne version reste en ligne. Une fois les conteneurs redémarrés, le script
vérifie que le site et son API répondent, en local puis à https://pokecodex.fr, à travers Caddy
(`curl --resolve` : le nom est joint sur le VPS même, sans dépendre de son adresse publique ; en
rouge sinon). À chaque push et chaque pull request, `.github/workflows/test.yml` donne le même
signal que la construction (tests, lint, `tsc`, build), sans secret ni accès au VPS : l'échec se
voit avant de lancer un déploiement, et non après le `git pull`. Secrets à créer dans le dépôt
(Settings › Secrets and variables › Actions) :

| Secret | Valeur |
|---|---|
| `VPS_HOST` | adresse du VPS |
| `VPS_USER` | utilisateur SSH, membre du groupe `docker` |
| `VPS_SSH_KEY` | clé privée propre au déploiement de ce dépôt, **jamais celle de l'API des données** (sa clé publique dans `~/.ssh/authorized_keys` du VPS, avec sa commande imposée : plus bas) |
| `VPS_PATH` | dossier du clone, par exemple `/home/moi/pokedex` |
| `VPS_PORT` | port SSH, seulement s'il n'est pas 22 |
| `VPS_FINGERPRINT` | empreinte de la clé d'hôte du VPS, pour ne parler qu'à lui : la sortie de `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub \| cut -d ' ' -f2` (`SHA256:…`). Obligatoire : sans elle, le déploiement s'arrête |

Le port SSH doit être joignable depuis GitHub pour que ce workflow puisse se connecter.

La clé de déploiement donne un shell à un membre du groupe `docker`, autant dire l'administration
du VPS : **une clé par dépôt**, chacune réservée à son déploiement dans `~/.ssh/authorized_keys`
par une commande imposée en tête de sa ligne. SSH lance alors cette commande-là, quoi que demande
le workflow : la clé du site ne déploie que le site, celle de l'API des données (son README, sa
propre ligne) que l'API. Les deux dépôts ne partagent donc jamais `VPS_SSH_KEY` : une clé commune
n'aurait qu'une commande, et déploierait l'un avec le secret de l'autre. Une clé à part, tirée hors
du VPS :

```sh
ssh-keygen -t ed25519 -N '' -C deploy-pokedex -f deploy-pokedex
# deploy-pokedex : le secret VPS_SSH_KEY de ce dépôt (puis effacer le fichier)
# deploy-pokedex.pub : sa ligne dans ~/.ssh/authorized_keys du VPS, précédée de sa commande
```

Sa ligne (la même commande que le workflow, le dossier du clone à adapter), à côté de celle de
l'API des données :

```
restrict,command="cd /home/moi/pokedex && git pull --ff-only && sh deploy/deploy.sh" ssh-ed25519 AAAA… deploy-pokedex
```

Protégez aussi le workflow par un « Environment » GitHub avec un relecteur obligatoire.

**Revenir à la version d'avant** (un déploiement en rouge, une erreur vue après coup) : les images
d'avant et leur cache de construction restent une semaine (`deploy/deploy.sh`), la reconstruction
est donc rapide.

```sh
git log --oneline -5
git checkout <commit d'avant>
docker compose build && docker compose up -d
```

Puis, une fois `main` corrigé : `git checkout main` et un nouveau déploiement.

**Un retour du code seul n'est plus sûr dès que des comptes ont enregistré avec la version
d'après** (sa collection d'extension, une favorite…) : le document a un nouveau format. Le code
d'avant refuse (400, « Envoi refusé » au journal) l'envoi d'un compte qui a, dans une collection
d'extension, une case de dresseur ou d'énergie (il exige un Pokémon à chaque carte), et il jette
sans rien dire les favorites et les collections d'extension au premier envoi qu'il accepte. Sans
copie de la base (aucune sauvegarde), une seule voie : corriger en avant (un correctif déployé).

Après un retour du code, **exportez, puis rechargez les onglets
ouverts** : un onglet resté sur le code d'après ne sait plus enregistrer contre le serveur d'avant.
Sa lecture ne dit plus à quel compte est la collection (il affiche « Reconnectez-vous »), et son
envoi compressé est refusé (400). Avant de recharger, « Exporter ma collection » (Réglages ›
Sauvegarde), dans un onglet qui a des modifications pas encore enregistrées.

## Mettre à jour un VPS en place (la livraison d'octobre 2026)

Elle porte trois livraisons, à passer dans cet ordre, chacune finie avant la suivante : l'API des
données (le catalogue et les images français, étapes 16 et 17 de son schéma), le site (les
collections d'extension, et le nouveau format de document) et la configuration du VPS (Caddyfile,
anciennes sauvegardes retirées). Aucune copie des bases n'est faite avant : ni les étapes du schéma
de l'API (16 et 17), ni le nouveau format de document du site ne se défont. Une fois passée, cette
section se retire.

1. **Aucun compte ne doit s'appeler « collections »**, pseudo réservé à la page Collections : un
   compte qui le porte déjà perdrait son Pokédex public (404). Lecture seule, sur le VPS, dans le
   clone du site :
   ```sh
   docker compose exec server bun -e 'console.log(JSON.stringify(new (require("bun:sqlite").Database)("/data/app.db", { readonly: true }).query("select username from user where lower(username) = ?").all("collections")))'
   ```
   `[]` : rien à faire. `[{"username":"collections"}]` : ce compte change de pseudo (Réglages ›
   Compte & partage › Mon compte) avant la livraison du site. **Une sortie vide n'est pas `[]`** :
   `bun -e` avale les erreurs de SQLite (serveur arrêté, base introuvable) sans code d'échec ; il
   faut alors corriger (`docker compose ps`) et relancer la commande, jusqu'à lire `[]` ou une ligne.
2. **Déployer l'API des données** (le workflow de son dépôt), puis lancer `cards` dans un conteneur
   ponctuel, comme le dit son README. Entre les deux déploiements, l'ancien site continue de
   tourner : ses routes japonaises sont inchangées, seule la copie d'images à la demande a disparu
   (une image absente du volume répond 404).
3. **Attendre la fin des étapes `catalog` et `images` de `cards`, avant le site.** Sans elles, le
   site montrerait « Catalogue indisponible » et des pochettes de substitution pour tout le
   français. Le journal le dit :
   ```sh
   docker logs pokedex-data-cards 2>&1 | grep -aE '\[[0-9]/3\]|Terminée|Échec|ignorée'
   ```
   Prêt quand `[3/3] Historique des prix` suit deux `✓ Terminée en …` (un `✗ Échec` ou un
   `✗ Étape ignorée` : relancer `cards`, qui ne refait que ce qui manque, comme son README). Le
   motif n'est pas ancré : avec un terminal (`docker compose run -d` en SSH en alloue souvent un), le
   journal colore les titres d'étape. L'historique, 21 heures de plus,
   n'est pas un préalable : il continue pendant le déploiement du site. Garde-fou, pas preuve :
   `deploy/deploy.sh` échoue en rouge, avant de toucher au site (l'ancien reste en ligne), si
   `/api/catalog/fr/sets` ou le scan d'une carte de la série française la plus récente qui en a un
   ne répondent pas (ou si le catalogue ne note aucune image française). Pour passer outre, à la
   main sur le VPS (la clé restreinte du workflow ne reçoit aucune variable) :
   `SKIP_FRENCH_CHECK=1 sh deploy/deploy.sh`.
4. **Déployer le site** (le workflow de ce dépôt).
5. **Retirer les anciennes sauvegardes**, si elles ont été installées : section « Sauvegardes :
   aucune » (et celle du README de l'API des données).
6. **Réinstaller le Caddyfile** (les commandes de l'étape 3 de « Une fois, sur le VPS ») : le
   déploiement ne le copie jamais, le VPS garde l'ancien (sans le HSTS de `www`) tant qu'on ne le
   fait pas. Lire d'abord ce qu'engage `includeSubDomains` (même étape).
7. **Surveiller**, les jours qui suivent : `docker compose logs -f server` (aucune erreur
   `Envoi refusé` en rafale), `https://pokecodex.fr/api/health` à 200, `/collections` ouverte
   sur un compte qui a une collection d'extension, la fin de `cards` (son code de sortie à `0`,
   puis `docker rm pokedex-data-cards` : son README).

## Sauvegardes : aucune

Plus aucune sauvegarde côté serveur (octobre 2026, décision de l'utilisateur) : ni copie
quotidienne d'`app.db`, ni copie hors du VPS, ni versions remplacées des collections (une étape
du schéma retire leur table), ni procédure de restauration. Une panne du disque du VPS, une base
abîmée ou un `docker compose down -v` perdent pour toujours les comptes et les collections. Seul
l'export de chacun (Réglages › Sauvegarde › Exporter) en garde une copie, chez lui.

Sur un VPS installé avec l'ancien système, une fois ce code déployé, ce qui en reste ne se retire
qu'à la main : la ligne de la crontab qui copiait les sauvegardes (`crontab -e` : celle qui finit
par `rclone … distant:pokedex-sauvegardes`), le dossier `sauvegardes` du clone, une copie faite à
la main avant une livraison (`~/avant-collections.db`) et le volume des copies, que Compose ne
supprime jamais seul (son nom vient du dossier du clone : `docker volume ls`). Les copies déjà
envoyées sur le stockage distant y restent jusqu'à ce qu'on les supprime
(`rclone purge distant:pokedex-sauvegardes`).

```sh
rm -rf sauvegardes ~/avant-collections.db
docker volume rm pokedex_backups
```
