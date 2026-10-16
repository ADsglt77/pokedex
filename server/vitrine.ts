/**
 * Le Pokédex public (`/vitrine` sur le site), que le compte choisit de montrer :
 * - `GET /api/vitrine` : pour tout visiteur, sans session. La collection du compte, réduite à ce
 *   qui se montre : ses cartes (référence, image, id Cardmarket pour la valeur au prix du jour ; pas
 *   leur page) et, pour celles possédées, la date d'obtention (pas le prix payé). Rien des achats :
 *   ni commandes, ni budget, ni liste d'achats, ni statuts « commandée » ou « souhaitée ». 404 tant
 *   que le compte ne le montre pas.
 * - `GET` et `PUT /api/vitrine/settings` : pour le compte, le montrer ou non (`{ public }`).
 */

import type { Database } from 'bun:sqlite'
import { Elysia, t } from 'elysia'
import { emptyCollection } from '@/lib/collection'
import type { CardOwnership, CollectionData, PokemonCard } from '@/types'
import type { accountRoutes } from './auth'
import { notFound } from './snapshots'

/** La collection telle que la voit un visiteur (testé : jamais un prix payé ni un achat). */
export function shownCollection(collection: CollectionData): CollectionData {
  const customCards: Record<string, PokemonCard> = {}
  for (const [id, { dexIds, reference, image, cardmarket }] of Object.entries(
    collection.customCards,
  )) {
    customCards[id] = { id, dexIds, reference, image, ...(cardmarket && { cardmarket }) }
  }
  const cards: Record<string, CardOwnership> = {}
  for (const [id, { status, updatedAt, acquiredAt }] of Object.entries(collection.cards)) {
    if (status === 'owned') cards[id] = { status, updatedAt, acquiredAt }
  }
  return { ...emptyCollection(), updatedAt: collection.updatedAt, cards, customCards }
}

export function vitrineRoutes(app: Database, account: ReturnType<typeof accountRoutes>) {
  // Un seul compte : la collection montrée, s'il y en a une.
  const readShown = app.query('SELECT collection FROM collections WHERE public = 1 LIMIT 1')

  return new Elysia({ name: 'vitrine' })
    .use(account)
    .get(
      '/vitrine',
      () => {
        const row = readShown.get() as { collection: string } | null
        if (!row) return notFound()
        return new Response(JSON.stringify(shownCollection(JSON.parse(row.collection))), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        })
      },
      { detail: { summary: 'Le Pokédex public, s’il est montré' } },
    )
    .get(
      '/vitrine/settings',
      ({ user }) => {
        const row = app.query('SELECT public FROM collections WHERE user_id = ?').get(user.id) as {
          public: number
        } | null
        return { public: row?.public === 1 }
      },
      { auth: true, detail: { summary: 'Le Pokédex est-il montré ?' } },
    )
    .put(
      '/vitrine/settings',
      ({ user, body, status }) => {
        const { changes } = app
          .query('UPDATE collections SET public = ? WHERE user_id = ?')
          .run(body.public ? 1 : 0, user.id)
        // La collection pas encore envoyée par un appareil : rien à montrer.
        if (changes === 0) return status(409, null)
        return { public: body.public }
      },
      {
        auth: true,
        body: t.Object({ public: t.Boolean() }),
        detail: { summary: 'Montre le Pokédex, ou plus' },
      },
    )
}
