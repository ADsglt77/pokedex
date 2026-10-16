/**
 * Le Pokédex public (`/vitrine` sur le site), toujours montré : la page d'accueil d'un visiteur.
 * - `GET /api/vitrine`, sans session : `{ owner, collection }`, le pseudo du compte et sa
 *   collection, réduite à ce qui se montre : ses cartes (référence, image, id Cardmarket pour la
 *   valeur au prix du jour ; pas leur page) et, pour celles possédées, la date d'obtention (pas le
 *   prix payé). Rien des achats : ni commandes, ni budget, ni statut « commandée ». Une collection
 *   vide tant qu'aucun appareil n'a rien envoyé.
 * - `GET /api/vitrine/apercu` : la page que lisent les robots d'aperçu (Discord, WhatsApp…) quand
 *   on partage le lien : « Le Pokédex de … » et sa progression (ils ne lancent pas le JavaScript
 *   de l'app). nginx les y envoie (`deploy/nginx.conf`).
 */

import type { Database } from 'bun:sqlite'
import { Elysia } from 'elysia'
import { TOTAL_SPECIES } from '@/config/pokedex'
import { emptyCollection } from '@/lib/collection'
import { formatDecimal, formatInteger, ofName, plural } from '@/lib/format'
import { progressPercent } from '@/lib/pokedex'
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

/** Le titre et la phrase de l'aperçu d'un lien partagé : le pseudo, la progression (testé). */
export function vitrineSummary(owner: string | null, collection: CollectionData) {
  const unlocked = new Set<number>()
  for (const [id, card] of Object.entries(collection.customCards)) {
    if (collection.cards[id]?.status === 'owned')
      card.dexIds.forEach((dexId) => unlocked.add(dexId))
  }
  const percent = formatDecimal(progressPercent(unlocked.size, TOTAL_SPECIES))
  return {
    title: owner ? `Le Pokédex ${ofName(owner)}` : 'Un Pokédex de cartes japonaises',
    description: `${plural(unlocked.size, 'Pokémon débloqué', 'Pokémon débloqués')} sur ${formatInteger(TOTAL_SPECIES)} (${percent} %) : une carte Pokémon japonaise par Pokémon.`,
  }
}

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

/** Les robots d'aperçu, pour le journal (la même liste que `deploy/nginx.conf`). */
const PREVIEW_BOTS =
  /discordbot|whatsapp|facebookexternalhit|twitterbot|slackbot|telegrambot|linkedinbot|skypeuripreview|redditbot|embedly/i

/** `origin` : l'adresse publique du site (`BETTER_AUTH_URL`), pour les liens de l'aperçu. */
export function vitrineRoutes(app: Database, origin: string) {
  // Un seul compte : son pseudo et sa collection.
  const readShown = app.query('SELECT collection FROM collections LIMIT 1')
  const readOwner = app.query('SELECT name FROM "user" LIMIT 1')
  const shown = () => {
    const row = readShown.get() as { collection: string } | null
    return row ? shownCollection(JSON.parse(row.collection)) : emptyCollection()
  }
  const owner = () => (readOwner.get() as { name: string } | null)?.name || null

  return new Elysia({ name: 'vitrine' })
    .get(
      '/vitrine',
      ({ request }) => {
        journal({ topic: 'vitrine', message: 'Pokédex public consulté' }, request)
        return new Response(JSON.stringify({ owner: owner(), collection: shown() }), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        })
      },
      { detail: { summary: 'Le Pokédex public' } },
    )
    .get(
      '/vitrine/apercu',
      ({ request }) => {
        const robot = request.headers.get('user-agent')?.match(PREVIEW_BOTS)?.[0]
        journal({ topic: 'vitrine', message: 'Lien partagé lu', details: { robot } }, request)
        const { title, description } = vitrineSummary(owner(), shown())
        const meta = (property: string, content: string) =>
          `<meta property="${property}" content="${escape(content)}">`
        const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escape(title)}</title>${[
          meta('og:type', 'website'),
          meta('og:site_name', 'Mon Pokédex'),
          meta('og:title', title),
          meta('og:description', description),
          meta('og:url', `${origin}/vitrine`),
          meta('og:image', `${origin}/icons/icon-512.png`),
        ].join(
          '',
        )}<meta name="twitter:card" content="summary"><meta name="description" content="${escape(description)}"></head><body><a href="${origin}/vitrine">${escape(title)}</a></body></html>`
        return new Response(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
        })
      },
      { detail: { summary: 'L’aperçu d’un lien partagé vers le Pokédex public (robots)' } },
    )
}
