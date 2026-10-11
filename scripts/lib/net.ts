/**
 * Réseau des scripts de données : un `fetch` JSON avec un cache disque (`scripts/.cache`, pour
 * relancer un script sans solliciter les API à nouveau) et une file à concurrence limitée.
 * Chaque requête s'identifie et attend 100 ms : certaines API (tcgcsv.com) l'exigent.
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const CACHE_ROOT = join(import.meta.dirname, '..', '.cache')

/** `--refresh` : ignore le cache et redemande tout. */
const refresh = process.argv.includes('--refresh')

class NotFoundError extends Error {}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const USER_AGENT = 'pokedex-perso/1.0 (bun run data)'

async function politeFetch(url: string, init?: RequestInit) {
  await wait(100)
  return fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...init?.headers } })
}

/** Document JSON, lu dans le cache s'il a déjà été téléchargé. `namespace` : un dossier par API. */
export async function fetchJson<T>(url: string, namespace: string, init?: RequestInit): Promise<T> {
  const body = typeof init?.body === 'string' ? init.body : ''
  const key = createHash('sha1')
    .update(`${init?.method ?? 'GET'} ${url}\n${body}`)
    .digest('hex')
  const file = join(CACHE_ROOT, namespace, `${key}.json`)

  if (!refresh) {
    try {
      return JSON.parse(await readFile(file, 'utf8')) as T
    } catch {
      // Pas encore en cache.
    }
  }

  for (let attempt = 0; ; attempt++) {
    try {
      const response = await politeFetch(url, init)
      // Un 404 est une réponse : réessayer n'y changerait rien.
      if (response.status === 404) throw new NotFoundError(`404 pour ${url}`)
      if (!response.ok) throw new Error(`HTTP ${response.status} pour ${url}`)
      const text = await response.text()
      const data = JSON.parse(text) as T
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, text, 'utf8')
      return data
    } catch (error) {
      if (error instanceof NotFoundError || attempt === 4) throw error
      await wait(500 * 2 ** attempt)
    }
  }
}

/** Une adresse répond-elle 200 ? Le résultat est gardé en cache comme les documents JSON. */
export async function urlExists(url: string, namespace: string): Promise<boolean> {
  const key = createHash('sha1').update(`HEAD ${url}`).digest('hex')
  const file = join(CACHE_ROOT, namespace, `${key}.json`)
  if (!refresh) {
    const cached = await readFile(file, 'utf8').catch(() => null)
    if (cached !== null) return cached === 'true'
  }
  const response = await politeFetch(url, { method: 'HEAD' })
  if (response.status >= 500) throw new Error(`HTTP ${response.status} pour ${url}`)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, String(response.ok), 'utf8')
  return response.ok
}

/** `task` sur chaque élément, au plus `concurrency` à la fois ; les résultats gardent l'ordre. */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await task(items[index]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}
