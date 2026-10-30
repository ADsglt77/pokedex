import { useCallback, useRef, useState, type RefObject } from 'react'
import { findCardImage, type CatalogCard } from '@/lib/card-catalog'
import { isFoundImage, isSourceImage } from '@/lib/card-images'
import { referenceCode } from '@/lib/card-code'
import { isCardmarketImage, parseCardmarketLink, readCardmarketId } from '@/lib/cardmarket'
import { cardLanguage, languageField, newCardId } from '@/lib/collection'
import { focusFirstError } from '@/lib/focus'
import { parseLink } from '@/lib/format'
import { loadPriceHistory } from '@/store/prices'
import type { CardImage, CardLanguage, PokemonCard } from '@/types'

/** L'image enregistrée a été retrouvée : elle suit la référence, ce n'est pas une adresse collée. */
const hasFoundImage = (card: PokemonCard) => card.image !== null && isFoundImage(card.image)

/**
 * La saisie d'une carte : sa langue, l'adresse de son image (vide : celle retrouvée d'après la
 * référence), son id Cardmarket, sa référence, sa page chez Cardmarket. `card` : la carte à
 * corriger ; `fields` : le bloc de ses champs, où le premier en erreur reçoit le focus à
 * l'enregistrement.
 */
export function useCardDraft(card: PokemonCard | null, fields: RefObject<HTMLElement | null>) {
  // Tiré une fois : deux clics sur « Enregistrer » écrivent la même carte, pas deux.
  const [id] = useState(() => card?.id ?? newCardId())
  // La langue de la carte à corriger (japonaise pour une nouvelle) : où son image est cherchée.
  const [language, setLanguage] = useState<CardLanguage>(() => (card ? cardLanguage(card) : 'ja'))
  const [image, setImage] = useState(() =>
    card?.image && !hasFoundImage(card) ? card.image.large : '',
  )
  // L'id et la page de départ : ceux de la carte.
  const [initial] = useState(() => ({
    cardmarket: card?.cardmarket ?? null,
    page: card?.page ?? '',
  }))
  const [cardmarketText, setCardmarketText] = useState(String(initial.cardmarket ?? ''))
  const [reference, setReference] = useState(card?.reference ?? '')
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
          : isSourceImage(imageUrl.href)
            ? 'Cette image ne s’affiche pas ici : laissez le champ vide, elle sera retrouvée.'
            : undefined,
    cardmarket:
      cardmarket === undefined ? 'Un nombre : l’id du produit chez Cardmarket.' : undefined,
    page: page.trim() && !pageUrl ? 'Collez une adresse de www.cardmarket.com.' : undefined,
  }
  const pasted: CardImage | null =
    imageUrl && !errors.image ? { small: imageUrl.href, large: imageUrl.href } : null
  // La référence dont on cherche l'image : aucune si une adresse est collée, ou sans code de série
  // et numéro.
  const lookup = image.trim() || !referenceCode(searched) ? null : searched
  // L'image déjà retrouvée reste, pour la même référence et la même langue : si elle n'est pas
  // retrouvée cette fois, ou si la référence n'a pas de code où la chercher.
  const kept =
    card &&
    reference.trim() === card.reference &&
    language === cardLanguage(card) &&
    hasFoundImage(card)
      ? card.image
      : null

  /**
   * La carte saisie, pour les Pokémon `dexIds` (`language: 'fr'` si elle est française, rien si elle
   * est japonaise) ; `null` tant qu'un champ est illisible (ses erreurs s'affichent alors, et le
   * premier reçoit le focus). Sans référence notée, le nom de la carte chez Cardmarket, sinon
   * `fallback` ; une référence qui n'était que le nom de l'ancien id suit l'id corrigé, et une page
   * qui n'était que celle de l'ancien id est oubliée (le lien suit alors l'id). Sans adresse
   * collée, l'image retrouvée d'après la référence, s'il y en a une.
   */
  async function read(dexIds: number[], fallback: string): Promise<PokemonCard | null> {
    if (cardmarket === undefined || errors.image || errors.page) {
      focusFirstError(fields, () => setSubmitted(true))
      return null
    }
    setSubmitted(true)
    const changedId = cardmarket !== initial.cardmarket
    // Le nom de l'id saisi, et celui de l'ancien id s'il a changé (la référence le reprenait-elle ?).
    const [known, previous] = await Promise.all([
      cardmarket === null ? null : loadPriceHistory(cardmarket),
      card?.cardmarket === undefined || !changedId ? null : loadPriceHistory(card.cardmarket),
    ])
    const typed = reference.trim()
    const stale = changedId && typed === previous?.name
    const stalePage = changedId && page.trim() === initial.page
    const search = !image.trim() && referenceCode(typed) !== null
    const found = search ? await findCardImage(typed, { lang: language, retry: true }) : null
    // L'image gardée (`kept`), pas si la référence n'était que le nom de l'ancien id : elle devient
    // celle d'une autre carte.
    const picture = pasted ?? found ?? (stale ? null : kept)
    return {
      id,
      dexIds,
      reference: (!stale && typed) || known?.name || fallback,
      image: picture,
      ...languageField(language),
      ...(cardmarket !== null && { cardmarket }),
      ...(pageUrl && !stalePage && { page: pageUrl }),
    }
  }

  /**
   * Reprend une carte choisie dans le catalogue : sa langue, sa référence (d'où son image) et son
   * id Cardmarket. Une adresse d'image ou une page collées pour une autre carte ne lui vont plus. La
   * même fonction d'un rendu à l'autre : les tuiles du catalogue (mémoïsées) ne se redessinent pas.
   */
  const fill = useCallback((chosen: Pick<CatalogCard, 'reference' | 'cardmarket' | 'set'>) => {
    setLanguage(chosen.set.language)
    setReference(chosen.reference)
    setSearched(chosen.reference)
    setCardmarketText(String(chosen.cardmarket ?? ''))
    setChecked(chosen.cardmarket ?? null)
    setImage('')
    setPage('')
  }, [])

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
    /** La langue de la carte : celle où son image est cherchée (`findCardImage`). */
    language,
    setLanguage,
    image,
    setImage,
    /** L'image de l'adresse collée, si elle est lisible. */
    pasted,
    /** La référence dont l'image est cherchée (`findCardImage`) ; `null` : rien à chercher. */
    lookup,
    /** L'image enregistrée, gardée à défaut d'une autre tant que la référence ne change pas. */
    kept,
    cardmarketText,
    setCardmarketText,
    /** L'id à vérifier chez Cardmarket, une fois le champ quitté ; `null` sinon. */
    checkedId: cardmarket === checked ? cardmarket : null,
    check: () => setChecked(cardmarket ?? null),
    reference,
    setReference,
    searchImage: () => setSearched(reference),
    fill,
    page,
    setPage,
    // L'id se signale tout de suite ; l'image et la page, à l'enregistrement.
    errors: submitted ? errors : { ...errors, image: undefined, page: undefined },
    save,
    saving,
  }
}

export type CardDraft = ReturnType<typeof useCardDraft>
