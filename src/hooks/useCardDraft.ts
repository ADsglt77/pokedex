import { useRef, useState } from 'react'
import { cardImage, findCardImage } from '@/lib/card-images'
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

/** L'image enregistrée est celle que la référence retrouve chez Pokécardex : elle la suit. */
const isFoundImage = (card: PokemonCard) => cardImage(card.reference)?.large === card.image?.large

/**
 * La saisie d'une carte : l'adresse de son image (vide : celle retrouvée d'après la référence),
 * son id Cardmarket, sa référence, sa page chez Cardmarket. `card` : la carte à corriger ;
 * `start` : ce que le favori a lu de Cardmarket.
 */
export function useCardDraft(card: PokemonCard | null, start: CardStart = {}) {
  // Tiré une fois : deux clics sur « Enregistrer » écrivent la même carte, pas deux.
  const [id] = useState(() => card?.id ?? `manual:${crypto.randomUUID()}`)
  const [image, setImage] = useState(() =>
    card?.image && !isFoundImage(card) ? card.image.large : '',
  )
  // L'id et la page de départ : ceux de la carte, ou ceux que le favori a lus.
  const [initial] = useState(() => ({
    cardmarket: card?.cardmarket ?? start.cardmarket ?? null,
    page: card?.page ?? start.page ?? '',
  }))
  const [cardmarketText, setCardmarketText] = useState(String(initial.cardmarket ?? ''))
  const [reference, setReference] = useState(card?.reference ?? start.reference ?? '')
  const [page, setPage] = useState(initial.page)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  // L'id vérifié chez Cardmarket et la référence dont on cherche l'image : ceux de départ, puis
  // ceux saisis, en quittant le champ (pas à chaque touche).
  const [checked, setChecked] = useState(initial.cardmarket)
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
  // La référence dont on cherche l'image : aucune si une adresse est collée, ou si son extension
  // est inconnue.
  const lookup = image.trim() || !cardImage(searched) ? null : searched

  /**
   * La carte saisie, pour les Pokémon `dexIds` ; `null` tant qu'un champ est illisible (ses
   * erreurs s'affichent alors). Sans référence notée, le nom de la carte chez Cardmarket, sinon
   * `fallback` ; une référence qui n'était que le nom de l'ancien id suit l'id corrigé, et une
   * page qui n'était que celle de l'ancien id est oubliée (le lien suit alors l'id). Sans adresse
   * collée, l'image retrouvée d'après la référence, s'il y en a une.
   */
  async function read(dexIds: number[], fallback: string): Promise<PokemonCard | null> {
    setSubmitted(true)
    if (cardmarket === undefined || errors.image || errors.page) return null
    const known = cardmarket === null ? null : await loadPriceHistory(cardmarket)
    const previous = card?.cardmarket === undefined ? null : await loadPriceHistory(card.cardmarket)
    const typed = reference.trim()
    const stale = cardmarket !== card?.cardmarket && typed === previous?.name
    const stalePage = cardmarket !== initial.cardmarket && page.trim() === initial.page
    const candidate = image.trim() ? null : cardImage(typed)
    // L'image déjà enregistrée reste si Pokécardex ne répond pas : elle s'est chargée une fois.
    const kept = candidate && candidate.large === card?.image?.large ? (card?.image ?? null) : null
    const picture =
      pasted ?? (candidate ? ((await findCardImage(typed, { retry: true })) ?? kept) : null)
    return {
      id,
      dexIds,
      reference: (!stale && typed) || known?.name || fallback,
      image: picture,
      ...(cardmarket !== null && { cardmarket }),
      ...(pageUrl && !stalePage && { page: pageUrl }),
    }
  }

  /**
   * Lit la carte saisie et la passe à `done` (l'enregistrer, fermer…). Une seule fois à la fois :
   * pendant la lecture (prix, image), `saving` est vrai et un second appel ne fait rien.
   */
  async function save(dexIds: number[], fallback: string, done: (card: PokemonCard) => void) {
    if (busy.current) return
    busy.current = true
    setSaving(true)
    try {
      const saved = await read(dexIds, fallback)
      if (saved) done(saved)
    } finally {
      busy.current = false
      setSaving(false)
    }
  }

  return {
    image,
    setImage,
    /** L'image de l'adresse collée, si elle est lisible. */
    pasted,
    /** La référence dont l'image est cherchée (`findCardImage`) ; `null` : rien à chercher. */
    lookup,
    cardmarketText,
    setCardmarketText,
    /** L'id à vérifier chez Cardmarket, une fois le champ quitté ; `null` sinon. */
    checkedId: typeof cardmarket === 'number' && cardmarket === checked ? cardmarket : null,
    check: () => setChecked(cardmarket ?? null),
    reference,
    setReference,
    searchImage: () => setSearched(reference),
    /**
     * Reprend une carte choisie dans le catalogue : sa référence (d'où son image) et son id
     * Cardmarket. Une adresse d'image ou une page collées pour une autre carte ne lui vont plus.
     */
    fill: (chosen: Pick<PokemonCard, 'reference' | 'cardmarket'>) => {
      setReference(chosen.reference)
      setSearched(chosen.reference)
      setCardmarketText(String(chosen.cardmarket ?? ''))
      setChecked(chosen.cardmarket ?? null)
      setImage('')
      setPage('')
    },
    page,
    setPage,
    // L'id se signale tout de suite ; l'image et la page, à l'enregistrement.
    errors: submitted ? errors : { ...errors, image: undefined, page: undefined },
    save,
    saving,
  }
}

export type CardDraft = ReturnType<typeof useCardDraft>
