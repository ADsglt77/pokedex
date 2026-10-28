/**
 * `/api/collection` : la collection et les achats du compte, gardés par le Worker seul
 * (`src/store/account.ts`). Un seul document, numéroté (`version`) :
 * - `GET` : `{ version, account, collection, shopping }` (`CollectionResponse`, `account` : l'id
 *   du compte ; `version` 0 et rien d'autre tant que rien n'a été enregistré) ; demandé depuis la
 *   version que l'appareil a déjà (`?version=N`) et inchangé, `{ version, account }` seuls ;
 * - `PUT` `{ account, baseVersion, collection, shopping }` : enregistré seulement si `account` est
 *   le compte de la session (sinon 401 : un envoi parti juste après une connexion à un autre compte
 *   n'écrase jamais sa collection) et `baseVersion` la version du serveur, et rend `{ version }`
 *   (`CollectionSaved`) ; sinon 409 : l'appareil relit la version du serveur, qu'il n'écrase
 *   jamais. Sauf un envoi renvoyé tel quel après une réponse perdue : parti de la version d'avant,
 *   le même document que celui enregistré, il rend cette version, sans rien écrire. Le document
 *   est contrôlé aux règles d'un fichier importé (`readSent` ; 400 sinon, la règle en cause au
 *   journal). Le site l'envoie compressé (`Content-Encoding: gzip`), décompressé ici :
 *   413 au-delà de `MAX_DOCUMENT` octets, compressé ou une fois décompressé ; un corps illisible,
 *   400, sans rien au journal.
 * - `POST /api/journal` `{ event }` : ce que le navigateur fait seul de la collection (export,
 *   import), au journal. Une ligne par compte, par évènement et par minute au plus : n'importe quel
 *   compte peut l'appeler à volonté.
 * Sans session : 401, avant de rien lire ni décompresser ; jamais gardé en cache (`signedIn`).
 */

import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { gunzipSync } from 'node:zlib'
import { MINUTE } from '@/lib/time'
import { readCollection, readSent } from '@/lib/transfer'
import { MAX_DOCUMENT, type CollectionSaved, type ShoppingData } from '@/types'
import { signedIn, type SignedIn } from './auth'
import { db } from './db'
import { documentChanges, journal, journalOnce, type JournalEntry } from './journal'
import { collections } from './schema'

/** Le document enregistré d'un compte, tel qu'écrit (JSON). */
const stored = (userId: string) =>
  db
    .select({
      version: collections.version,
      collection: collections.collection,
      shopping: collections.shopping,
    })
    .from(collections)
    .where(eq(collections.userId, userId))
    .get()

/** Une réponse JSON écrite à la main (le document enregistré n'est jamais relu pour être renvoyé). */
const JSON_HEADERS = { 'Content-Type': 'application/json' }

/** Trop gros (413). */
const TOO_LARGE = Symbol('trop gros')

/**
 * Le corps envoyé, décompressé s'il l'est (`gzip`) : `TOO_LARGE` au-delà de `MAX_DOCUMENT` octets
 * décompressés, sans en décompresser plus (une « bombe » de quelques Ko ne devient jamais des Go en
 * mémoire : `gunzipSync` s'arrête au plafond, quand `DecompressionStream` décompresse tout ce
 * qu'il reçoit sans attendre qu'on le lise) ; `undefined` s'il est illisible.
 */
async function readBody(request: Request): Promise<unknown> {
  let bytes = new Uint8Array(await request.arrayBuffer())
  if (request.headers.get('content-encoding') === 'gzip') {
    try {
      bytes = gunzipSync(bytes, { maxOutputLength: MAX_DOCUMENT })
    } catch (error) {
      return error instanceof RangeError ? TOO_LARGE : undefined
    }
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return undefined
  }
}

/** L'envoi d'un appareil, tel que l'attend `PUT` (le document, lui, est lu par `readSent`). */
interface Sent {
  account: string
  baseVersion: number
  collection: unknown
  shopping: unknown
}

const isSent = (body: unknown): body is Sent =>
  typeof body === 'object' &&
  body !== null &&
  typeof (body as Sent).account === 'string' &&
  Number.isInteger((body as Sent).baseVersion) &&
  (body as Sent).baseVersion >= 0

const EVENTS: Record<'export' | 'import', JournalEntry> = {
  export: { topic: 'données', message: 'Collection exportée', details: { format: 'JSON' } },
  import: {
    topic: 'données',
    level: 'warn',
    message: 'Fichier importé',
    details: { effet: 'collection remplacée' },
  },
}

export const collectionRoutes = new Hono<SignedIn>()
  .get('/collection', signedIn, async (c) => {
    const { user } = c.var
    const known = c.req.query('version')
    if (known !== undefined && !/^\d+$/.test(known)) return c.json(null, 400)
    const row = await stored(user.id)
    const version = row?.version ?? 0
    const head = `"version":${version},"account":${JSON.stringify(user.id)}`
    if (Number(known) === version) return c.body(`{${head}}`, 200, JSON_HEADERS)
    const contents = `"collection":${row?.collection ?? 'null'},"shopping":${row?.shopping ?? 'null'}`
    return c.body(`{${head},${contents}}`, 200, JSON_HEADERS)
  })
  .put(
    '/collection',
    signedIn,
    // Compressé ou non, 5 Mo au plus tel qu'envoyé.
    bodyLimit({ maxSize: MAX_DOCUMENT, onError: (c) => c.json(null, 413) }),
    async (c) => {
      const { user } = c.var
      const compte = user.username ?? undefined
      /**
       * Refusé : au journal (une ligne par compte, par statut et par minute au plus : un compte
       * peut renvoyer un document refusé à volonté), et la réponse, sans corps utile.
       */
      const refused = (status: 400 | 401 | 409, level: 'warn' | 'error', raison?: string) => {
        journalOnce(
          `${user.id} refus ${status}`,
          { topic: 'collection', level, message: 'Envoi refusé', details: { compte, raison } },
          undefined,
          MINUTE,
        )
        return c.json(null, status)
      }
      const body = await readBody(c.req.raw)
      if (body === TOO_LARGE) return c.json(null, 413)
      if (!isSent(body)) return c.json(null, 400)
      if (body.account !== user.id) return refused(401, 'warn', 'parti d’un autre compte')
      const { document, problem } = readSent(body)
      if (!document) return refused(400, 'error', problem)
      const { baseVersion } = body
      const collection = JSON.stringify(document.collection)
      const shopping = JSON.stringify(document.shopping)

      const row = await stored(user.id)
      // Renvoyé après une réponse perdue : déjà enregistré tel quel (et noté au journal), de la
      // version d'avant.
      if (
        row?.version === baseVersion + 1 &&
        row.collection === collection &&
        row.shopping === shopping
      ) {
        return c.json<CollectionSaved>({ version: row.version })
      }
      if ((row?.version ?? 0) !== baseVersion) {
        return refused(409, 'warn', 'conflit, changée ailleurs entre-temps')
      }
      // Écrit seulement si la version est encore celle lue : une seule requête, que la base passe
      // d'un seul tenant (un autre appareil qui a écrit entre-temps : 409).
      const version = baseVersion + 1
      const updatedAt = new Date().toISOString()
      const { meta } = await db
        .insert(collections)
        .values({ userId: user.id, version, collection, shopping, updatedAt })
        .onConflictDoUpdate({
          target: collections.userId,
          set: { version, collection, shopping, updatedAt },
          setWhere: eq(collections.version, baseVersion),
        })
        .run()
      if (meta.changes === 0) return refused(409, 'warn', 'conflit, changée ailleurs entre-temps')
      // Relu comme un fichier : un document d'avant les collections d'extensions n'a pas de
      // `series`, que le journal compare.
      const previous = row && {
        collection: readCollection(JSON.parse(row.collection))!,
        shopping: JSON.parse(row.shopping) as ShoppingData,
      }
      for (const change of documentChanges(previous ?? null, document)) {
        journal({ ...change, details: { compte, ...change.details } })
      }
      return c.json<CollectionSaved>({ version })
    },
  )
  .post('/journal', signedIn, async (c) => {
    const { event } = ((await c.req.json().catch(() => null)) ?? {}) as { event?: unknown }
    if (event !== 'export' && event !== 'import') return c.json(null, 400)
    journalOnce(`${c.var.user.id} ${event}`, EVENTS[event], c.req.raw, MINUTE)
    return c.body(null, 204)
  })
