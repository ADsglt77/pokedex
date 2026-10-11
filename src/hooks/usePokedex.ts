import { buildPokedex, type Pokedex } from '@/lib/pokedex'
import { useCollectionStore } from '@/store/collection'
import type { CollectionData } from '@/types'

// Un seul calcul partagé par toutes les pages, refait seulement quand une de ses sources change.
let cache: { collection: CollectionData; codes: readonly string[]; pokedex: Pokedex } | null = null

function getPokedex(collection: CollectionData, codes: readonly string[]): Pokedex {
  if (cache?.collection !== collection || cache.codes !== codes) {
    cache = { collection, codes, pokedex: buildPokedex(collection, codes) }
  }
  return cache.pokedex
}

/** Le Pokédex tel que l'utilisateur le voit : une entrée par espèce, progression comprise. */
export function usePokedex(): Pokedex {
  const collection = useCollectionStore((state) => state.collection)
  const codes = useCollectionStore((state) => state.settings.enabledRarityCodes)
  return getPokedex(collection, codes)
}
