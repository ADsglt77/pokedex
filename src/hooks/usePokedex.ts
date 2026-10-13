import { buildPokedex, type Pokedex } from '@/lib/pokedex'
import { useCollectionStore } from '@/store/collection'
import type { CollectionData } from '@/types'

// Un seul calcul partagé par toutes les pages, refait seulement quand la collection change.
let cache: { collection: CollectionData; pokedex: Pokedex } | null = null

function getPokedex(collection: CollectionData): Pokedex {
  if (cache?.collection !== collection) cache = { collection, pokedex: buildPokedex(collection) }
  return cache.pokedex
}

/** Le Pokédex tel que l'utilisateur le voit : une entrée par espèce, progression comprise. */
export function usePokedex(): Pokedex {
  return getPokedex(useCollectionStore((state) => state.collection))
}
