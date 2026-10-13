/**
 * Le catalogue des cartes Pokémon japonaises (`bun run data:catalog`, depuis TCGdex) : pour chaque
 * Pokémon, ses cartes, des plus récentes aux plus anciennes, et les extensions (nom japonais, date
 * de sortie). Un fichier à part, chargé au premier choix d'une carte. Aucun tri ni détection :
 * l'utilisateur choisit, l'app ne propose rien seule.
 */

import { getSpecies } from '@/lib/species'

/** [extension, numéro, id Cardmarket (0 : inconnu), suffixe, ses Pokémon s'ils sont plusieurs] */
type Row = [string, string, number, string, number[]?]

interface CatalogFile {
  sets: Record<string, [name: string, released: string]>
  cards: Partial<Record<string, Row[]>>
}

/** Une extension du catalogue. */
export interface CatalogSet {
  id: string
  /** Son nom japonais : « ポケモンカード151 ». */
  name: string
  /** Son année de sortie ; `null` si TCGdex ne la donne pas. */
  year: string | null
}

/** Une carte du catalogue : de quoi la montrer et la reprendre dans la saisie. */
export interface CatalogCard {
  /** « SV2a 166 » : l'extension et le numéro, uniques. */
  key: string
  set: CatalogSet
  /** Ses Pokémon : un seul, sauf une carte TAG TEAM. */
  dexIds: number[]
  /** L'id Cardmarket, pour le prix et le lien ; absent si TCGdex ne le connaît pas. */
  cardmarket?: number
  /** « Pikachu ex (SV8 033) », « Pikachu & Zekrom GX (SM9 031) » : d'où son image est retrouvée. */
  reference: string
}

/** Tout le catalogue, lu une fois : les extensions et les cartes par Pokémon. */
export interface Catalog {
  /** Les extensions, des plus récentes aux plus anciennes. */
  sets: CatalogSet[]
  bySpecies: Map<number, CatalogCard[]>
}

function readCatalog(file: CatalogFile): Catalog {
  const sets = new Map(
    Object.entries(file.sets).map(([id, [name, released]]) => [
      id,
      { id, name, year: released.slice(0, 4) || null },
    ]),
  )
  const bySpecies = new Map<number, CatalogCard[]>()
  for (const [speciesId, rows] of Object.entries(file.cards)) {
    const id = Number(speciesId)
    bySpecies.set(
      id,
      rows!.map(([set, number, cardmarket, suffix, dexIds = [id]]) => {
        const names = dexIds.map((dexId) => getSpecies(dexId)!.names.fr).join(' & ')
        return {
          key: `${set} ${number}`,
          set: sets.get(set) ?? { id: set, name: set, year: null },
          dexIds,
          cardmarket: cardmarket || undefined,
          reference: `${names}${suffix && ` ${suffix}`} (${set} ${number})`,
        }
      }),
    )
  }
  return { sets: [...sets.values()], bySpecies }
}

let catalog: Promise<Catalog> | null = null

/** Le catalogue. Toujours la même promesse, lue par `use()`. */
export function loadCatalog() {
  catalog ??= import('@/data/catalog.json').then(({ default: file }) =>
    readCatalog(file as unknown as CatalogFile),
  )
  return catalog
}

/** Les cartes d'une extension, tous Pokémon confondus, dans l'ordre des numéros (une fois chacune). */
export function setCards(catalog: Catalog, setId: string): CatalogCard[] {
  const cards = new Map<string, CatalogCard>()
  for (const list of catalog.bySpecies.values()) {
    for (const card of list) if (card.set.id === setId) cards.set(card.key, card)
  }
  return [...cards.values()].sort((a, b) => a.key.localeCompare(b.key, 'en', { numeric: true }))
}
