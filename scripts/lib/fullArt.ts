/**
 * La pleine carte vue sur l'image, pour les cartes que leur rareté ne départage pas (promos, decks,
 * « Common » des collections…). Une carte ordinaire a une fenêtre d'illustration : des bords droits
 * (bas de la fenêtre, côtés) et, dessous, un fond presque uni ; une pleine carte n'en a pas.
 * Quatre mesures par vignette TCGplayer (200 px), et une régression logistique entraînée à chaque
 * construction sur les cartes que leur rareté classe déjà. Les mesures sont gardées en cache
 * (`scripts/.cache/art-measures.json`), pas les images : une vignette ne change pas.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import jpeg from 'jpeg-js'
import { mapPool, refresh } from './net'

/** Couleur dominante du fond des attaques, écart des couleurs, bord bas et bords de la fenêtre. */
export type Measures = [dominant: number, spread: number, hline: number, vline: number]

/**
 * Au-dessus de `FULL_ART`, une pleine carte ; entre `UNSURE` et `FULL_ART`, à revoir à l'œil.
 * Choisis en regardant 150 cartes : au-dessus de 0,75, des pleines cartes ; dessous, surtout des
 * cartes holo à fenêtre.
 */
export const FULL_ART = 0.75
export const UNSURE = 0.5

const CACHE_FILE = join(import.meta.dirname, '..', '.cache', 'art-measures.json')
const thumbnail = (productId: number) =>
  `https://tcgplayer-cdn.tcgplayer.com/product/${productId}_200w.jpg`

/** Les mesures d'une vignette (JPEG). */
function measure(bytes: Uint8Array): Measures {
  const { width, height, data } = jpeg.decode(bytes, { useTArray: true })
  const gray = (x: number, y: number) => {
    const i = (y * width + x) * 4
    return 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
  }

  // Le fond de la zone des attaques, texte (sombre) mis à part : sa couleur dominante, son écart.
  const pixels: [number, number, number][] = []
  for (let y = Math.round(height * 0.58); y < Math.round(height * 0.85); y++) {
    for (let x = Math.round(width * 0.1); x < Math.round(width * 0.9); x++) {
      const i = (y * width + x) * 4
      const pixel: [number, number, number] = [data[i]!, data[i + 1]!, data[i + 2]!]
      if (pixel[0] + pixel[1] + pixel[2] >= 200) pixels.push(pixel)
    }
  }
  const buckets = new Map<number, number>()
  for (const [r, g, b] of pixels) {
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  const [top = 0] = [...buckets].sort((a, b) => b[1] - a[1])[0] ?? []
  let near = 0
  for (const [key, count] of buckets) {
    const close = [8, 4, 0].every(
      (shift) => Math.abs(((key >> shift) & 15) - ((top >> shift) & 15)) <= 1,
    )
    if (close) near += count
  }
  const median = [0, 1, 2].map(
    (c) => pixels.map((p) => p[c]!).sort((a, b) => a - b)[pixels.length >> 1] ?? 0,
  )
  const spread =
    pixels.reduce(
      (sum, p) => sum + Math.hypot(p[0] - median[0]!, p[1] - median[1]!, p[2] - median[2]!),
      0,
    ) / Math.max(pixels.length, 1)

  // Le bord bas de la fenêtre : un saut de luminosité au même rang sur presque toute la largeur.
  const x0 = Math.round(width * 0.14)
  const x1 = Math.round(width * 0.86)
  let hline = 0
  for (let y = Math.round(height * 0.36); y < Math.round(height * 0.64); y++) {
    let run = 0
    for (let x = x0; x < x1; x++) {
      run = Math.abs(gray(x, y + 1) - gray(x, y - 1)) > 18 ? run + 1 : 0
      hline = Math.max(hline, run / (x1 - x0))
    }
  }

  // Les côtés de la fenêtre, dans la moitié haute : le plus faible des deux bords verticaux.
  const y0 = Math.round(height * 0.14)
  const y1 = Math.round(height * 0.46)
  const side = (from: number, to: number) => {
    let best = 0
    for (let x = from; x < to; x++) {
      let run = 0
      for (let y = y0; y < y1; y++) {
        run = Math.abs(gray(x + 1, y) - gray(x - 1, y)) > 18 ? run + 1 : 0
        best = Math.max(best, run / (y1 - y0))
      }
    }
    return best
  }
  const vline = Math.min(
    side(Math.round(width * 0.03), Math.round(width * 0.16)),
    side(Math.round(width * 0.84), Math.round(width * 0.97)),
  )
  return [near / Math.max(pixels.length, 1), spread / 100, hline, vline]
}

/**
 * Les mesures des cartes, depuis le cache ; les vignettes manquantes sont téléchargées (8 à la fois).
 * Une carte sans vignette (le CDN répond 403 ou 404) n'est pas jugée sur l'image, et le cache s'en
 * souvient jusqu'au prochain `--refresh` ; une erreur passagère (réseau, 5xx) sera retentée.
 */
export async function measureCards(productIds: readonly number[]): Promise<Map<number, Measures>> {
  const cache: Record<string, Measures | null> = await readFile(CACHE_FILE, 'utf8').then(
    JSON.parse,
    () => ({}),
  )
  const missing = [...new Set(productIds)].filter(
    (id) => !(id in cache) || (refresh && cache[id] === null),
  )
  if (missing.length) console.log(`  ${missing.length} vignettes à mesurer…`)
  await mapPool(missing, 8, async (id) => {
    await new Promise((resolve) => setTimeout(resolve, 100))
    const response = await fetch(thumbnail(id), {
      headers: { 'User-Agent': 'pokedex-perso/1.0 (bun run data)' },
    }).catch(() => null)
    if (response?.ok) cache[id] = measure(new Uint8Array(await response.arrayBuffer()))
    else if (response?.status === 403 || response?.status === 404) cache[id] = null
  })
  if (missing.length) {
    await mkdir(dirname(CACHE_FILE), { recursive: true })
    await writeFile(CACHE_FILE, JSON.stringify(cache))
  }
  return new Map(productIds.flatMap((id) => (cache[id] ? [[id, cache[id]] as const] : [])))
}

const features = ([dominant, spread, hline, vline]: Measures) => [
  1,
  dominant,
  spread,
  hline,
  vline,
  hline * vline,
]
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

/** Une régression logistique, par descente de gradient (3 000 passes, pas de 4). */
function train(samples: readonly { measures: Measures; full: boolean }[]) {
  let weights = [0, 0, 0, 0, 0, 0]
  const predict = (x: number[]) => sigmoid(x.reduce((sum, v, i) => sum + v * weights[i]!, 0))
  const rows = samples.map(({ measures, full }) => ({ x: features(measures), y: Number(full) }))
  for (let epoch = 0; epoch < 3000; epoch++) {
    const gradient = [0, 0, 0, 0, 0, 0]
    for (const { x, y } of rows) {
      const error = predict(x) - y
      x.forEach((v, i) => (gradient[i] = gradient[i]! + error * v))
    }
    weights = weights.map((w, i) => w - (4 * gradient[i]!) / rows.length)
  }
  return (measures: Measures) => predict(features(measures))
}

/**
 * Le détecteur entraîné sur des cartes classées par leur rareté ; `agreement` : la part de cartes
 * qu'il classe comme leur rareté, chacune jugée par un modèle qui ne l'a pas vue (5 parts).
 */
export function trainDetector(samples: readonly { measures: Measures; full: boolean }[]) {
  let agreed = 0
  for (let part = 0; part < 5; part++) {
    const score = train(samples.filter((_, i) => i % 5 !== part))
    for (const { measures, full } of samples.filter((_, i) => i % 5 === part)) {
      if (score(measures) > 0.5 === full) agreed++
    }
  }
  return { score: train(samples), agreement: agreed / samples.length }
}
