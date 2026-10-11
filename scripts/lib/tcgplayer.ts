/**
 * Images des cartes japonaises du catalogue TCGplayer (catégorie « Pokemon Japan »), lues dans
 * l'export quotidien de tcgcsv.com : elles complètent celles qui manquent chez TCGdex. Règles
 * d'usage de tcgcsv : script côté serveur, User-Agent identifié, cache local (voir `net.ts`).
 */

import { tcgplayerImageBase } from '@/lib/tcgdex'
import { fetchJson } from './net'

const TCGCSV_URL = 'https://tcgcsv.com/tcgplayer/85'

interface Group {
  groupId: number
  abbreviation: string | null
}

interface Product {
  productId: number
  name: string
  extendedData?: { name: string; value: string }[]
}

/** TCGdex écrit `p` (« plus ») ce que TCGplayer écrit `+` : SM3p est SM3+. */
const tcgplayerCode = (setId: string) => setId.replace(/p$/, '+').toLowerCase()

/** `017` et `17` désignent la même carte. */
const numberKey = (number: string) => (/^\d+$/.test(number) ? String(Number(number)) : number)

/**
 * Lit les extensions demandées dans TCGplayer et rend une recherche d'image par extension TCGdex
 * et numéro, ou `null` quand TCGplayer n'a pas la carte.
 */
export async function tcgplayerImages(setIds: Iterable<string>) {
  const { results: groups } = await fetchJson<{ results: Group[] }>(
    `${TCGCSV_URL}/groups`,
    'tcgcsv',
  )
  const images = new Map<string, string>()

  for (const setId of new Set(setIds)) {
    // Une extension peut être répartie sur plusieurs groupes (SM1+).
    const matching = groups.filter(
      (group) => group.abbreviation?.toLowerCase() === tcgplayerCode(setId),
    )
    for (const { groupId } of matching) {
      const { results } = await fetchJson<{ results: Product[] }>(
        `${TCGCSV_URL}/${groupId}/products`,
        'tcgcsv',
      )
      // Les variantes (« (Master Ball Pattern) »…) d'abord : la carte normale, lue après, l'emporte.
      const ordered = [...results].sort(
        (a, b) => Number(!a.name.includes('(')) - Number(!b.name.includes('(')),
      )
      for (const product of ordered) {
        const number = product.extendedData?.find((data) => data.name === 'Number')?.value
        // Un produit sans numéro est un produit scellé (booster, coffret), pas une carte.
        if (!number) continue
        const key = `${setId}#${numberKey(number.split('/')[0]!.trim())}`
        images.set(key, tcgplayerImageBase(product.productId))
      }
    }
  }

  return (setId: string, number: string) => images.get(`${setId}#${numberKey(number)}`) ?? null
}
