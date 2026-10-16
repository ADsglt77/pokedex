/**
 * Le Pokédex public (`/vitrine` sur le site), toujours montré : la page d'accueil d'un visiteur.
 * `GET /api/vitrine`, sans session : la collection du compte, réduite à ce qui se montre : ses
 * cartes (référence, image, id Cardmarket pour la valeur au prix du jour ; pas leur page) et, pour
 * celles possédées, la date d'obtention (pas le prix payé). Rien des achats : ni commandes, ni
 * budget, ni statut « commandée ». Une collection vide tant qu'aucun appareil n'a rien envoyé.
 */

import type { Database } from 'bun:sqlite'
import { Elysia } from 'elysia'
import { emptyCollection } from '@/lib/collection'
import type { CardOwnership, CollectionData, PokemonCard } from '@/types'
import { journal } from './journal'

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

export function vitrineRoutes(app: Database) {
  // Un seul compte : sa collection.
  const readShown = app.query('SELECT collection FROM collections LIMIT 1')

  return new Elysia({ name: 'vitrine' }).get(
    '/vitrine',
    ({ request }) => {
      journal({ topic: 'vitrine', message: 'Pokédex public consulté' }, request)
      const row = readShown.get() as { collection: string } | null
      const shown = row ? shownCollection(JSON.parse(row.collection)) : emptyCollection()
      return new Response(JSON.stringify(shown), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      })
    },
    { detail: { summary: 'Le Pokédex public' } },
  )
}
