# CLAUDE.md

Pokédex personnel de cartes Pokémon **japonaises et françaises** : pour chacun des 1 025 Pokémon,
les cartes que l'utilisateur choisit, dont une favorite que montre le Pokédex (catalogue ou saisie :
référence → image, id Cardmarket → prix). Un Pokémon est « débloqué » dès qu'une de ses cartes est
possédée. S'y ajoutent des **collections d'extensions** entières, une case par carte
(`lib/series.ts`). Comptes pseudo + mot de passe, sans e-mail ; sans connexion : la connexion et le
Pokédex public de chaque compte (`/pseudo`).

- **Site** (ce dépôt) : React 19, Vite, TS, `@camply/ui`, zustand, react-router. **Rien dans le
  navigateur** sauf le thème, pas de hors-ligne. En ligne sur **Cloudflare Workers** depuis le
  29 octobre 2026 (https://pokecodex.fr). `worker/` (Hono, Drizzle, D1, Better Auth) : le Worker
  du site (`pokedex`), qui garde comptes et collections, montre les Pokédex publics, pose les
  en-têtes (`worker/headers.ts`) et limite chaque visiteur (`worker/limits.ts`). Workers Builds
  le déploie à chaque push sur `main` (`docs/deploiement.md`).
- **API des données** (`../pokedex-data`, un Worker elle aussi, privée) : espèces, catalogue,
  images, prix Cardmarket. Le Worker du site la joint par sa liaison de service (`DATA`,
  `worker/data.ts`), sans token ; le navigateur ne voit que `/api/…` et `/images/…` du site.

## Commandes

Bun pour les paquets (pas npm/pnpm/yarn) ; Vite, Wrangler et Vitest tournent sous Node (≥ 22,
ARM64 sur ce poste : le plugin Cloudflare ne tourne pas sous Bun). `bun dev` (Vite et le Worker,
sa base D1 locale migrée d'abord), et `bun run dev` dans `../pokedex-data` (son Worker, que ses
propres tâches remplissent, `bun run ingest setup` la première fois : README). `bun run build` (pas `bun build`). Schéma du Worker changé
(`worker/schema.ts`) : `bun run db:generate`. Après chaque changement : `bun lint` (ESLint +
knip), `bun test`, `bun run test:worker`, `bun run format`. `bun run ci` : ce que lance la
construction de Cloudflare avant de déployer (`lint:ci`, `knip.ci.json` : sans `../pokedex-data`).
Quand un type partagé avec l'API change : `bun run contracts` (exige `../pokedex-data`).

## Règles

- **Simple** : pas d'abstraction « au cas où », pas de vérification défensive. On ne contrôle que
  l'extérieur : fichier importé et document reçu (`lib/transfer.ts`), adresse (`lib/filters.ts`),
  saisies. Factoriser dès deux usages.
- **Tests** (`tests/` et `worker/tests`, un échec bloque le déploiement) seulement où une erreur
  coûte : argent, règles de la collection, garde du serveur, Pokédex public, schéma ; l'en-tête de
  chaque fichier dit ce qu'il couvre. Pas de tests d'interface.
- **L'utilisateur choisit les cartes** : aucune détection, sélection ni classement automatique,
  seulement les aides demandées (`docs/cartes.md`). Cartes japonaises et françaises seulement,
  **Pokécardex** seule source. Ne rien réintroduire sans demande.
- **Anonyme** : l'app ne cite aucune source ; rien de ce que voit le navigateur ne la nomme
  (images hébergées chez nous, chemins neutres `/images/cards/SV2A/166-md.webp`, token jamais
  côté navigateur).
- **Sources** : lire un nouveau site ou contourner une protection, **toujours demander d'abord** ;
  jamais de CAPTCHA ni de défi anti-robot. Toutes les lectures sont dans l'API des données.
- **Cardmarket** : fichiers publics seulement ; ni scraping, ni API, ni panier, ni ses images. Un
  seul lien construit (`cardmarketPage`). Liste de souhaits : des lignes que l'utilisateur copie et
  colle lui-même ; pas de CSV.
- **UI** : `@camply/ui` d'abord (skill `camply-ui`) ; couleurs seulement dans `styles/theme.css`.
- Pas d'image téléversée (on colle une adresse), pas de fusion à l'import.
- **Aucune sauvegarde** côté serveur (décision de l'utilisateur, octobre 2026) : ni copie de la
  base, ni versions remplacées des collections ; seul l'historique de 30 jours que Cloudflare
  garde de lui-même (D1 Time Travel). Ne pas en réintroduire sans demande ; l'export (Réglages ›
  Sauvegarde) reste à l'utilisateur.
- Textes en français, vouvoiement ; sans carte possédée, un Pokémon est « à débloquer ».

## Structure

`src/lib/` : règles **pures**, un domaine par module (son en-tête le décrit), certaines importées
par `worker/`. `worker/schema.ts` : le schéma D1 (Drizzle), ses migrations dans
`worker/migrations` (générées ; les déclencheurs écrits à la main) ; `worker/tests` : dans le
moteur de Cloudflare.

**Lire la page du domaine avant d'y toucher, et la tenir à jour** :
[cartes, catalogue, images](docs/cartes.md) · [prix, historique, état des données](docs/prix.md) ·
[collection, achats, budget](docs/collection-et-achats.md) ·
[compte, serveur, Pokédex public](docs/compte-et-synchronisation.md) ·
[interface, filtres, performance](docs/interface.md) ·
[mise en ligne, Cloudflare](docs/deploiement.md).

Windows : après une modification de `vite.config.ts` ou de `wrangler.jsonc`, relancer `bun dev` ;
deux écritures rapprochées d'un fichier peuvent lui échapper (page blanche : réenregistrer).
