/**
 * Les données de référence, publiques, que remplissent les tâches d'ingestion (`ingest.ts`) :
 * - `GET /api/status` : la dernière réussite et le dernier passage de chaque tâche, et le jour des
 *   prix en base (la page Données le montre) ;
 * - `GET /api/health` : pour une surveillance (UptimeRobot…), 200 si chaque tâche nécessaire a
 *   réussi récemment (deux intervalles au plus, `isOverdue`), 503 sinon, avec les tâches en retard ;
 * - `GET /api/species`, `/api/species/details` : les espèces, et ce qu'en montre la fiche ;
 * - `GET /api/catalog/species/:id` : les cartes Pokémon japonaises d'un Pokémon (la fenêtre
 *   d'ajout) ; `GET /api/catalog/sets` : les séries du catalogue ; `GET /api/catalog/sets/:id` :
 *   toutes les cartes d'une série, dresseurs et énergies compris (la page Catalogue) ;
 * - `GET /api/prices/collection?ids=…` et `GET /api/prices/selection?ids=…` : les prix Cardmarket
 *   du jour des cartes demandées, dans la forme de `readPrices` (deux chemins pour la même réponse :
 *   le service worker garde une copie par chemin, celle de la collection n'est pas remplacée par
 *   celle d'une extension du catalogue) ; `GET /api/prices/:id` : l'historique d'une carte
 *   Cardmarket, par son id produit (la fiche) ;
 * - `GET /api/histories?ids=719621,719654` : l'historique de chaque carte Cardmarket demandée,
 *   `null` sans historique, en une demande (la courbe de la valeur de la collection, page Valeur) ;
 *   ces trois-là ont un ETag tiré du passage de la tâche `prices` (`pricesTag`) : un 304 tant que
 *   les prix n'ont pas changé ;
 * - `GET /api/wants?ids=719621,719654` : la ligne de chaque carte Cardmarket demandée pour la liste
 *   de souhaits Cardmarket (`wantsLine`), `null` sans ligne sûre ; calculée à chaque demande, chaque
 *   id et chaque extension une fois.
 * Les grosses réponses sont servies telles que calculées en fin de tâche (`snapshots.ts`).
 */

import type { Database } from 'bun:sqlite'
import { Elysia, t } from 'elysia'
import { INGEST_JOB_NAMES, INGEST_JOBS } from '@/config/jobs'
import { TOTAL_SPECIES } from '@/config/pokedex'
import { wantsLine, type ExpansionName } from '@/lib/cardmarket'
import { isOverdue } from '@/lib/jobs'
import type { JobStatus, PriceHistories, ServerStatus, WantsLines } from '@/types'
import { readSource } from './db'
import { historyReader } from './history'
import { readPrices } from './jobs/prices'
import { notFound, serveSnapshot, serveTagged } from './snapshots'

/**
 * Des ids Cardmarket séparés par des virgules : `max` au plus, de 1 à 9 chiffres chacun, sans zéro
 * devant (un id n'a qu'une écriture : sa clé dans la réponse).
 */
const idsPattern = (max: number) => `^[1-9]\\d{0,8}(,[1-9]\\d{0,8}){0,${max - 1}}$`

/** La réponse de chaque id demandé, une clé par id : chacun n'est lu qu'une fois, même répété. */
const eachId = <T>(ids: string, read: (id: number) => T) =>
  Object.fromEntries([...new Set(ids.split(','))].map((id) => [id, read(Number(id))]))

export function referenceRoutes(data: Database) {
  const runs = data.query(
    `SELECT job, MAX(CASE WHEN ok = 1 THEN finished_at END) AS lastSuccess,
            MAX(finished_at) AS lastRun
     FROM runs GROUP BY job`,
  )
  const readHistory = historyReader(data)
  // Ce que demande `wantsLine` : le produit (sans extension, absent de la liste des produits de
  // Cardmarket : pas de ligne) ; le numéro imprimé de chaque produit de la même carte dans son
  // extension, lui compris, d'après le catalogue (`null` : absent du catalogue, ou plusieurs
  // numéros) ; les noms des séries du catalogue de son extension, chacun avec le nombre
  // d'extensions dont des cartes du catalogue portent ce nom (calculé une fois par nom : `GROUP BY`).
  const product = data.query(
    `SELECT name, expansion, metacard FROM cardmarket_products
     WHERE id = ? AND expansion IS NOT NULL`,
  )
  const sameCard = data.query(
    `SELECT products.id,
            CASE WHEN COUNT(DISTINCT cards.number) = 1 THEN MIN(cards.number) END AS number
     FROM cardmarket_products AS products LEFT JOIN cards ON cards.cardmarket = products.id
     WHERE products.expansion = ? AND products.metacard = ?
     GROUP BY products.id`,
  )
  const expansionNames = data.query(
    `SELECT sets.name,
            (SELECT COUNT(DISTINCT others.expansion) FROM cards AS shared
             JOIN cardmarket_products AS others ON others.id = shared.cardmarket
             -- Les séries de ce nom d'abord, puis leurs cartes (index cards_by_set).
             WHERE shared.set_id IN (SELECT id FROM sets AS same
                                     WHERE TRIM(same.name) = TRIM(sets.name))) AS expansions
     FROM cardmarket_products AS products
     JOIN cards ON cards.cardmarket = products.id
     JOIN sets ON sets.id = cards.set_id
     WHERE products.expansion = ?
     GROUP BY sets.name`,
  )
  /**
   * La ligne d'un produit Cardmarket pour la liste de souhaits ; `null` sans ligne sûre. `known` :
   * les noms de chaque extension déjà lus pour cette demande (la même extension revient souvent).
   */
  function wantsLineOf(id: number, known: Map<number, ExpansionName[]>) {
    const row = product.get(id) as { name: string; expansion: number; metacard: number } | null
    if (!row) return null
    const group = sameCard.all(row.expansion, row.metacard) as {
      id: number
      number: string | null
    }[]
    const names = known.get(row.expansion) ?? (expansionNames.all(row.expansion) as ExpansionName[])
    known.set(row.expansion, names)
    return wantsLine(
      { name: row.name, number: group.find((other) => other.id === id)!.number },
      group.map(({ number }) => number),
      names,
    )
  }
  /**
   * Ce dont dépend une réponse tirée des prix (`what` : ce qui est demandé), d'où son ETag : elle ne
   * change qu'avec eux, et la tâche `prices` note son passage (`sources`) dans la même transaction
   * que les prix et l'historique ; `null` tant que les prix n'ont jamais été lus.
   */
  function pricesTag(what: string) {
    const source = readSource(data, 'cardmarket')
    return source && `${source.stamp}|${source.date}|${what}`
  }
  /** Les prix du jour des cartes `ids`, avec leur ETag. */
  function pricesOf({ query, request }: { query: { ids: string }; request: Request }) {
    const ids = [...new Set(query.ids.split(','))]
    const tag = pricesTag(`prices:${ids.join()}`)
    return tag ? serveTagged(request, tag, () => readPrices(data, ids.map(Number))) : notFound()
  }
  /** Une réponse calculée en fin de tâche. */
  const snapshot =
    (name: string) =>
    ({ request }: { request: Request }) =>
      serveSnapshot(data, name, request)
  /** Sa description dans la documentation de l'API. */
  const doc = (summary: string) => ({ detail: { summary, tags: ['Référence'] } })

  return new Elysia({ name: 'reference' })
    .get(
      '/status',
      ({ set }): ServerStatus => {
        set.headers['cache-control'] = 'no-cache'
        const rows = runs.all() as ({ job: string } & JobStatus)[]
        return {
          jobs: Object.fromEntries(rows.map(({ job, ...times }) => [job, times])),
          pricesDate: readSource(data, 'cardmarket')?.date ?? null,
        }
      },
      doc('Les tâches d’ingestion'),
    )
    .get(
      '/health',
      ({ set }) => {
        set.headers['cache-control'] = 'no-store'
        const rows = runs.all() as ({ job: string } & JobStatus)[]
        const successes = new Map(rows.map(({ job, lastSuccess }) => [job, lastSuccess]))
        const now = Date.now()
        // Les images sont facultatives : le serveur copie à la demande celles affichées.
        const late = INGEST_JOB_NAMES.filter(
          (job) => !INGEST_JOBS[job].optional && isOverdue(job, successes.get(job) ?? null, now),
        )
        if (late.length > 0) set.status = 503
        return { ok: late.length === 0, late }
      },
      doc('Pour une surveillance : 503 si une tâche nécessaire est en retard'),
    )
    .get('/species', snapshot('species'), doc('Les espèces : noms, types, génération'))
    .get(
      '/species/details',
      snapshot('species-details'),
      doc('Les détails des espèces : catégorie, description, taille…'),
    )
    .get(
      '/catalog/species/:id',
      ({ params, request }) => serveSnapshot(data, `catalog/species/${params.id}`, request),
      {
        params: t.Object({ id: t.Integer({ minimum: 1, maximum: TOTAL_SPECIES }) }),
        ...doc('Les cartes japonaises d’un Pokémon'),
      },
    )
    .get('/catalog/sets', snapshot('catalog/sets'), doc('Les séries du catalogue'))
    .get(
      '/catalog/sets/:id',
      ({ params, request }) => serveSnapshot(data, `catalog/sets/${params.id}`, request),
      {
        // Un code de série chez Pokécardex : « SV2A », « S8A-G ».
        params: t.Object({ id: t.String({ pattern: '^[A-Za-z0-9_-]{1,32}$' }) }),
        ...doc('Toutes les cartes d’une série du catalogue'),
      },
    )
    .get('/prices/collection', pricesOf, {
      // Une carte par Pokémon au plus.
      query: t.Object({ ids: t.String({ pattern: idsPattern(TOTAL_SPECIES) }) }),
      ...doc('Les prix du jour des cartes de la collection'),
    })
    .get('/prices/selection', pricesOf, {
      // Une extension du catalogue, les cartes d'un Pokémon : moins d'un millier.
      query: t.Object({ ids: t.String({ pattern: idsPattern(TOTAL_SPECIES) }) }),
      ...doc('Les prix du jour de quelques cartes'),
    })
    .get(
      '/prices/:id',
      ({ params, request }) => {
        // Pas de 404 retenu : la carte peut avoir un prix au prochain passage.
        const tag = pricesTag(`history:${params.id}`)
        return tag ? serveTagged(request, tag, () => readHistory(params.id)) : notFound()
      },
      {
        params: t.Object({ id: t.Integer({ minimum: 1, maximum: 999_999_999 }) }),
        ...doc('L’historique des prix d’une carte Cardmarket'),
      },
    )
    .get(
      '/histories',
      ({ query, request }) => {
        const tag = pricesTag(`histories:${query.ids}`)
        return tag
          ? serveTagged(request, tag, (): PriceHistories => eachId(query.ids, readHistory))
          : notFound()
      },
      {
        // Les historiques d'une collection : une carte par Pokémon au plus.
        query: t.Object({ ids: t.String({ pattern: idsPattern(TOTAL_SPECIES) }) }),
        ...doc('Les historiques des prix de plusieurs cartes Cardmarket'),
      },
    )
    .get(
      '/wants',
      ({ query, set }): WantsLines => {
        // Sans cache : les produits et le catalogue changent avec les tâches.
        set.headers['cache-control'] = 'no-cache'
        // Chaque id une fois, chaque extension lue une fois : une demande coûte au plus un passage
        // sur les produits demandés, même répétés.
        const known = new Map<number, ExpansionName[]>()
        return eachId(query.ids, (id) => wantsLineOf(id, known))
      },
      {
        query: t.Object({ ids: t.String({ pattern: idsPattern(2000) }) }),
        ...doc('Les lignes de cartes Cardmarket pour une liste de souhaits Cardmarket'),
      },
    )
}
