/**
 * Le catalogue des cartes Pokémon japonaises (`/api/catalog`, que la tâche `catalog` construit
 * d'après Pokécardex) : pour chaque Pokémon, ses cartes, des plus récentes aux plus anciennes, et
 * les séries (nom, date de sortie). Chargé par la fenêtre d'ajout et la page Catalogue, et préparé
 * d'avance par la fiche d'un Pokémon sans carte (quand le navigateur est libre). Aucun tri ni
 * détection : l'utilisateur choisit, l'app ne propose rien seule. Il donne aussi l'image exacte
 * d'une carte chez Pokécardex (`findCardImage`).
 */

import { derived } from '@/lib/api'
import { codeKey, referenceCode } from '@/lib/card-code'
import { cardImage, localSrc, pokecardexImage } from '@/lib/card-images'
import { settled } from '@/lib/settled'
import { getSpecies } from '@/lib/species'
import type { CardImage, CatalogFile } from '@/types'

/** Une série du catalogue. */
interface CatalogSet {
  /** Son code chez Pokécardex : « SV2A ». */
  id: string
  /** Son nom : « Pokémon Card 151 ». */
  name: string
  /** Son année de sortie ; `null` si Pokécardex ne la donne pas. */
  year: string | null
}

/** Une carte du catalogue : de quoi la montrer et la reprendre dans la saisie. */
export interface CatalogCard {
  /** « SV2A 166 » : la série et le numéro, uniques. */
  key: string
  set: CatalogSet
  /** Ses Pokémon : un seul, sauf une carte TAG TEAM. */
  dexIds: number[]
  /** L'id Cardmarket, pour le prix et le lien ; absent si Pokécardex ne le connaît pas. */
  cardmarket?: number
  /** « Pikachu ex (SV8 033) », « Pikachu & Zekrom GX (SM9 031) » : son nom et son code. */
  reference: string
  /** Son image chez Pokécardex ; `null` s'il ne l'a pas. */
  image: CardImage | null
}

/** Tout le catalogue, lu une fois : les séries et les cartes par Pokémon. */
export interface Catalog {
  /** Les séries, des plus récentes aux plus anciennes. */
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
  // Une carte TAG TEAM est la même pour chacun de ses Pokémon.
  const cards = new Map<string, CatalogCard>()
  for (const [speciesId, rows] of Object.entries(file.cards)) {
    const id = Number(speciesId)
    bySpecies.set(
      id,
      rows!.map(([set, number, cardmarket, name, image, dexIds = [id]]) => {
        const key = `${set} ${number}`
        let card = cards.get(key)
        if (!card) {
          const names = name || dexIds.map((dexId) => getSpecies(dexId)!.names.fr).join(' & ')
          card = {
            key,
            set: sets.get(set)!,
            dexIds,
            cardmarket: cardmarket || undefined,
            reference: `${names} (${set} ${number})`,
            image: image ? pokecardexImage(set, image) : null,
          }
          cards.set(key, card)
          byCode.set(codeKey({ set, number }), card)
        }
        return card
      }),
    )
  }
  return { sets: [...sets.values()], bySpecies, byCode }
}

/**
 * Le catalogue ; `null` s'il n'est pas disponible (serveur arrêté, base encore vide : redemandé une
 * minute après au plus tôt, `getJson`). Toujours la même promesse, lue par `use()`.
 */
export const loadCatalog = derived<CatalogFile, Catalog | null>(
  '/api/catalog',
  (file) => file && readCatalog(file),
)

/** Une série dans une liste de choix : « SV2A · Pokémon Card 151 (2023) ». */
export const setOption = ({ id, name, year }: CatalogSet) => ({
  value: id,
  label: `${id} · ${name}${year ? ` (${year})` : ''}`,
})

/** La carte du catalogue d'une référence (« Herbizarre (OR1 2) ») ; `null` si aucune. */
function catalogCard(catalog: Catalog, reference: string): CatalogCard | null {
  const code = referenceCode(reference)
  return (code && catalog.byCode.get(codeKey(code))) ?? null
}

/** Les cartes d'une série, tous Pokémon confondus, dans l'ordre des numéros (une fois chacune). */
export function setCards(catalog: Catalog, setId: string): CatalogCard[] {
  const cards = new Map<string, CatalogCard>()
  for (const list of catalog.bySpecies.values()) {
    for (const card of list) if (card.set.id === setId) cards.set(card.key, card)
  }
  return [...cards.values()].sort((a, b) => a.key.localeCompare(b.key, 'en', { numeric: true }))
}

const found = new Map<string, Promise<CardImage | null>>()
const missing = new Set<string>()

/** `true` si l'image se charge (sa copie chez nous) ; `false` sans réponse en 10 s. */
const loads = (image: CardImage) =>
  new Promise<boolean>((resolve) => {
    const probe = new Image()
    const timer = setTimeout(() => {
      probe.onload = probe.onerror = null
      resolve(false)
    }, 10_000)
    probe.onload = () => {
      clearTimeout(timer)
      resolve(true)
    }
    probe.onerror = () => {
      clearTimeout(timer)
      resolve(false)
    }
    probe.src = localSrc(image.small)
  })

/**
 * L'image de la carte chez Pokécardex, si sa copie se charge (le serveur la copie à la première
 * demande) : celle que le catalogue donne à cette référence (son adresse exacte), sinon celle que
 * la référence désigne (`cardImage`) ; `null` si Pokécardex ne l'a pas. La même promesse pour la
 * même référence (ce qu'attend `use`). `retry`, au moment d'enregistrer, redemande une image qui a
 * échoué : une panne passagère ne doit pas compter pour une image absente. Sans réponse en 10 s,
 * elle compte pour absente : l'enregistrement, qui l'attend, ne reste pas bloqué.
 */
export function findCardImage(reference: string, { retry = false } = {}) {
  let promise = found.get(reference)
  if (!promise || (retry && missing.has(reference))) {
    promise = settled(
      loadCatalog().then(async (catalog) => {
        const listed = catalog && catalogCard(catalog, reference)
        // Une carte du catalogue sans image chez Pokécardex : rien à chercher.
        const image = listed ? listed.image : cardImage(reference)
        if (image && (await loads(image))) {
          missing.delete(reference)
          return image
        }
        if (image) missing.add(reference)
        return null
      }),
    )
    found.set(reference, promise)
  }
  return promise
}
