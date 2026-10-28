/**
 * Le Pokédex public de chaque compte (`/pseudo` sur le site), toujours montré.
 * - `GET /api/vitrine/<pseudo>`, sans session (le pseudo sans tenir compte des majuscules ; 404
 *   s'il n'est à personne) : `{ owner, collection, prices }` (`VitrineData`), le pseudo du compte
 *   et sa collection, réduite à ce qui se montre : ses cartes (référence, image, langue, id
 *   Cardmarket pour la valeur au prix du jour ; pas leur page), la carte favorite de chaque
 *   Pokémon (`favorites`), ses collections d'extensions (`series` : l'extension, son nom, ses
 *   cases, dont celles pas encore obtenues, `seriesOnly`) et, pour les cartes possédées, la date
 *   d'obtention (pas le prix payé). Rien des achats : ni commandes, ni budget, ni statut
 *   « commandée ». Une collection vide tant qu'aucun appareil n'a rien envoyé ; un document
 *   enregistré avant les favorites est relu comme un fichier (`readCollection`) : chaque Pokémon y
 *   a sa première carte. Avec elle, les prix du jour de ses seules cartes possédées, demandés à
 *   l'API des données (`dataPrices`), dans la forme de `/api/prices` (`null` sans guide des prix,
 *   l'API muette, ou plus de 5 000 cartes possédées : la page s'affiche sans valeur) : la page n'en
 *   montre que la valeur, sans charger ceux de toutes les cartes.
 * - L'aperçu d'un lien partagé (`linkPreview`) : un robot d'aperçu (Discord, WhatsApp…) qui lit une
 *   adresse d'un seul segment reçoit une page à lui, « Le Pokédex de … » et sa progression (il ne
 *   lance pas le JavaScript de l'app) ; une page du site (`/connexion`), ou un pseudo à personne, a
 *   l'aperçu du site. Tout autre visiteur reçoit la page de l'app.
 * Chacun au journal, une fois par heure au plus par visiteur et par Pokédex (`journalOnce`).
 */

import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { Hono, type MiddlewareHandler } from 'hono'
import { TOTAL_SPECIES } from '@/config/pokedex'
import { isPseudo } from '@/lib/account'
import { emptyCollection } from '@/lib/collection'
import { formatShare, pokedexTitle, unlockedOf } from '@/lib/format'
import { progressPercent, unlockEvents } from '@/lib/pokedex'
import { idBatches } from '@/lib/prices'
import { HOUR, MINUTE } from '@/lib/time'
import { readCollection } from '@/lib/transfer'
import type { CardOwnership, CollectionData, PokemonCard, PriceFile, VitrineData } from '@/types'
import { ORIGIN } from './auth'
import { dataFetch } from './data'
import { db } from './db'
import { journalOnce, reasonOf, visitorOf, type JournalEntry } from './journal'
import { collections, user } from './schema'

/**
 * La collection telle que la voit un visiteur (testé : jamais un prix payé ni un achat). Chaque
 * champ est recopié un à un, l'image et les collections d'extensions comprises : ce qu'un fichier
 * importé y aurait glissé en plus ne devient pas public. Une case d'extension pas encore obtenue
 * reste marquée (`seriesOnly`) : sans elle, la page la compterait au Pokédex. Une case commandée
 * n'est pas dite commandée : seules les cartes possédées ont un statut.
 */
export function shownCollection(collection: CollectionData): CollectionData {
  const customCards: Record<string, PokemonCard> = {}
  for (const [id, { dexIds, reference, image, cardmarket, language, seriesOnly }] of Object.entries(
    collection.customCards,
  )) {
    customCards[id] = {
      id,
      dexIds,
      reference,
      image: image && { small: image.small, large: image.large },
      ...(cardmarket && { cardmarket }),
      // Sans elle, une carte française serait montrée japonaise (son image, son lien).
      ...(language && { language }),
      ...(seriesOnly && { seriesOnly }),
    }
  }
  const cards: Record<string, CardOwnership> = {}
  for (const [id, { status, updatedAt, acquiredAt }] of Object.entries(collection.cards)) {
    if (status === 'owned') cards[id] = { status, updatedAt, acquiredAt }
  }
  // Des ids de cartes, rangés par Pokémon (le serveur refuse le reste) : chaque entrée est recopiée.
  return {
    ...emptyCollection(),
    updatedAt: collection.updatedAt,
    cards,
    customCards,
    favorites: { ...collection.favorites },
    series: collection.series.map(({ set, language, name, startedAt, cards: slots }) => ({
      set,
      ...(language && { language }),
      name,
      startedAt,
      cards: [...slots],
    })),
  }
}

/** Le titre et la phrase de l'aperçu d'un lien partagé : le pseudo, la progression (testé). */
export function vitrineSummary(owner: string, collection: CollectionData) {
  const unlocked = unlockEvents(collection).length
  const share = formatShare(progressPercent(unlocked, TOTAL_SPECIES))
  return {
    title: pokedexTitle(owner),
    description: `${unlockedOf({ unlocked, total: TOTAL_SPECIES }, 'Pokémon')} (${share}) : une carte Pokémon japonaise ou française par Pokémon.`,
  }
}

/**
 * L'aperçu d'une adresse qui n'est pas un Pokédex public : celui du site, PokéCodex (le même que
 * dans `index.html`).
 */
const SITE_SUMMARY = {
  title: 'PokéCodex',
  description:
    'Un Pokédex de cartes Pokémon japonaises et françaises : une carte par Pokémon, à collectionner.',
}

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

/** Les robots d'aperçu des messageries, qui lisent un lien partagé. */
const PREVIEW_BOTS =
  /discordbot|whatsapp|facebookexternalhit|twitterbot|slackbot|telegrambot|linkedinbot|skypeuripreview|redditbot|embedly/i

/**
 * Une visite au journal, une fois par heure au plus par visiteur, par message et par Pokédex : des
 * visites répétées (un rechargement sans fin, un robot) ne noient pas le journal.
 */
const journalVisit = (entry: JournalEntry, request: Request) =>
  journalOnce(
    `${entry.message} ${entry.details?.pseudo} ${visitorOf(request)}`,
    entry,
    request,
    HOUR,
  )

/**
 * Les paquets de prix qu'une visite demande au plus (5 000 cartes possédées) : la page est publique,
 * sans session, et un document de quelques Mo ne doit pas lancer des dizaines de demandes à l'API
 * des données à chaque visite.
 */
const MAX_PRICE_BATCHES = 5

/**
 * Les prix du jour des cartes `ids`, demandés à l'API des données par paquets de 1 000
 * (`idBatches` : elle en refuse plus de 1 025), l'un après l'autre, puis réunis ; `null` sans
 * carte, au-delà de `MAX_PRICE_BATCHES` paquets (sans rien demander), sans guide des prix, ou
 * l'API muette pour l'un des paquets (les suivants ne sont pas demandés : une valeur partielle
 * serait fausse).
 */
async function dataPrices(ids: number[]): Promise<PriceFile | null> {
  const batches = idBatches(ids)
  if (!batches.length || batches.length > MAX_PRICE_BATCHES) return null
  const prices: PriceFile = { date: '', cards: {} }
  for (const batch of batches) {
    const file = await dataPricesOf(batch)
    if (!file) return null
    prices.date = file.date
    Object.assign(prices.cards, file.cards)
  }
  return prices
}

/**
 * Les prix du jour d'un paquet de cartes, en une demande ; `null` sans guide des prix, ou l'API
 * muette (5 s au plus, et une ligne au journal par minute au plus).
 */
async function dataPricesOf(ids: number[]): Promise<PriceFile | null> {
  try {
    const response = await dataFetch(`/prices?ids=${ids.join()}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (response.ok) return await response.json<PriceFile>()
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
 * inchangé reçoit un 304, sans corps (un relais peut affaiblir l'ETag en `W/"…"` : c'est le même).
 */
async function serveJson(request: Request, body: unknown) {
  const text = JSON.stringify(body)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  const hex = [...new Uint8Array(digest).slice(0, 12)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  const headers = { 'Cache-Control': 'no-cache', ETag: `"${hex}"` }
  if (request.headers.get('if-none-match')?.replace(/^W\//, '') === headers.ETag) {
    return new Response(null, { status: 304, headers })
  }
  return new Response(text, { headers: { ...headers, 'Content-Type': 'application/json' } })
}

/**
 * Le compte d'un pseudo : seulement un pseudo possible, jamais une adresse du site
 * (`RESERVED_PSEUDOS`), même portée par un compte créé avant qu'elle ne le devienne.
 */
const ownerOf = async (pseudo: string) =>
  isPseudo(pseudo)
    ? ((await db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(eq(user.username, pseudo.toLowerCase()))
        .get()) ?? null)
    : null

/**
 * Ce que montre le Pokédex d'un compte : sa collection relue comme celle d'un fichier (un document
 * enregistré avant les favorites n'en a pas, et chaque Pokémon y reçoit sa première carte).
 */
async function shownOf(userId: string) {
  const row = await db
    .select({ collection: collections.collection })
    .from(collections)
    .where(eq(collections.userId, userId))
    .get()
  return row ? shownCollection(readCollection(JSON.parse(row.collection))!) : emptyCollection()
}

export const vitrineRoutes = new Hono().get('/vitrine/:pseudo', async (c) => {
  const pseudo = c.req.param('pseudo')
  const owner = await ownerOf(pseudo)
  if (!owner) return c.body(null, 404, { 'Cache-Control': 'no-cache' })
  const collection = await shownOf(owner.id)
  journalVisit(
    {
      topic: 'vitrine',
      message: 'Pokédex public consulté',
      details: { pseudo: pseudo.toLowerCase() },
    },
    c.req.raw,
  )
  const owned = Object.values(collection.customCards).flatMap(({ id, cardmarket }) =>
    cardmarket && collection.cards[id] ? [cardmarket] : [],
  )
  const vitrine: VitrineData = { owner: owner.name, collection, prices: await dataPrices(owned) }
  return serveJson(c.req.raw, vitrine)
})

/**
 * `/<segment>` : pour un robot d'aperçu, la page qu'il lit (le Pokédex du pseudo, ou le site) ;
 * pour tout autre visiteur, la page de l'app (`env.ASSETS`).
 */
export const linkPreview: MiddlewareHandler = async (c) => {
  const robot = c.req.header('user-agent')?.match(PREVIEW_BOTS)?.[0]
  if (!robot) return env.ASSETS.fetch(c.req.raw)
  const pseudo = c.req.path.slice(1)
  const owner = await ownerOf(pseudo)
  if (owner) {
    journalVisit(
      {
        topic: 'vitrine',
        message: 'Lien partagé lu',
        details: { pseudo: pseudo.toLowerCase(), robot },
      },
      c.req.raw,
    )
  }
  const { title, description } = owner
    ? vitrineSummary(owner.name, await shownOf(owner.id))
    : SITE_SUMMARY
  const url = owner ? `${ORIGIN}/${pseudo.toLowerCase()}` : ORIGIN
  const meta = (property: string, content: string) =>
    `<meta property="${property}" content="${escape(content)}">`
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escape(title)}</title>${[
    meta('og:type', 'website'),
    meta('og:site_name', 'PokéCodex'),
    meta('og:title', title),
    meta('og:description', description),
    meta('og:url', url),
    meta('og:image', `${ORIGIN}/icons/icon-512.png`),
  ].join(
    '',
  )}<meta name="twitter:card" content="summary"><meta name="description" content="${escape(description)}"></head><body><a href="${escape(url)}">${escape(title)}</a></body></html>`
  return c.html(html, 200, { 'Cache-Control': 'no-cache' })
}
