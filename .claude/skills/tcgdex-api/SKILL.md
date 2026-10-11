---
name: tcgdex-api
description: Reference for the TCGdex Pokémon TCG API (REST + GraphQL, filters, pagination, image URLs, languages, known data quirks) and how this Pokédex app uses it. Use whenever writing or debugging code that fetches cards, sets, series or images from api.tcgdex.net / assets.tcgdex.net, or when reasoning about card rarities, dexId matching or Japanese (ja) card data.
---

# TCGdex API

Open-source Pokémon TCG database. No API key, no auth, GET-only for REST, JSON responses, HTTPS only.
Docs: https://tcgdex.dev — REST: https://tcgdex.dev/rest — GraphQL: https://tcgdex.dev/graphql

## Base URLs

| What | URL |
|---|---|
| REST | `https://api.tcgdex.net/v2/{lang}/...` |
| GraphQL | `POST https://api.tcgdex.net/v2/graphql` with body `{"query": "..."}` (language via `@locale(lang: "ja")`) |
| Assets | `https://assets.tcgdex.net/{lang}/{serie}/{set}/{localId}` |

Languages (all respond 200): `en fr es es-mx it pt pt-br de nl pl ru ja ko zh-tw zh-cn id th`.
**This app queries `ja` (Japanese cards).** Card/set names come back in Japanese; rarity labels stay in English (`"Illustration rare"`, `"Special illustration rare"`…).

## REST endpoints

| Endpoint | Returns |
|---|---|
| `/cards` | `CardBrief[]` → `{ id, localId, name, image? }` |
| `/cards/{cardId}` | full `Card` (e.g. `/ja/cards/SV6a-065`) |
| `/sets` | `SetBrief[]` → `{ id, name, logo?, symbol?, cardCount: { total, official } }` |
| `/sets/{setId}` | full `Set` incl. `serie`, `releaseDate`, `cardCount`, `cards: CardBrief[]` (Trainers/Energy included) |
| `/sets/{setId}/{localId}` | full `Card` by set + number |
| `/series`, `/series/{serieId}` | series briefs / full serie with its sets |
| `/rarities`, `/rarities/{name}` | list of labels / `{ name, cards: CardBrief[] }` |
| `/types`, `/categories`, `/stages`, `/hp`, `/illustrators`, `/regulation-marks`, `/suffixes`, `/variants`, `/energy-types`, `/trainer-types`, `/dex-ids` | value lists (and `/{endpoint}/{value}` → cards) |

Full `Card` (Pokémon) main fields: `id, localId, name, image, category ("Pokemon"|"Trainer"|"Energy"), illustrator, rarity, set { id, name, logo, symbol, cardCount }, dexId: number[], hp, types[], evolveFrom, stage, attacks[], weaknesses[], retreat, regulationMark, variants{…}, legal{standard, expanded}, pricing{cardmarket, tcgplayer}, updated`.

## Filtering / sorting / pagination (REST query string)

| Syntax | Meaning |
|---|---|
| `name=pika` / `name=like:pika` | case-insensitive contains (default). `name=pika*` starts with, `name=*chu` ends with |
| `name=not:pika` | does not contain |
| `name=eq:Pikachu` | exact, **case-sensitive** |
| `name=neq:Pikachu` | not exactly |
| `hp=gt:50` `gte:` `lt:` `lte:` | numeric comparisons |
| `rarity=null:` / `rarity=notnull:` | has no value / has a value (trailing `:` required) |
| `name=eq:Furret\|Pikachu` | OR (some fields only) |
| `sort:field=name&sort:order=DESC` | default sort `releaseDate > localId > id`, ASC |
| `pagination:page=2&pagination:itemsPerPage=50` | no pagination unless asked (default 100/page when page is set) |

Example: `GET https://api.tcgdex.net/v2/ja/cards?dexId=eq:25&category=eq:Pokemon`

## GraphQL

```graphql
query {
  cards(filters: { dexId: 25 }, pagination: { page: 1, itemsPerPage: 1000 }) @locale(lang: "ja") {
    id localId name illustrator image dexId category set { id name }
  }
  rarities: cards(filters: { dexId: 25 }) @locale(lang: "ja") { id rarity }
}
```

- GraphQL `dexId` filter is an **exact** match. Fetch only the fields you need (much lighter than REST full cards).
- Max ~1000 items per page; paginate for full crawls.

## Image URLs

`card.image` is a **base URL without extension** (or `null`/absent when TCGdex has no scan — common for Japanese cards).
Build: `${image}/{quality}.{ext}` → quality `low` (245×337) | `high` (600×825); ext `webp` (recommended) | `png` | `jpg`.

```ts
export const cardImage = (base: string, quality: 'low' | 'high' = 'low') => `${base}/${quality}.webp`
```

Set assets: `${set.logo}.webp`, `${set.symbol}.webp`.

## Known quirks (important)

1. **`dexId` REST filter needs `eq:`** — `dexId=25` is a "contains" match and also returns 251, 252, 725…; use `dexId=eq:25`, and still filter client-side with `card.dexId.includes(25)`.
2. **GraphQL `rarity` is declared non-null but ~5 % of `ja` cards have none** → requesting it in the main selection turns those cards into `null` entries. Request rarity in a separate aliased selection (`rarities: cards(...) { id rarity }`) and join by `id`.
3. Rarity can be `"None"`, empty, or missing → treat all as "no rarity".
4. Multi-species cards (TAG TEAM) have several `dexId` values.
5. Some cards are filed under the wrong species upstream; this app keeps a small correction table (`S6K-017`, `S6K-072` → 883, `SV-P-132` → 569).
6. Japanese secret cards (numbered above `cardCount.official`) often lack a rarity; the build deduces their class (`deduced: true` in the static card index).
7. **`image: null` does not mean there is no image.** Many `ja` cards (whole sets like M4, M1S, SV5M, SV8, SV10) have their scan on the CDN at `https://assets.tcgdex.net/ja/<serieId>/<setId>/<localId>` although the API omits it. `bun run data:cards` probes that URL (HEAD on `low.webp`) and keeps it only when it answers 200. Don't probe from the browser: the CDN sends `Access-Control-Allow-Origin` on 200 only, so every 404 becomes a CORS error in the console. GraphQL `set { serie { id } }` fails on `ja` (serie declared non-null but null); get the serie from REST `/sets/{id}`.

## How this app uses it

- **Static index (build time):** `bun run data:cards` (`scripts/cards.ts`) crawls every `ja` Pokémon card through GraphQL (two-selection trick), deduces the class of secret cards for the sets of `SECRET_CARD_RULES` (`scripts/lib/deduceSecrets.ts`), keeps the classified ones (SAR/AR/CSR/CHR/BWR/SSR/UR/HR/SR/SEC) and writes `src/data/card-index.json` → the grid renders without any network call. Responses are cached in `scripts/.cache`; `--refresh` refetches.
- **No runtime calls:** the browser never queries TCGdex; cards released after the index was built appear once `bun run data:cards` is rerun.
- **Cardmarket link:** REST `GET /v2/ja/cards/{id}` has `pricing.cardmarket` (EUR prices + `idProduct`); GraphQL has no `pricing` field. `data:cards` stores `idProduct` as `cardmarket` in the index; `scripts/prices.ts` then reads Cardmarket's public daily price guide (`downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json`, keyed by `idProduct`).
- Reading and classification live in the scripts (`scripts/lib/tcgdex.ts`, corrections in `scripts/lib/rules.ts`): each index row already carries its class code. The app only maps labels/codes to classes (`src/lib/rarity.ts`) and image bases to URLs (`src/lib/images.ts`).
- **Missing images fallback:** cards still without image after probing the TCGdex CDN get the TCGplayer catalogue image (category 85 « Pokemon Japan », via tcgcsv.com daily export, matched by set abbreviation + number, variants `(… Pattern)` skipped, TCGdex `SM3p` = TCGplayer `SM3+`). The index stores the base `https://tcgplayer-cdn.tcgplayer.com/product/<productId>`; `cardImage()` turns it into `_in_1000x1000.jpg` (320 × 454). tcgcsv requires a custom User-Agent and ≤ 1 sync/day.
- Prefer plain `fetch` + small typed helpers over the `@tcgdex/sdk` package (keeps the bundle and the abstraction small). Handle `image == null`.
