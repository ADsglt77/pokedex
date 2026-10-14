/**
 * Réseau des tâches d'ingestion et des scripts de données : un `fetch` JSON avec un cache disque
 * (`CACHE_DIR`, sinon `.data/cache` : pour relancer une tâche sans solliciter les API à nouveau)
 * et une file à concurrence limitée. Chaque requête s'identifie et attend 100 ms avant de partir.
 * Un 404 arrête la tâche. Une réponse en cache sert tant qu'elle a moins de `maxAge` ms (sans
 * limite par défaut) ; `--refresh` redemande tout.
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { DATA_DIR } from '../db'

const CACHE_ROOT = process.env.CACHE_DIR ?? join(DATA_DIR, 'cache')

/** `--refresh` : ignore le cache et redemande tout. */
export const refresh = process.argv.includes('--refresh')

class NotFoundError extends Error {}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const USER_AGENT = 'pokedex-perso/1.0 (bun run data)'

/** Une requête identifiée, après 100 ms d'attente : pour une API qui le demande (tcgcsv). */
export async function politeFetch(url: string, init?: RequestInit) {
  await wait(100)
  return fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...init?.headers } })
}

/**
 * Document JSON, lu dans le cache s'il y a été mis il y a moins de `maxAge` ms. `namespace` : un
 * dossier par API.
 */
export async function fetchJson<T>(
  url: string,
  namespace: string,
  init?: RequestInit,
  maxAge = Infinity,
): Promise<T> {
  const body = typeof init?.body === 'string' ? init.body : ''
  const key = createHash('sha1')
    .update(`${init?.method ?? 'GET'} ${url}\n${body}`)
    .digest('hex')
  const file = join(CACHE_ROOT, namespace, `${key}.json`)

  if (!refresh) {
    try {
      if (Date.now() - (await stat(file)).mtimeMs < maxAge) {
        return JSON.parse(await readFile(file, 'utf8')) as T
      }
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
