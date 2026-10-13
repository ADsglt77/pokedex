import { useState } from 'react'
import { isCardmarketImage, parseCardmarketLink, readCardmarketId } from '@/lib/cardmarket'
import { parseLink } from '@/lib/format'
import { loadPriceHistory } from '@/store/prices'
import type { PokemonCard } from '@/types'

/** Ce que le favori a lu de Cardmarket, pour une carte à ajouter. */
export interface CardStart {
  cardmarket?: number
  reference?: string
  page?: string
}

/**
 * La saisie d'une carte : l'adresse de son image, son id Cardmarket, sa référence, sa page chez
 * Cardmarket. `card` : la carte à corriger ; `start` : ce que le favori a lu de Cardmarket.
 */
export function useCardDraft(card: PokemonCard | null, start: CardStart = {}) {
  // Tiré une fois : deux clics sur « Enregistrer » écrivent la même carte, pas deux.
  const [id] = useState(() => card?.id ?? `manual:${crypto.randomUUID()}`)
  const [image, setImage] = useState(card?.image?.large ?? '')
  const [cardmarketText, setCardmarketText] = useState(
    String(card?.cardmarket ?? start.cardmarket ?? ''),
  )
  const [reference, setReference] = useState(card?.reference ?? start.reference ?? '')
  const [page, setPage] = useState(card?.page ?? start.page ?? '')
  const [submitted, setSubmitted] = useState(false)
  // L'id vérifié chez Cardmarket : celui de départ, puis celui saisi, en quittant le champ (pas à
  // chaque chiffre tapé).
  const [checked, setChecked] = useState(card?.cardmarket ?? start.cardmarket ?? null)

  const imageUrl = parseLink(image.trim())
  const cardmarket = readCardmarketId(cardmarketText)
  const pageUrl = parseCardmarketLink(page.trim())
  const errors = {
    image: !image.trim()
      ? undefined
      : !imageUrl
        ? 'Une adresse web : https://…'
        : isCardmarketImage(imageUrl)
          ? 'Cardmarket n’affiche ses images que sur son site : prenez-en une ailleurs.'
          : undefined,
    cardmarket:
      cardmarket === undefined ? 'Un nombre : l’id du produit chez Cardmarket.' : undefined,
    page: page.trim() && !pageUrl ? 'Collez une adresse de www.cardmarket.com.' : undefined,
  }

  /**
   * La carte saisie, pour les Pokémon `dexIds` ; `null` tant qu'un champ est illisible (ses
   * erreurs s'affichent alors). Sans référence notée, le nom de la carte chez Cardmarket, sinon
   * `fallback` ; une référence qui n'était que le nom de l'ancien id suit l'id corrigé.
   */
  async function read(dexIds: number[], fallback: string): Promise<PokemonCard | null> {
    setSubmitted(true)
    if (cardmarket === undefined || errors.image || errors.page) return null
    const known = cardmarket === null ? null : await loadPriceHistory(cardmarket)
    const previous = card?.cardmarket === undefined ? null : await loadPriceHistory(card.cardmarket)
    const typed = reference.trim()
    const stale = cardmarket !== card?.cardmarket && typed === previous?.name
    return {
      id,
      dexIds,
      reference: (!stale && typed) || known?.name || fallback,
      image: imageUrl && { small: imageUrl.href, large: imageUrl.href },
      ...(cardmarket !== null && { cardmarket }),
      ...(pageUrl && { page: pageUrl }),
    }
  }

  return {
    image,
    setImage,
    imageUrl: errors.image ? null : imageUrl,
    cardmarketText,
    setCardmarketText,
    /** L'id à vérifier chez Cardmarket, une fois le champ quitté ; `null` sinon. */
    checkedId: typeof cardmarket === 'number' && cardmarket === checked ? cardmarket : null,
    check: () => setChecked(cardmarket ?? null),
    reference,
    setReference,
    page,
    setPage,
    // L'id se signale tout de suite ; l'image et la page, à l'enregistrement.
    errors: submitted ? errors : { ...errors, image: undefined, page: undefined },
    read,
  }
}

export type CardDraft = ReturnType<typeof useCardDraft>
