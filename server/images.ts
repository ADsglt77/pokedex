/**
 * Les images, copiées chez nous (`IMAGES_DIR`, le volume `images` sur le VPS ; nginx les sert à
 * `/images/…`) : chez Pokécardex (avec son accord, qui demande de les héberger chez nous), les
 * cartes, le logo japonais de chaque série et les icônes des types et des raretés ; chez PokéAPI,
 * les sprites et illustrations des Pokémon. Chaque chemin local correspond à une seule adresse
 * d'origine (`upstreamUrl`) : le navigateur garde les adresses d'origine dans la collection et ne
 * demande que leur chemin local (`localSrc`, `src/lib/card-images.ts`). Seuls ces chemins-là sont
 * copiés : le serveur n'est pas un relais ouvert.
 */

import type { Database } from 'bun:sqlite'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { CARD_TYPES } from '@/config/catalog'
import { TOTAL_SPECIES } from '@/config/pokedex'
import { WEEK } from '@/lib/time'
import { DATA_DIR } from './db'
import { journal } from './journal'
import { politeFetch, quickFetch } from './lib/net'
import { notFound } from './snapshots'

const IMAGES_DIR = process.env.IMAGES_DIR ?? join(DATA_DIR, 'images')

const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'
/** Les images du site de Pokécardex, en WebP (`class`) : logos, icônes. */
const ASSETS = 'https://pokecardex.b-cdn.net/assets/images'

/** Les chemins locaux connus, et l'adresse d'origine de chacun. */
const UPSTREAMS: [RegExp, (...parts: string[]) => string][] = [
  [
    /^\/images\/cards\/pokecardex\/([A-Z0-9_-]+)\/(\d{1,4})-(md|hd)\.webp$/,
    (set, number, size) =>
      `https://pokecardex-scans.b-cdn.net/sets_jp/${set}/${number}.jpg?class=${size}`,
  ],
  [
    /^\/images\/sets\/([A-Z0-9_-]+)-(md|hd)\.webp$/,
    (set, size) => `${ASSETS}/logos_jp/${set}.png?class=${size}`,
  ],
  [/^\/images\/types\/(\d{1,2})\.webp$/, (type) => `${ASSETS}/types/type_${type}.png?class=md`],
  [
    /^\/images\/rarities\/(\d{1,3})\.webp$/,
    (rarity) => `${ASSETS}/rarete/ids/rarete_${rarity}.png?class=md`,
  ],
  [/^\/images\/species\/(\d{1,4})\.png$/, (id) => `${SPRITES}/${id}.png`],
  [
    /^\/images\/species\/artwork\/(\d{1,4})\.png$/,
    (id) => `${SPRITES}/other/official-artwork/${id}.png`,
  ],
]

/** L'adresse d'origine d'un chemin local (`/images/…`) ; `null` s'il n'en est pas un. */
function upstreamUrl(path: string) {
  for (const [pattern, url] of UPSTREAMS) {
    const match = pattern.exec(path)
    if (match) return url(...match.slice(1))
  }
  return null
}

/**
 * Les images de TCGplayer qu'une ancienne version a copiées (TCGplayer est retiré) : servies si le
 * volume les a, jamais plus copiées.
 */
const LEGACY = /^\/images\/cards\/tcgplayer\/\d{1,9}_(200w|in_1000x1000)\.jpg$/

/** Le fichier d'un chemin local (`/images/cards/…` → `IMAGES_DIR/cards/…`). */
const imageFile = (path: string) => join(IMAGES_DIR, path.slice('/images/'.length))

/**
 * Copie chez nous l'image d'un chemin local : `true` si elle y est (déjà, ou maintenant), `false`
 * si la source ne l'a pas (404). Une autre erreur (panne, réponse qui n'est pas une image) est
 * levée : réessayer plus tard. Écrite d'un coup : nginx ne sert jamais une image à moitié écrite.
 * `quick` : une page l'attend (copie à la demande), sans la pause de la tâche `images`, 15 s au
 * plus.
 */
export async function mirror(path: string, { quick = false } = {}): Promise<boolean> {
  const file = imageFile(path)
  if (await Bun.file(file).exists()) return true
  const url = upstreamUrl(path)!
  const response = quick ? await quickFetch(url) : await politeFetch(url)
  if (response.status === 404) return false
  if (!response.ok) throw new Error(`HTTP ${response.status} pour ${url}`)
  if (!response.headers.get('content-type')?.startsWith('image/')) {
    throw new Error(`Pas une image : ${url}`)
  }
  // Un nom à part : le serveur et la tâche `images` peuvent copier la même image en même temps.
  const temporary = `${file}.${crypto.randomUUID()}.tmp`
  await mkdir(dirname(file), { recursive: true })
  await writeFile(temporary, new Uint8Array(await response.arrayBuffer()))
  await rename(temporary, file)
  return true
}

/**
 * Gardées un an par les navigateurs (et Cloudflare), sans redemande : une image copiée ne change
 * jamais (`mirror` ne réécrit pas un fichier qui existe).
 */
const IMAGE_HEADERS = { 'Cache-Control': 'public, max-age=31536000, immutable' }
/** Les images que la source n'a pas, et quand on l'a appris : pas redemandées avant une semaine. */
const misses = new Map<string, number>()
/** Les copies en cours : deux demandes de la même image ne la téléchargent qu'une fois. */
const copies = new Map<string, Promise<boolean>>()

/**
 * Les copies à la demande menées en même temps, au plus : nginx les laisse toutes passer d'un coup
 * (`nodelay`), le serveur n'en télécharge que 4 à la fois ; les autres attendent leur tour.
 */
const MAX_COPIES = 4
let copying = 0
const queued: (() => void)[] = []

async function inTurn<T>(task: () => Promise<T>) {
  if (copying >= MAX_COPIES) await new Promise<void>((resolve) => queued.push(resolve))
  copying++
  try {
    return await task()
  } finally {
    copying--
    queued.shift()?.()
  }
}

/**
 * Un chemin plausible : chez Pokécardex, une série du catalogue et un numéro d'image jusqu'au plus
 * grand des siens, le logo d'une série du catalogue, un type de carte, une rareté connue ; un
 * Pokémon du Pokédex. Des chemins inventés ne font pas solliciter les sources.
 */
function plausible(data: Database, path: string) {
  const logo = /^\/images\/sets\/([^/]+)-/.exec(path)
  if (logo) return data.query('SELECT 1 FROM sets WHERE id = ?').get(logo[1]!) !== null
  const type = /^\/images\/types\/(\d+)\./.exec(path)
  if (type) return CARD_TYPES.has(Number(type[1]))
  const rarity = /^\/images\/rarities\/(\d+)\./.exec(path)
  if (rarity) return data.query('SELECT 1 FROM rarities WHERE id = ?').get(rarity[1]!) !== null
  const card = /^\/images\/cards\/pokecardex\/([^/]+)\/(\d+)-/.exec(path)
  if (card) {
    const { max } = data
      .query('SELECT MAX(sort) AS max FROM cards WHERE set_id = ?')
      .get(card[1]!) as { max: number | null }
    return max !== null && Number(card[2]) >= 1 && Number(card[2]) <= max
  }
  const species = /^\/images\/species\/(?:artwork\/)?(\d+)\.png$/.exec(path)
  return !species || (Number(species[1]) >= 1 && Number(species[1]) <= TOTAL_SPECIES)
}

/**
 * `/images/…` : la copie de l'image (en développement ; sur le VPS, nginx la sert lui-même), sinon
 * copiée à la demande — une référence saisie hors du catalogue, une image que la tâche `images`
 * n'a pas encore copiée. Seulement un chemin plausible (`plausible`).
 */
export async function serveImage(data: Database, request: Request) {
  const path = new URL(request.url).pathname
  const upstream = upstreamUrl(path)
  if (!upstream && !LEGACY.test(path)) return notFound()
  if (!plausible(data, path)) return notFound()
  const file = Bun.file(imageFile(path))
  if (await file.exists()) return new Response(file, { headers: IMAGE_HEADERS })
  if (!upstream) return notFound()
  if (Date.now() - (misses.get(path) ?? 0) < WEEK) return notFound()

  let copy = copies.get(path)
  if (!copy) {
    copy = inTurn(() => mirror(path, { quick: true })).finally(() => copies.delete(path))
    copies.set(path, copy)
  }
  try {
    if (await copy) return new Response(Bun.file(imageFile(path)), { headers: IMAGE_HEADERS })
    // Une liste bornée : des chemins inventés ne la font pas grossir sans fin.
    if (misses.size > 50_000) misses.clear()
    misses.set(path, Date.now())
    return notFound()
  } catch (error) {
    journal({
      topic: 'serveur',
      level: 'warn',
      message: 'Image non copiée',
      details: { image: path, raison: error instanceof Error ? error.message : String(error) },
    })
    return new Response(null, { status: 502 })
  }
}
