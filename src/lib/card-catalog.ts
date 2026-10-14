/**
 * Le catalogue des cartes Pokémon japonaises (`/api/catalog`, que la tâche `catalog` construit
 * d'après TCGdex) : pour chaque Pokémon, ses cartes, des plus récentes aux plus anciennes, et les
 * extensions (nom japonais, date de sortie). Chargé au premier choix d'une carte. Aucun tri ni
 * détection : l'utilisateur choisit, l'app ne propose rien seule.
 */

import { getJson } from '@/lib/api'
import { codeKey, referenceCode } from '@/lib/card-code'
import { cardImage, tcgplayerImage } from '@/lib/card-images'
import { settled } from '@/lib/settled'
import { getSpecies } from '@/lib/species'
import type { CardImage, CatalogFile } from '@/types'

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
  /** Son image : chez Pokécardex, sinon celle de son produit TCGplayer ; `null` sans image. */
  image: CardImage | null
}

/** Tout le catalogue, lu une fois : les extensions et les cartes par Pokémon. */
export interface Catalog {
  /** Les extensions, des plus récentes aux plus anciennes. */
  sets: CatalogSet[]
  bySpecies: Map<number, CatalogCard[]>
  /** Clé : `codeKey` (« SV2A 166 »). */
  byCode: Map<string, CatalogCard>
}

function readCatalog(file: CatalogFile): Catalog {
  const sets = new Map(
    Object.entries(file.sets).map(([id, [name, released]]) => [
      id,
      { id, name, year: released.slice(0, 4) || null },
    ]),
  )
  const bySpecies = new Map<number, CatalogCard[]>()
  const byCode = new Map<string, CatalogCard>()
  for (const [speciesId, rows] of Object.entries(file.cards)) {
    const id = Number(speciesId)
    bySpecies.set(
      id,
      rows!.map(([set, number, cardmarket, suffix, image, dexIds = [id]]) => {
        const names = dexIds.map((dexId) => getSpecies(dexId)!.names.fr).join(' & ')
        const reference = `${names}${suffix && ` ${suffix}`} (${set} ${number})`
        const card = {
          key: `${set} ${number}`,
          set: sets.get(set) ?? { id: set, name: set, year: null },
          dexIds,
          cardmarket: cardmarket || undefined,
          reference,
          image:
            image === 'pokecardex'
              ? cardImage(reference)
              : image && tcgplayerImage(image.tcgplayer),
        }
        byCode.set(codeKey({ set, number }), card)
        return card
      }),
    )
  }
  return { sets: [...sets.values()], bySpecies, byCode }
}

let loaded: { response: Promise<CatalogFile | null>; catalog: Promise<Catalog | null> } | null =
  null

/**
 * Le catalogue ; `null` s'il n'est pas disponible (serveur arrêté, base encore vide : redemandé une
 * minute après au plus tôt, `getJson`). Toujours la même promesse, lue par `use()`.
 */
export function loadCatalog() {
  const response = getJson<CatalogFile>('/api/catalog')
  if (loaded?.response !== response) {
    loaded = { response, catalog: settled(response.then((file) => file && readCatalog(file))) }
  }
  return loaded.catalog
}

/** Une extension dans une liste de choix : « SV2a · ポケモンカード151 (2023) ». */
export const setOption = ({ id, name, year }: CatalogSet) => ({
  value: id,
  label: `${id} · ${name}${year ? ` (${year})` : ''}`,
})

/** La carte du catalogue d'une référence (« Herbizarre (PMCG1 008) ») ; `null` si aucune. */
export function catalogCard(catalog: Catalog, reference: string): CatalogCard | null {
  const code = referenceCode(reference)
  return (code && catalog.byCode.get(codeKey(code))) ?? null
}

/** Les cartes d'une extension, tous Pokémon confondus, dans l'ordre des numéros (une fois chacune). */
export function setCards(catalog: Catalog, setId: string): CatalogCard[] {
  const cards = new Map<string, CatalogCard>()
  for (const list of catalog.bySpecies.values()) {
    for (const card of list) if (card.set.id === setId) cards.set(card.key, card)
  }
  return [...cards.values()].sort((a, b) => a.key.localeCompare(b.key, 'en', { numeric: true }))
}
