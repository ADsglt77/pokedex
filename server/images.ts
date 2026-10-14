/**
 * Les images, copiées chez nous (`IMAGES_DIR`, le volume `images` sur le VPS ; nginx les sert à
 * `/images/…`) : les cartes chez Pokécardex (avec son accord, qui demande de les héberger chez
 * nous), les sprites et illustrations des Pokémon chez PokéAPI. Chaque chemin local correspond à une seule adresse
 * d'origine (`upstreamUrl`) : le navigateur garde les adresses d'origine dans la collection et ne
 * demande que leur chemin local (`localSrc`, `src/lib/card-images.ts`). Seuls ces chemins-là sont
 * copiés : le serveur n'est pas un relais ouvert.
 */

import { mkdir, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { WEEK } from '@/lib/time'
import { DATA_DIR } from './db'
import { politeFetch } from './lib/net'

const IMAGES_DIR = process.env.IMAGES_DIR ?? join(DATA_DIR, 'images')

const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'

/** Les chemins locaux connus, et l'adresse d'origine de chacun. */
const UPSTREAMS: [RegExp, (...parts: string[]) => string][] = [
  [
    /^\/images\/cards\/pokecardex\/([A-Z0-9_-]+)\/([A-Z0-9]+)-(md|hd)\.webp$/,
    (set, number, size) =>
      `https://pokecardex-scans.b-cdn.net/sets_jp/${set}/${number}.jpg?class=${size}`,
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

const exists = (file: string) =>
  stat(file).then(
    () => true,
    () => false,
  )

/**
 * Copie chez nous l'image d'un chemin local : `true` si elle y est (déjà, ou maintenant), `false`
 * si la source ne l'a pas (404). Une autre erreur (panne, réponse qui n'est pas une image) est
 * levée : réessayer plus tard. Écrite d'un coup : nginx ne sert jamais une image à moitié écrite.
 */
export async function mirror(path: string): Promise<boolean> {
  const file = imageFile(path)
  if (await exists(file)) return true
  const url = upstreamUrl(path)!
  const response = await politeFetch(url)
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

/** Gardées un mois par les navigateurs (et Cloudflare) : une image ne change pas. */
const IMAGE_HEADERS = { 'Cache-Control': 'public, max-age=2592000' }
/** Les images que la source n'a pas, et quand on l'a appris : pas redemandées avant une semaine. */
const misses = new Map<string, number>()
/** Les copies en cours : deux demandes de la même image ne la téléchargent qu'une fois. */
const copies = new Map<string, Promise<boolean>>()

/**
 * `/images/…` : la copie de l'image (en développement ; sur le VPS, nginx la sert lui-même), sinon
 * copiée à la demande — une référence saisie hors du catalogue, une image que la tâche `images`
 * n'a pas encore copiée.
 */
export async function serveImage(request: Request) {
  const path = new URL(request.url).pathname
  const notFound = () =>
    new Response(null, { status: 404, headers: { 'Cache-Control': 'no-cache' } })
  const upstream = upstreamUrl(path)
  if (!upstream && !LEGACY.test(path)) return notFound()
  const file = Bun.file(imageFile(path))
  if (await file.exists()) return new Response(file, { headers: IMAGE_HEADERS })
  if (!upstream) return notFound()
  if (Date.now() - (misses.get(path) ?? 0) < WEEK) return notFound()

  let copy = copies.get(path)
  if (!copy) {
    copy = mirror(path).finally(() => copies.delete(path))
    copies.set(path, copy)
  }
  try {
    if (await copy) return new Response(Bun.file(imageFile(path)), { headers: IMAGE_HEADERS })
    // Une liste bornée : des chemins inventés ne la font pas grossir sans fin.
    if (misses.size > 50_000) misses.clear()
    misses.set(path, Date.now())
    return notFound()
  } catch (error) {
    console.warn(`Image ${path} :`, error instanceof Error ? error.message : error)
    return new Response(null, { status: 502 })
  }
}
