/**
 * Le Pokédex public de chaque compte (`/@pseudo` sur le site), toujours montré.
 * - `GET /api/vitrine/<pseudo>`, sans session (le pseudo sans tenir compte des majuscules ; 404
 *   s'il n'est à personne) : `{ owner, collection, prices }` (`VitrineData`), le pseudo du compte
 *   et sa collection, réduite à ce qui se montre : ses cartes (référence, image, id Cardmarket pour
 *   la valeur au prix du jour ; pas leur page) et, pour celles possédées, la date d'obtention (pas
 *   le prix payé). Rien des achats : ni commandes, ni budget, ni statut « commandée ». Une
 *   collection vide tant qu'aucun appareil n'a rien envoyé. Avec elle, les prix du jour de ses
 *   seules cartes possédées, dans la forme de `/api/prices/collection` (`null` sans guide des
 *   prix) : la page n'en montre que la valeur, sans charger ceux de toutes les cartes.
 * - `GET /api/vitrine/<pseudo>/apercu` : la page que lisent les robots d'aperçu (Discord,
 *   WhatsApp…) quand on partage le lien : « Le Pokédex de … » et sa progression (ils ne lancent pas
 *   le JavaScript de l'app). nginx les y envoie (`deploy/nginx.conf`).
 * Chacune au journal, une fois par heure au plus par visiteur et par Pokédex (`journalOnce`).
 */

import type { Database } from 'bun:sqlite'
import { Elysia } from 'elysia'
import { TOTAL_SPECIES } from '@/config/pokedex'
import { emptyCollection } from '@/lib/collection'
import { formatShare, pokedexTitle, unlockedOf } from '@/lib/format'
import { progressPercent, unlockEvents } from '@/lib/pokedex'
import { HOUR } from '@/lib/time'
import type { CardOwnership, CollectionData, PokemonCard, VitrineData } from '@/types'
import { readSource } from './db'
import { readPrices } from './jobs/prices'
import { journalOnce, visitorOf } from './journal'
import { notFound, serveTagged } from './snapshots'

/**
 * La collection telle que la voit un visiteur (testé : jamais un prix payé ni un achat). Chaque
 * champ est recopié un à un, l'image comprise : ce qu'un fichier importé y aurait glissé en plus
 * ne devient pas public.
 */
export function shownCollection(collection: CollectionData): CollectionData {
  const customCards: Record<string, PokemonCard> = {}
  for (const [id, { dexIds, reference, image, cardmarket }] of Object.entries(
    collection.customCards,
  )) {
    customCards[id] = {
      id,
      dexIds,
      reference,
      image: image && { small: image.small, large: image.large },
      ...(cardmarket && { cardmarket }),
    }
  }
  const cards: Record<string, CardOwnership> = {}
  for (const [id, { status, updatedAt, acquiredAt }] of Object.entries(collection.cards)) {
    if (status === 'owned') cards[id] = { status, updatedAt, acquiredAt }
  }
  return { ...emptyCollection(), updatedAt: collection.updatedAt, cards, customCards }
}

/** Le titre et la phrase de l'aperçu d'un lien partagé : le pseudo, la progression (testé). */
export function vitrineSummary(owner: string, collection: CollectionData) {
  const unlocked = unlockEvents(collection).length
  const share = formatShare(progressPercent(unlocked, TOTAL_SPECIES))
  return {
    title: pokedexTitle(owner),
    description: `${unlockedOf({ unlocked, total: TOTAL_SPECIES }, 'Pokémon')} (${share}) : une carte Pokémon japonaise par Pokémon.`,
  }
}

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

/** Les robots d'aperçu, pour le journal (la même liste que `deploy/nginx.conf`). */
const PREVIEW_BOTS =
  /discordbot|whatsapp|facebookexternalhit|twitterbot|slackbot|telegrambot|linkedinbot|skypeuripreview|redditbot|embedly/i

/**
 * Une visite au journal, une fois par heure au plus par visiteur, par message et par Pokédex : des
 * visites répétées (un rechargement sans fin, un robot) ne font pas tourner le journal de Docker,
 * qui effacerait les connexions.
 */
const journalVisit = (entry: Parameters<typeof journalOnce>[1], request: Request) =>
  journalOnce(
    `${entry.message} ${entry.details?.pseudo} ${visitorOf(request)}`,
    entry,
    request,
    HOUR,
  )

/** Le compte d'un pseudo, et la version de sa collection (`null` tant qu'il n'a rien envoyé). */
interface Owner {
  id: string
  name: string
  username: string
  version: number | null
}

/**
 * `app` : les comptes et leurs collections ; `data` : les prix ; `origin` : l'adresse publique du
 * site (`BETTER_AUTH_URL`), pour les liens de l'aperçu.
 */
export function vitrineRoutes(app: Database, data: Database, origin: string) {
  // `username` : le pseudo en minuscules (`server/auth.ts`).
  const readOwner = app.query(
    `SELECT u.id, u.name, u.username, c.version
     FROM "user" AS u LEFT JOIN collections AS c ON c.user_id = u.id
     WHERE u.username = ?`,
  )
  const readShown = app.query('SELECT collection FROM collections WHERE user_id = ?')
  const ownerOf = (pseudo: string) => readOwner.get(pseudo.toLowerCase()) as Owner | null
  const shown = (owner: Owner) => {
    const row = readShown.get(owner.id) as { collection: string } | null
    return row ? shownCollection(JSON.parse(row.collection) as CollectionData) : emptyCollection()
  }

  return new Elysia({ name: 'vitrine' })
    .get(
      '/vitrine/:pseudo',
      ({ params, request }) => {
        // Ce dont la réponse dépend : le compte, la version de sa collection, son pseudo, les prix
        // du jour. Un visiteur qui revient reçoit un 304, sans que la collection soit relue. Lus
        // dans une même transaction de chaque base : la version et la collection, le jour des prix
        // et les prix sont ceux d'un même instant (une écriture entre deux partirait avec l'ancien
        // ETag).
        const serve = () => {
          const owner = ownerOf(params.pseudo)
          if (!owner) return notFound()
          journalVisit(
            {
              topic: 'vitrine',
              message: 'Pokédex public consulté',
              details: { pseudo: owner.username },
            },
            request,
          )
          const prices = readSource(data, 'cardmarket')
          return serveTagged(
            request,
            `${owner.id}|${owner.version ?? 0}|${owner.name}|${prices?.stamp ?? ''}|${prices?.date ?? ''}`,
            (): VitrineData => {
              const collection = shown(owner)
              const owned = Object.values(collection.customCards).flatMap(({ id, cardmarket }) =>
                cardmarket && collection.cards[id] ? [cardmarket] : [],
              )
              return { owner: owner.name, collection, prices: readPrices(data, owned) }
            },
          )
        }
        return app.transaction(() => data.transaction(serve)())()
      },
      { detail: { summary: 'Le Pokédex public d’un compte' } },
    )
    .get(
      '/vitrine/:pseudo/apercu',
      ({ params, request }) => {
        const owner = ownerOf(params.pseudo)
        if (!owner) return notFound()
        const robot = request.headers.get('user-agent')?.match(PREVIEW_BOTS)?.[0]
        journalVisit(
          {
            topic: 'vitrine',
            message: 'Lien partagé lu',
            details: { pseudo: owner.username, robot },
          },
          request,
        )
        const { title, description } = vitrineSummary(owner.name, shown(owner))
        const url = `${origin}/@${owner.username}`
        const meta = (property: string, content: string) =>
          `<meta property="${property}" content="${escape(content)}">`
        const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escape(title)}</title>${[
          meta('og:type', 'website'),
          meta('og:site_name', 'Mon Pokédex'),
          meta('og:title', title),
          meta('og:description', description),
          meta('og:url', url),
          meta('og:image', `${origin}/icons/icon-512.png`),
        ].join(
          '',
        )}<meta name="twitter:card" content="summary"><meta name="description" content="${escape(description)}"></head><body><a href="${escape(url)}">${escape(title)}</a></body></html>`
        return new Response(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
        })
      },
      { detail: { summary: 'L’aperçu d’un lien partagé vers un Pokédex public (robots)' } },
    )
}
