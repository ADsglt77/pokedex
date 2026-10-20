/**
 * Le Pokédex public de chaque compte (`/pseudo` sur le site), toujours montré.
 * - `GET /api/vitrine/<pseudo>`, sans session (le pseudo sans tenir compte des majuscules ; 404
 *   s'il n'est à personne) : `{ owner, collection, prices }` (`VitrineData`), le pseudo du compte
 *   et sa collection, réduite à ce qui se montre : ses cartes (référence, image, id Cardmarket pour
 *   la valeur au prix du jour ; pas leur page) et, pour celles possédées, la date d'obtention (pas
 *   le prix payé). Rien des achats : ni commandes, ni budget, ni statut « commandée ». Une
 *   collection vide tant qu'aucun appareil n'a rien envoyé. Avec elle, les prix du jour de ses
 *   seules cartes possédées, demandés à l'API des données (`dataPrices`), dans la forme de
 *   `/api/prices` (`null` sans guide des prix, ou l'API muette : la page s'affiche sans valeur) :
 *   la page n'en montre que la valeur, sans charger ceux de toutes les cartes.
 * - `GET /api/vitrine/<pseudo>/apercu` : la page que lisent les robots d'aperçu (Discord,
 *   WhatsApp…) quand on partage le lien : « Le Pokédex de … » et sa progression (ils ne lancent pas
 *   le JavaScript de l'app). nginx les y envoie pour toute adresse d'un seul segment
 *   (`deploy/nginx.conf.template`) : une page du site (`/connexion`), ou un pseudo à personne, a l'aperçu
 *   du site.
 * Chacune au journal, une fois par heure au plus par visiteur et par Pokédex (`journalOnce`).
 */

import type { Database } from 'bun:sqlite'
import { Elysia, NotFoundError } from 'elysia'
import { TOTAL_SPECIES } from '@/config/pokedex'
import { isPseudo } from '@/lib/account'
import { emptyCollection } from '@/lib/collection'
import { formatShare, pokedexTitle, unlockedOf } from '@/lib/format'
import { progressPercent, unlockEvents } from '@/lib/pokedex'
import { HOUR, MINUTE } from '@/lib/time'
import type { CardOwnership, CollectionData, PokemonCard, PriceFile, VitrineData } from '@/types'
import { journalOnce, reasonOf, visitorOf } from './journal'

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

/** L'aperçu d'une adresse qui n'est pas un Pokédex public : celui du site. */
const SITE_SUMMARY = {
  title: 'Mon Pokédex',
  description: 'Un Pokédex de cartes Pokémon japonaises : une carte par Pokémon, à collectionner.',
}

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

/** Les robots d'aperçu, pour le journal (la même liste que `deploy/nginx.conf.template`). */
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

/**
 * Les prix du jour des cartes `ids`, demandés à l'API des données (`DATA_API_URL`, avec le token du
 * site, `DATA_API_TOKEN`, lus à chaque demande) ; `null` sans carte, sans guide des prix, ou l'API
 * muette (5 s au plus, et une ligne au journal par minute au plus).
 */
async function dataPrices(ids: number[]): Promise<PriceFile | null> {
  if (!ids.length) return null
  const url = `${process.env.DATA_API_URL ?? 'http://127.0.0.1:3001'}/v1/prices?ids=${[...new Set(ids)].join()}`
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.DATA_API_TOKEN ?? ''}` },
      signal: AbortSignal.timeout(5000),
    })
    if (response.ok) return (await response.json()) as PriceFile
    // Sans guide des prix (404) : rien à dire. Un token refusé ou une panne : à voir.
    if (response.status === 404) return null
    throw new Error(`HTTP ${response.status}`)
  } catch (error) {
    journalOnce(
      'api-données',
      {
        topic: 'serveur',
        level: 'warn',
        message: 'API des données muette',
        details: { raison: reasonOf(error) },
      },
      undefined,
      MINUTE,
    )
    return null
  }
}

/**
 * Une réponse JSON et son ETag, tiré de son contenu : un visiteur qui revient sur un Pokédex
 * inchangé reçoit un 304, sans corps (un relais, Cloudflare, peut affaiblir l'ETag en `W/"…"` :
 * c'est le même).
 */
function serveJson(request: Request, body: unknown) {
  const text = JSON.stringify(body)
  const etag = `"${Bun.hash(text).toString(36)}"`
  const headers = { 'Cache-Control': 'no-cache', ETag: etag }
  if (request.headers.get('if-none-match')?.replace(/^W\//, '') === etag) {
    return new Response(null, { status: 304, headers })
  }
  return new Response(text, { headers: { ...headers, 'Content-Type': 'application/json' } })
}

/** Le compte d'un pseudo. */
interface Owner {
  id: string
  name: string
  username: string
}

/**
 * `app` : les comptes et leurs collections ; `origin` : l'adresse publique du site
 * (`BETTER_AUTH_URL`), pour les liens de l'aperçu.
 */
export function vitrineRoutes(app: Database, origin: string) {
  // `username` : le pseudo en minuscules (`server/auth.ts`).
  const readOwner = app.query('SELECT id, name, username FROM "user" WHERE username = ?')
  const readShown = app.query('SELECT collection FROM collections WHERE user_id = ?')
  // Seulement un pseudo possible : jamais une adresse du site (`RESERVED_PSEUDOS`), même portée par
  // un compte créé avant qu'elle ne le devienne.
  const ownerOf = (pseudo: string) =>
    isPseudo(pseudo) ? (readOwner.get(pseudo.toLowerCase()) as Owner | null) : null
  const shown = (owner: Owner) => {
    const row = readShown.get(owner.id) as { collection: string } | null
    return row ? shownCollection(JSON.parse(row.collection) as CollectionData) : emptyCollection()
  }

  return new Elysia({ name: 'vitrine' })
    .get(
      '/vitrine/:pseudo',
      async ({ params, request }) => {
        const owner = ownerOf(params.pseudo)
        if (!owner) throw new NotFoundError()
        const collection = shown(owner)
        journalVisit(
          {
            topic: 'vitrine',
            message: 'Pokédex public consulté',
            details: { pseudo: owner.username },
          },
          request,
        )
        const owned = Object.values(collection.customCards).flatMap(({ id, cardmarket }) =>
          cardmarket && collection.cards[id] ? [cardmarket] : [],
        )
        const vitrine: VitrineData = {
          owner: owner.name,
          collection,
          prices: await dataPrices(owned),
        }
        return serveJson(request, vitrine)
      },
      { detail: { summary: 'Le Pokédex public d’un compte' } },
    )
    .get(
      '/vitrine/:pseudo/apercu',
      ({ params, request }) => {
        const owner = ownerOf(params.pseudo)
        const robot = request.headers.get('user-agent')?.match(PREVIEW_BOTS)?.[0]
        if (owner) {
          journalVisit(
            {
              topic: 'vitrine',
              message: 'Lien partagé lu',
              details: { pseudo: owner.username, robot },
            },
            request,
          )
        }
        const { title, description } = owner
          ? vitrineSummary(owner.name, shown(owner))
          : SITE_SUMMARY
        const url = owner ? `${origin}/${owner.username}` : origin
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
