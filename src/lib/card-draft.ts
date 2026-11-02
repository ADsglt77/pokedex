/**
 * La saisie d'une carte (`useCardDraft`), sans React : les erreurs de ses champs (`draftErrors`),
 * et la carte qu'elle donne à l'enregistrement, une fois lus les noms chez Cardmarket et l'image
 * (`draftCard`, testé : quand l'id Cardmarket est corrigé, la référence et la page qui n'étaient
 * que celles de l'ancien id le suivent).
 */

import { isSourceImage } from '@/lib/card-images'
import { isCardmarketImage } from '@/lib/cardmarket'
import { languageField } from '@/lib/collection'
import type { CardImage, CardLanguage, PokemonCard } from '@/types'

/**
 * Les erreurs des champs : l'adresse de l'image (`image`, lue : `imageUrl`), l'id Cardmarket lu
 * (`readCardmarketId`) et la page (`page`, lue : `pageUrl`) ; un champ vide n'en a pas.
 */
export const draftErrors = ({
  image,
  imageUrl,
  cardmarket,
  page,
  pageUrl,
}: {
  image: string
  imageUrl: URL | null
  cardmarket: number | null | undefined
  page: string
  pageUrl: string | null
}) => ({
  image: !image.trim()
    ? undefined
    : !imageUrl
      ? 'Une adresse web : https://…'
      : isCardmarketImage(imageUrl)
        ? 'Cardmarket n’affiche ses images que sur son site : prenez-en une ailleurs.'
        : isSourceImage(imageUrl.href)
          ? 'Cette image ne s’affiche pas ici : laissez le champ vide, elle sera retrouvée.'
          : undefined,
  cardmarket: cardmarket === undefined ? 'Un nombre : l’id du produit chez Cardmarket.' : undefined,
  page: page.trim() && !pageUrl ? 'Collez une adresse de www.cardmarket.com.' : undefined,
})

/**
 * La carte saisie, pour les Pokémon `dexIds` (`language: 'fr'` si elle est française, rien si elle
 * est japonaise). Sans référence notée, `name` (celui de l'id chez Cardmarket), sinon `fallback`.
 * L'id changé depuis `initial` (celui de la carte corrigée), une référence qui n'était que
 * `previousName` (le nom de l'ancien id) suit l'id corrigé, et une page qui n'était que celle de
 * départ est oubliée (le lien suit alors l'id). L'image : l'adresse collée (`pasted`), sinon celle
 * retrouvée d'après la référence (`found`), sinon celle déjà enregistrée (`kept`).
 */
export function draftCard({
  id,
  dexIds,
  fallback,
  language,
  reference,
  cardmarket,
  initial,
  page,
  pageUrl,
  pasted,
  found,
  kept,
  name,
  previousName,
}: {
  id: string
  dexIds: number[]
  fallback: string
  language: CardLanguage
  /** La référence notée, sans les espaces autour. */
  reference: string
  cardmarket: number | null
  /** L'id et la page de départ : ceux de la carte corrigée. */
  initial: { cardmarket: number | null; page: string }
  /** La page telle que collée, et lue (`parseCardmarketLink`). */
  page: string
  pageUrl: string | null
  pasted: CardImage | null
  found: CardImage | null
  kept: CardImage | null
  /** Le nom de l'id saisi chez Cardmarket, et celui de l'ancien id s'il a changé. */
  name: string | null
  previousName: string | null
}): PokemonCard {
  const changedId = cardmarket !== initial.cardmarket
  const stale = changedId && reference === previousName
  const stalePage = changedId && page.trim() === initial.page
  // L'image gardée (`kept`), pas si la référence n'était que le nom de l'ancien id : elle devient
  // celle d'une autre carte.
  const picture = pasted ?? found ?? (stale ? null : kept)
  return {
    id,
    dexIds,
    reference: (!stale && reference) || name || fallback,
    image: picture,
    ...languageField(language),
    ...(cardmarket !== null && { cardmarket }),
    ...(pageUrl && !stalePage && { page: pageUrl }),
  }
}
