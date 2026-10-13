import { useState } from 'react'
import { findCardImage, imageLoads } from '@/lib/card-images'
import { isCardmarketImage, parseCardmarketLink, readCardmarketId } from '@/lib/cardmarket'
import { parseLink } from '@/lib/format'
import { loadPriceHistory } from '@/store/prices'
import type { CardImage, PokemonCard } from '@/types'

/** Ce que le favori a lu de Cardmarket, pour une carte à ajouter. */
export interface CardStart {
  cardmarket?: number
  reference?: string
  page?: string
}

/** L'image enregistrée est celle que la référence retrouve chez TCGdex : elle la suit. */
const isFoundImage = (card: PokemonCard) =>
  findCardImage(card.reference)?.large === card.image?.large

/**
 * La saisie d'une carte : l'adresse de son image (vide : celle que TCGdex a d'après la référence),
 * son id Cardmarket, sa référence, sa page chez Cardmarket. `card` : la carte à corriger ;
 * `start` : ce que le favori a lu de Cardmarket.
 */
export function useCardDraft(card: PokemonCard | null, start: CardStart = {}) {
  // Tiré une fois : deux clics sur « Enregistrer » écrivent la même carte, pas deux.
  const [id] = useState(() => card?.id ?? `manual:${crypto.randomUUID()}`)
  const [image, setImage] = useState(() =>
    card?.image && !isFoundImage(card) ? card.image.large : '',
  )
  const [cardmarketText, setCardmarketText] = useState(
    String(card?.cardmarket ?? start.cardmarket ?? ''),
  )
  const [reference, setReference] = useState(card?.reference ?? start.reference ?? '')
  const [page, setPage] = useState(card?.page ?? start.page ?? '')
  const [submitted, setSubmitted] = useState(false)
  // L'id vérifié chez Cardmarket et la référence dont on cherche l'image : ceux de départ, puis
  // ceux saisis, en quittant le champ (pas à chaque touche).
  const [checked, setChecked] = useState(card?.cardmarket ?? start.cardmarket ?? null)
  const [searched, setSearched] = useState(reference)

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
  const pasted: CardImage | null =
    imageUrl && !errors.image ? { small: imageUrl.href, large: imageUrl.href } : null
  const found = image.trim() ? null : findCardImage(searched)

  /**
   * La carte saisie, pour les Pokémon `dexIds` ; `null` tant qu'un champ est illisible (ses
   * erreurs s'affichent alors). Sans référence notée, le nom de la carte chez Cardmarket, sinon
   * `fallback` ; une référence qui n'était que le nom de l'ancien id suit l'id corrigé. Sans
   * adresse collée, l'image de TCGdex, si elle existe.
   */
  async function read(dexIds: number[], fallback: string): Promise<PokemonCard | null> {
    setSubmitted(true)
    if (cardmarket === undefined || errors.image || errors.page) return null
    const known = cardmarket === null ? null : await loadPriceHistory(cardmarket)
    const previous = card?.cardmarket === undefined ? null : await loadPriceHistory(card.cardmarket)
    const typed = reference.trim()
    const stale = cardmarket !== card?.cardmarket && typed === previous?.name
    const candidate = image.trim() ? null : findCardImage(typed)
    const picture = pasted ?? (candidate && (await imageLoads(candidate.small)) ? candidate : null)
    return {
      id,
      dexIds,
      reference: (!stale && typed) || known?.name || fallback,
      image: picture,
      ...(cardmarket !== null && { cardmarket }),
      ...(pageUrl && { page: pageUrl }),
    }
  }

  return {
    image,
    setImage,
    /** L'image de l'aperçu : l'adresse collée, sinon celle cherchée chez TCGdex. */
    picture: pasted ?? found,
    /** L'image cherchée chez TCGdex d'après la référence, quand aucune adresse n'est collée. */
    found,
    cardmarketText,
    setCardmarketText,
    /** L'id à vérifier chez Cardmarket, une fois le champ quitté ; `null` sinon. */
    checkedId: typeof cardmarket === 'number' && cardmarket === checked ? cardmarket : null,
    check: () => setChecked(cardmarket ?? null),
    reference,
    setReference,
    searchImage: () => setSearched(reference),
    page,
    setPage,
    // L'id se signale tout de suite ; l'image et la page, à l'enregistrement.
    errors: submitted ? errors : { ...errors, image: undefined, page: undefined },
    read,
  }
}

export type CardDraft = ReturnType<typeof useCardDraft>
